"""Inference backend: loads the exported model bundle and runs the pipeline
(EfficientNet + Laplace) on ONE uploaded image. Nucleus segmentation is only used
for visualizations / regions of interest - never for the classification itself,
which runs on the whole image (the model was trained on single-cell crops such as
SIPaKMeD / Herlev). When HoVer-Net is not configured, a classical segmentation
(Otsu + watershed) takes over so the segmentation, quality-control and targeted
review views always receive real data.
Every output image is a base64 PNG string, the format the frontend expects
(`data:image/png;base64,${...}`)."""
import base64
import io
import json
import math
import tempfile
import time
from pathlib import Path

import cv2
import numpy as np
import timm
import torch
from PIL import Image
from laplace import Laplace
from torchvision import transforms
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

BUNDLE_DIR = Path(__file__).resolve().parent.parent / "model_bundle"
CFG = json.load(open(BUNDLE_DIR / "inference_config.json"))
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CLASS_NAMES = CFG["classes"]
IMAGE_SIZE = CFG["image_size"]

# Max number of nuclei classified individually (~30 forward passes each).
MAX_REGIONS = CFG.get("max_regions_of_interest", 12)

_TRANSFORM = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)), transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def _pil_to_base64(img: Image.Image) -> str:
    """PIL image -> base64 PNG string, the format the frontend expects (a raw PIL
    object is not JSON serializable)."""
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _array_to_base64(arr: np.ndarray) -> str:
    return _pil_to_base64(Image.fromarray(arr.astype(np.uint8)))


def crop_nucleus(image, centroid, patch_size):
    h, w = image.shape[:2]
    half = patch_size // 2
    cx, cy = int(round(centroid[0])), int(round(centroid[1]))
    x0, x1, y0, y1 = cx - half, cx + half, cy - half, cy + half
    pl, pt, pr, pb = max(0, -x0), max(0, -y0), max(0, x1 - w), max(0, y1 - h)
    crop = image[max(0, y0):min(h, y1), max(0, x0):min(w, x1)]
    if any([pl, pt, pr, pb]):
        crop = cv2.copyMakeBorder(crop, pt, pb, pl, pr, borderType=cv2.BORDER_REFLECT_101)
    return crop


def read_tiatoolbox_zarr(zarr_path) -> dict:
    import zarr
    store = zarr.open(str(zarr_path), mode="r")
    n = store["centroid"].shape[0]
    return {i: {"contour": np.asarray(store["contours"][i]), "centroid": np.asarray(store["centroid"][i]),
                "type": int(store["type"][i]), "type_prob": float(store["prob"][i])} for i in range(n)}


# ---------- classification model, loaded once ----------
_backbone = timm.create_model("efficientnet_b0", pretrained=False, num_classes=len(CLASS_NAMES))
_ckpt = torch.load(BUNDLE_DIR / "efficientnet_b0.pt", map_location=DEVICE, weights_only=False)
_backbone.load_state_dict(_ckpt["state_dict"])
_backbone.to(DEVICE).eval()

_laplace = Laplace(_backbone, likelihood="classification",
                    subset_of_weights=CFG["laplace"]["subset_of_weights"],
                    hessian_structure=CFG["laplace"]["hessian_structure"],
                    prior_precision=CFG["laplace"]["prior_precision"])
_laplace.load_state_dict(torch.load(BUNDLE_DIR / "laplace_state.pt", map_location=DEVICE, weights_only=False))

# HoVer-Net is optional and only feeds visualizations / ROIs, never the
# classification. Remove "hovernet_model" from inference_config.json to rely on
# the classical fallback segmentation instead.
_segmentor = None
if CFG.get("hovernet_model"):
    from tiatoolbox.models.engine.nucleus_instance_segmentor import NucleusInstanceSegmentor
    _segmentor = NucleusInstanceSegmentor(model=CFG["hovernet_model"], batch_size=4, num_workers=0, device=str(DEVICE))
else:
    print("[predict] HoVer-Net disabled: using classical nucleus segmentation")


def _classify(image_rgb: np.ndarray) -> dict:
    """Classify an image (cell crop or whole image) -> mu (calibrated per-class
    probability) + sigma (Bayesian uncertainty), through the Laplace posterior."""
    tensor = _TRANSFORM(Image.fromarray(image_rgb)).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        samples = _laplace.predictive_samples(tensor, n_samples=30)
    return {"mu": samples.mean(dim=0)[0].cpu().numpy(), "sigma": samples.std(dim=0)[0].cpu().numpy(), "tensor": tensor}


# --------------------------------------------------------------------------
# Metrics derived from the model outputs (triage, uncertainty, slide quality)
# --------------------------------------------------------------------------

def _normalized_entropy(probabilities: np.ndarray) -> float:
    """Shannon entropy normalized to [0, 1]: 0 = decisive prediction,
    1 = the model hesitates between every class."""
    p = np.clip(np.asarray(probabilities, dtype=np.float64), 1e-12, 1.0)
    p = p / p.sum()
    entropy = float(-(p * np.log(p)).sum())
    return float(entropy / math.log(len(p))) if len(p) > 1 else 0.0


def _margin(probabilities: np.ndarray) -> float:
    """Gap between the top-1 and top-2 class: a small margin means a borderline
    case that deserves a second read."""
    ordered = np.sort(np.asarray(probabilities, dtype=np.float64))[::-1]
    return float(ordered[0] - ordered[1]) if len(ordered) > 1 else float(ordered[0])


def _triage(class_name: str, confidence: float, entropy: float, margin: float) -> dict:
    """Review priority: combines the severity of the predicted class with how
    reliable that prediction is. This drives the targeted review queue."""
    severity = {"NILM": 0, "ASC-US": 1, "LSIL": 2, "ASC-H": 3, "HSIL": 4, "SCC": 5}.get(class_name.upper(), 2)
    unreliable = confidence < 0.6 or entropy > 0.55 or margin < 0.15
    if severity >= 3:
        level = "high"
    elif severity >= 1 or unreliable:
        level = "medium"
    else:
        level = "low"
    if unreliable and level == "low":
        level = "medium"

    reasons = []
    if severity >= 3:
        reasons.append("High-grade class predicted")
    elif severity >= 1:
        reasons.append("Abnormal class predicted")
    if confidence < 0.6:
        reasons.append("Low calibrated probability")
    if entropy > 0.55:
        reasons.append("High predictive entropy")
    if margin < 0.15:
        reasons.append("Narrow margin with second class")
    return {"priority": level, "review_required": level != "low", "reasons": reasons}


def _assess_quality(image_rgb: np.ndarray, nucleus_mask: np.ndarray | None) -> dict:
    """Slide quality control computed on the actual image: focus (variance of the
    Laplacian), contrast, exposure, staining saturation and cellularity. This
    feeds the 'Image quality control' view."""
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    hsv = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2HSV)

    laplacian_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    mean_intensity = float(gray.mean())
    std_intensity = float(gray.std())
    saturation = float(hsv[:, :, 1].mean())
    clipped_high = float((gray >= 250).mean() * 100.0)
    clipped_low = float((gray <= 5).mean() * 100.0)
    coverage = float((nucleus_mask > 0).mean() * 100.0) if nucleus_mask is not None else 0.0

    # Sub-scores bounded to [0, 1] using usual digital-cytology thresholds.
    sharpness = min(1.0, laplacian_variance / 150.0)
    contrast = min(1.0, std_intensity / 55.0)
    exposure = max(0.0, 1.0 - abs(mean_intensity - 165.0) / 90.0)
    staining = min(1.0, saturation / 70.0)
    cellularity = min(1.0, coverage / 6.0)

    score = int(round(100 * (0.32 * sharpness + 0.24 * contrast + 0.18 * exposure
                             + 0.14 * staining + 0.12 * cellularity)))
    score = max(0, min(100, score))

    causes = []
    if sharpness < 0.35:
        causes.append("Out of focus")
    elif sharpness < 0.6:
        causes.append("Slight blur")
    if contrast < 0.45:
        causes.append("Low contrast")
    if mean_intensity > 210 or clipped_high > 2.0:
        causes.append("Overexposed field")
    elif mean_intensity < 90 or clipped_low > 2.0:
        causes.append("Underexposed field")
    if staining < 0.35:
        causes.append("Weak staining")
    if cellularity < 0.3:
        causes.append("Low cellularity")

    if score >= 70 and not causes:
        label = "interpretable"
    elif score >= 45:
        label = "uncertain"
    else:
        label = "not_interpretable"

    return {
        "score": score,
        "label": label,
        "causes": causes,
        "subscores": {
            "sharpness": round(sharpness, 3),
            "contrast": round(contrast, 3),
            "exposure": round(exposure, 3),
            "staining": round(staining, 3),
            "cellularity": round(cellularity, 3),
        },
        "metrics": {
            "laplacian_variance": round(laplacian_variance, 2),
            "mean_intensity": round(mean_intensity, 2),
            "std_intensity": round(std_intensity, 2),
            "mean_saturation": round(saturation, 2),
            "clipped_highlights_pct": round(clipped_high, 3),
            "clipped_shadows_pct": round(clipped_low, 3),
            "nucleus_coverage_pct": round(coverage, 3),
        },
    }


# --------------------------------------------------------------------------
# Segmentation: HoVer-Net when available, otherwise Otsu + watershed
# --------------------------------------------------------------------------

def _contours_to_instances(contours, min_area: int) -> list:
    instances = []
    for index, contour in enumerate(contours, start=1):
        contour = np.asarray(contour, dtype=np.int32).reshape(-1, 1, 2)
        if cv2.contourArea(contour) < min_area:
            continue
        moments = cv2.moments(contour)
        if moments["m00"] <= 0:
            centroid = contour.reshape(-1, 2).mean(axis=0)
        else:
            centroid = np.array([moments["m10"] / moments["m00"], moments["m01"] / moments["m00"]])
        instances.append({"id": index, "contour": contour, "centroid": centroid, "type_prob": None})
    return instances


def _classical_segmentation(image_rgb: np.ndarray, min_area: int) -> list:
    """Network-free nucleus segmentation: nuclei are the dark, saturated objects
    of the field. Inverse Otsu + morphological opening + watershed on the distance
    transform to split touching nuclei."""
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=2)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)

    if binary.max() == 0:
        return []

    distance = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    if distance.max() <= 0:
        return []
    _, sure_fg = cv2.threshold(distance, 0.45 * distance.max(), 255, cv2.THRESH_BINARY)
    sure_fg = np.uint8(sure_fg)
    sure_bg = cv2.dilate(binary, kernel, iterations=3)
    unknown = cv2.subtract(sure_bg, sure_fg)

    count, markers = cv2.connectedComponents(sure_fg)
    if count <= 1:
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return _contours_to_instances(contours, min_area)

    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR).copy(), markers)

    instances = []
    for label in range(2, markers.max() + 1):
        mask = np.uint8(markers == label) * 255
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        instances.extend(_contours_to_instances([max(contours, key=cv2.contourArea)], min_area))

    for index, instance in enumerate(instances, start=1):
        instance["id"] = index
    return instances


def _run_segmentation(image_rgb: np.ndarray):
    """Returns (inst_map, nuclei, source). Never blocks: falls back to classical
    segmentation when HoVer-Net is missing or fails."""
    min_area = CFG.get("min_nucleus_area", 20)
    nuclei_raw, source = [], "classical"

    if _segmentor is not None:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                img_path = Path(tmp) / "upload.png"
                cv2.imwrite(str(img_path), cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR))
                result = _segmentor.run(
                    images=[str(img_path)], save_dir=str(Path(tmp) / "raw"), patch_mode=False,
                    input_resolutions=[{"units": "baseline", "resolution": 1.0}],
                    auto_get_mask=False, overwrite=True,
                )
                inst_dict = read_tiatoolbox_zarr(result[img_path])
            nuclei_raw = [
                {"id": int(nid), "contour": np.array(n["contour"], dtype=np.int32).reshape(-1, 1, 2),
                 "centroid": np.asarray(n["centroid"]), "type_prob": n.get("type_prob")}
                for nid, n in inst_dict.items()
            ]
            nuclei_raw = [n for n in nuclei_raw if cv2.contourArea(n["contour"]) >= min_area]
            source = "hovernet"
        except Exception as exc:
            print(f"[predict] HoVer-Net skipped ({exc}) - using classical segmentation")
            nuclei_raw = []

    if not nuclei_raw:
        try:
            nuclei_raw = _classical_segmentation(image_rgb, min_area)
        except Exception as exc:
            print(f"[predict] classical segmentation skipped: {exc}")
            nuclei_raw = []

    inst_map = np.zeros(image_rgb.shape[:2], dtype=np.int32)
    for nucleus in nuclei_raw:
        cv2.drawContours(inst_map, [nucleus["contour"]], -1, int(nucleus["id"]), thickness=-1)

    return inst_map, nuclei_raw, source


def _morphometrics(image_rgb: np.ndarray, contour: np.ndarray, cytoplasm_mask: np.ndarray) -> dict:
    """Per-nucleus morphometry: area, perimeter, circularity, nucleus/cytoplasm
    ratio and chromatin texture. These values fill the 'Instance details' panel."""
    area = float(cv2.contourArea(contour))
    perimeter = float(cv2.arcLength(contour, True))
    circularity = float(4 * math.pi * area / (perimeter ** 2)) if perimeter > 0 else 0.0
    circularity = max(0.0, min(1.0, circularity))
    x, y, w, h = cv2.boundingRect(contour)

    hull_area = float(cv2.contourArea(cv2.convexHull(contour)))
    solidity = float(area / hull_area) if hull_area > 0 else 0.0
    elongation = float(max(w, h) / max(1.0, min(w, h)))

    nucleus_mask = np.zeros(image_rgb.shape[:2], dtype=np.uint8)
    cv2.drawContours(nucleus_mask, [contour], -1, 255, thickness=-1)
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    nucleus_pixels = gray[nucleus_mask > 0]

    # Cytoplasm approximated by a dilation ring around the nucleus.
    radius = max(3, int(round(math.sqrt(max(area, 1.0) / math.pi))))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    ring = cv2.subtract(cv2.dilate(nucleus_mask, kernel), nucleus_mask)
    ring = cv2.bitwise_and(ring, cytoplasm_mask)
    ring_pixels = gray[ring > 0]
    cytoplasm_area = float((ring > 0).sum())

    mean_intensity = float(nucleus_pixels.mean()) if nucleus_pixels.size else 0.0
    chromatin_std = float(nucleus_pixels.std()) if nucleus_pixels.size else 0.0
    cytoplasm_intensity = float(ring_pixels.mean()) if ring_pixels.size else 0.0
    # Nucleoli: sub-regions clearly darker than the nuclear mean.
    nucleoli_fraction = float((nucleus_pixels < (mean_intensity - 1.5 * max(chromatin_std, 1e-6))).mean()) \
        if nucleus_pixels.size else 0.0
    # Vacuoles: bright spots inside the cytoplasmic ring.
    vacuole_fraction = float((ring_pixels > (cytoplasm_intensity + 25)).mean()) if ring_pixels.size else 0.0

    return {
        "nucleus_area_px": round(area, 1),
        "cytoplasm_area_px": round(cytoplasm_area, 1),
        "nc_ratio": round(area / cytoplasm_area, 3) if cytoplasm_area > 0 else None,
        "perimeter_px": round(perimeter, 1),
        "circularity": round(circularity, 3),
        "solidity": round(solidity, 3),
        "elongation": round(elongation, 3),
        "equivalent_diameter_px": round(2 * math.sqrt(area / math.pi), 1) if area > 0 else 0.0,
        "mean_nucleus_intensity": round(mean_intensity, 1),
        "chromatin_std": round(chromatin_std, 2),
        "mean_cytoplasm_intensity": round(cytoplasm_intensity, 1),
        "bbox": [int(x), int(y), int(w), int(h)],
        "_nucleoli_fraction": round(nucleoli_fraction, 4),
        "_vacuole_fraction": round(vacuole_fraction, 4),
    }


def _severity(value: float, mild: float, moderate: float) -> str:
    if value >= moderate:
        return "moderate"
    if value >= mild:
        return "mild"
    return "none"


def _localized_anomalies(metrics: dict) -> list:
    """Turns morphometric measurements into readable cytology observations
    (the 'Localized anomalies' panel)."""
    irregularity = 1.0 - float(metrics["circularity"])
    chromatin = float(metrics["chromatin_std"]) / 60.0
    nucleoli = float(metrics["_nucleoli_fraction"])
    vacuoles = float(metrics["_vacuole_fraction"])
    nc_ratio = metrics["nc_ratio"]

    anomalies = [
        {"label": "Irregular nuclear contour", "severity": _severity(irregularity, 0.18, 0.32),
         "value": round(irregularity, 3)},
        {"label": "Heterogeneous chromatin", "severity": _severity(chromatin, 0.35, 0.6),
         "value": round(min(chromatin, 1.0), 3)},
        {"label": "Visible nucleoli", "severity": _severity(nucleoli, 0.04, 0.12),
         "value": round(nucleoli, 3)},
        {"label": "Vacuolated cytoplasm", "severity": _severity(vacuoles, 0.08, 0.2),
         "value": round(vacuoles, 3)},
    ]
    if nc_ratio is not None:
        anomalies.append({
            "label": "Increased nucleus/cytoplasm ratio",
            "severity": _severity(float(nc_ratio), 0.25, 0.45),
            "value": round(float(nc_ratio), 3),
        })
    return anomalies


def _gradcam_stats(grayscale_cam: np.ndarray) -> dict:
    """Attention statistics: where and how tightly the model focused."""
    cam = np.asarray(grayscale_cam, dtype=np.float64)
    if cam.size == 0:
        return {}
    peak_y, peak_x = np.unravel_index(int(cam.argmax()), cam.shape)
    high = float((cam >= 0.6).mean() * 100.0)
    return {
        "high_activation_pct": round(high, 2),
        "mean_activation": round(float(cam.mean()), 3),
        "peak_activation": round(float(cam.max()), 3),
        # High score = focused attention, low score = diffuse over the whole field.
        "focus_score": round(float(1.0 - min(1.0, high / 40.0)), 3),
        "peak_position_pct": [round(float(peak_x) / cam.shape[1] * 100, 1),
                              round(float(peak_y) / cam.shape[0] * 100, 1)],
    }


def predict(image: Image.Image) -> dict:
    started = time.perf_counter()
    image_rgb = np.array(image.convert("RGB"))
    height, width = image_rgb.shape[:2]

    # --- Main classification: on the WHOLE image, the way the model expects ---
    result = _classify(image_rgb)
    mu, sigma, tensor = result["mu"], result["sigma"], result["tensor"]
    pred_idx = int(mu.argmax())
    predicted_class = CLASS_NAMES[pred_idx]
    confidence = float(mu[pred_idx])
    entropy = _normalized_entropy(mu)
    margin = _margin(mu)
    triage = _triage(predicted_class, confidence, entropy, margin)

    # --- Grad-CAM on the whole image ---
    target_layer = dict(_backbone.named_modules())[CFG["gradcam_target_layer"]]
    with GradCAM(model=_backbone, target_layers=[target_layer]) as cam:
        grayscale_cam = cam(input_tensor=tensor, targets=[ClassifierOutputTarget(pred_idx)])[0]
    image_resized = cv2.resize(image_rgb, (IMAGE_SIZE, IMAGE_SIZE))
    heatmap_color = cv2.cvtColor(cv2.applyColorMap(np.uint8(255 * grayscale_cam), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    gradcam_overlay = show_cam_on_image(image_resized.astype(np.float32) / 255.0, grayscale_cam,
                                         use_rgb=True, image_weight=0.6)

    # --- Segmentation: visualizations, regions of interest and morphometry ---
    inst_map, nuclei, segmentation_source = _run_segmentation(image_rgb)

    overlay = image_rgb.copy()
    if nuclei:
        cv2.drawContours(overlay, [n["contour"] for n in nuclei], -1, (198, 40, 40), 1)
    nucleus_binary = ((inst_map > 0) * 255).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    cytoplasm_binary = cv2.subtract(cv2.dilate(nucleus_binary, kernel, iterations=2), nucleus_binary)
    background_binary = cv2.bitwise_not(cv2.bitwise_or(nucleus_binary, cytoplasm_binary))

    segmentation = {
        "overlay": _array_to_base64(overlay),
        "background": _array_to_base64(cv2.cvtColor(background_binary, cv2.COLOR_GRAY2RGB)),
        "cytoplasm": _array_to_base64(cv2.cvtColor(cytoplasm_binary, cv2.COLOR_GRAY2RGB)),
        "nucleus": _array_to_base64(cv2.cvtColor(nucleus_binary, cv2.COLOR_GRAY2RGB)),
    }

    # --- Per-nucleus classification (regions of interest) ---
    patch_size = CFG.get("patch_size", IMAGE_SIZE)
    # The classification crop above stays IMAGE_SIZE (64px) so predictions are
    # unaffected by this change. The *displayed* crop is taken separately, at a
    # larger native size and then upscaled with cubic interpolation, so the
    # "Targeted review" / segmentation thumbnails are an actual sharp zoom
    # instead of a blurry blow-up of a 64x64 PNG.
    display_patch_size = CFG.get("cell_patch_size", 160)
    display_size = CFG.get("cell_display_size", 256)
    regions_of_interest = []
    class_distribution = {name: 0 for name in CLASS_NAMES}
    # Largest nuclei first: they carry the most information for triage.
    ordered_nuclei = sorted(nuclei, key=lambda n: cv2.contourArea(n["contour"]), reverse=True)

    for nucleus in ordered_nuclei[:MAX_REGIONS]:
        crop = crop_nucleus(image_rgb, nucleus["centroid"], patch_size)
        display_crop = crop_nucleus(image_rgb, nucleus["centroid"], display_patch_size)
        display_crop = cv2.resize(display_crop, (display_size, display_size), interpolation=cv2.INTER_CUBIC)
        crop_result = _classify(crop)
        crop_mu, crop_sigma = crop_result["mu"], crop_result["sigma"]
        crop_idx = int(crop_mu.argmax())
        crop_class = CLASS_NAMES[crop_idx]
        crop_confidence = float(crop_mu[crop_idx])
        crop_entropy = _normalized_entropy(crop_mu)
        crop_margin = _margin(crop_mu)
        crop_triage = _triage(crop_class, crop_confidence, crop_entropy, crop_margin)

        metrics = _morphometrics(image_rgb, nucleus["contour"], cytoplasm_binary)
        anomalies = _localized_anomalies(metrics)
        metrics.pop("_nucleoli_fraction", None)
        metrics.pop("_vacuole_fraction", None)

        class_distribution[crop_class] = class_distribution.get(crop_class, 0) + 1
        regions_of_interest.append({
            "id": int(nucleus["id"]),
            "predicted_class": crop_class,
            "confidence": crop_confidence,
            "uncertainty": float(crop_sigma[crop_idx]),
            "probabilities": {c: float(p) for c, p in zip(CLASS_NAMES, crop_mu)},
            "entropy": round(crop_entropy, 4),
            "margin": round(crop_margin, 4),
            "priority": crop_triage["priority"],
            "review_required": crop_triage["review_required"],
            "review_reasons": crop_triage["reasons"],
            "centroid": [round(float(nucleus["centroid"][0]), 1), round(float(nucleus["centroid"][1]), 1)],
            "position_pct": [round(float(nucleus["centroid"][0]) / width * 100, 2),
                             round(float(nucleus["centroid"][1]) / height * 100, 2)],
            "segmentation_confidence": (round(float(nucleus["type_prob"]), 3)
                                        if nucleus.get("type_prob") is not None else None),
            "morphometrics": metrics,
            "anomalies": anomalies,
            "image": _array_to_base64(display_crop),
        })

    areas = [float(cv2.contourArea(n["contour"])) for n in nuclei]
    nc_ratios = [roi["morphometrics"]["nc_ratio"] for roi in regions_of_interest
                 if roi["morphometrics"]["nc_ratio"] is not None]
    segmentation_stats = {
        "source": segmentation_source,
        "nuclei_detected": len(nuclei),
        "nuclei_analyzed": len(regions_of_interest),
        "mean_nucleus_area_px": round(float(np.mean(areas)), 1) if areas else 0.0,
        "median_nucleus_area_px": round(float(np.median(areas)), 1) if areas else 0.0,
        "nucleus_coverage_pct": round(float((nucleus_binary > 0).mean() * 100), 2),
        "cytoplasm_coverage_pct": round(float((cytoplasm_binary > 0).mean() * 100), 2),
        "mean_circularity": round(float(np.mean([roi["morphometrics"]["circularity"]
                                                 for roi in regions_of_interest])), 3) if regions_of_interest else 0.0,
        "mean_nc_ratio": round(float(np.mean(nc_ratios)), 3) if nc_ratios else None,
        "mean_instance_confidence": round(float(np.mean([roi["confidence"] for roi in regions_of_interest])), 3)
        if regions_of_interest else 0.0,
        "mean_instance_entropy": round(float(np.mean([roi["entropy"] for roi in regions_of_interest])), 3)
        if regions_of_interest else 0.0,
        "abnormal_instances": sum(1 for roi in regions_of_interest if roi["predicted_class"].upper() != "NILM"),
        "high_priority_instances": sum(1 for roi in regions_of_interest if roi["priority"] == "high"),
    }

    quality = _assess_quality(image_rgb, nucleus_binary)

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "uncertainty": float(sigma[pred_idx]),
        "probabilities": {c: float(p) for c, p in zip(CLASS_NAMES, mu)},
        "uncertainties": {c: float(s) for c, s in zip(CLASS_NAMES, sigma)},
        "entropy": round(entropy, 4),
        "margin": round(margin, 4),
        "priority": triage["priority"],
        "review_required": triage["review_required"],
        "review_reasons": triage["reasons"],
        "quality": quality,
        "gradcam": {"heatmap": _array_to_base64(heatmap_color), "overlay": _array_to_base64(gradcam_overlay)},
        "gradcam_stats": _gradcam_stats(grayscale_cam),
        "segmentation": segmentation,
        "segmentation_stats": segmentation_stats,
        "regions_of_interest": regions_of_interest,
        "class_distribution": class_distribution,
        "image_info": {"width": int(width), "height": int(height), "megapixels": round(width * height / 1e6, 2)},
        "model": {
            "classes": CLASS_NAMES,
            "backbone": "efficientnet_b0",
            "input_size": IMAGE_SIZE,
            "uncertainty_method": f"Laplace ({CFG['laplace']['subset_of_weights']}, {CFG['laplace']['hessian_structure']})",
            "explainability": f"Grad-CAM @ {CFG['gradcam_target_layer']}",
            "segmentation_source": segmentation_source,
        },
        "processing_time_ms": int((time.perf_counter() - started) * 1000),
    }
