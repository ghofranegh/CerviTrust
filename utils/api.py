"""Backend d'inference : charge le bundle centralise exporte depuis Kaggle et
execute le pipeline (EfficientNet+Laplace) sur UNE image uploadee. La segmentation
HoVer-Net est optionnelle, utilisee uniquement pour les visualisations/regions
d'interet - pas pour la classification, qui opere directement sur l'image entiere
(le modele a ete entraine sur des crops de cellule uniques, comme SIPaKMeD/Herlev).
Toutes les images de sortie sont encodees en base64 PNG, format attendu par
image-analyzer.tsx (`data:image/png;base64,${...}`)."""
import base64
import io
import json
import tempfile
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

_TRANSFORM = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)), transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def _pil_to_base64(img: Image.Image) -> str:
    """Convertit une image PIL en chaine base64 PNG - format attendu par le
    frontend, pas un objet PIL brut (non serialisable en JSON tel quel)."""
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


# ---------- chargement du modele de classification (une seule fois) ----------
_backbone = timm.create_model("efficientnet_b0", pretrained=False, num_classes=len(CLASS_NAMES))
_ckpt = torch.load(BUNDLE_DIR / "efficientnet_b0.pt", map_location=DEVICE, weights_only=False)
_backbone.load_state_dict(_ckpt["state_dict"])
_backbone.to(DEVICE).eval()

_laplace = Laplace(_backbone, likelihood="classification",
                    subset_of_weights=CFG["laplace"]["subset_of_weights"],
                    hessian_structure=CFG["laplace"]["hessian_structure"],
                    prior_precision=CFG["laplace"]["prior_precision"])
_laplace.load_state_dict(torch.load(BUNDLE_DIR / "laplace_state.pt", map_location=DEVICE, weights_only=False))

# Segmentation : OPTIONNELLE, uniquement pour les visualisations/ROI, jamais
# pour la classification elle-meme. Mettre "hovernet_model" absent de
# inference_config.json pour la desactiver entierement (reponse plus rapide).
_segmentor = None
if CFG.get("hovernet_model"):
    from tiatoolbox.models.engine.nucleus_instance_segmentor import NucleusInstanceSegmentor
    _segmentor = NucleusInstanceSegmentor(model=CFG["hovernet_model"], batch_size=4, num_workers=0, device=str(DEVICE))
else:
    print("[predict] segmentation disabled: no hovernet_model configured in model_bundle/inference_config.json")


def _classify(image_rgb: np.ndarray) -> dict:
    """Classifie une image (crop de cellule ou image entiere) -> mu (probabilite
    calibree par classe) + sigma (incertitude bayesienne), via Laplace."""
    tensor = _TRANSFORM(Image.fromarray(image_rgb)).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        samples = _laplace.predictive_samples(tensor, n_samples=30)
    return {"mu": samples.mean(dim=0)[0].cpu().numpy(), "sigma": samples.std(dim=0)[0].cpu().numpy(), "tensor": tensor}


def _run_segmentation(image_rgb: np.ndarray):
    """Segmentation HoVer-Net optionnelle. Ne bloque jamais : retourne
    (None, []) au moindre probleme, l'appelant traite ca comme 'pas de ROI'."""
    if _segmentor is None:
        print("[predict] segmentation skipped: HoVer-Net model is not available")
        return None, []
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
    except Exception as exc:
        print(f"[predict] segmentation ignoree : {exc}")
        return None, []

    min_area = CFG.get("min_nucleus_area", 20)
    inst_map = np.zeros(image_rgb.shape[:2], dtype=np.int32)
    nuclei = []
    for nid, nucleus in inst_dict.items():
        contour = np.array(nucleus["contour"], dtype=np.int32)
        if cv2.contourArea(contour) < min_area:
            continue
        cv2.drawContours(inst_map, [contour], -1, int(nid), thickness=-1)
        nuclei.append({"id": int(nid), "contour": contour, "centroid": nucleus["centroid"]})
    return inst_map, nuclei


def predict(image: Image.Image) -> dict:
    image_rgb = np.array(image.convert("RGB"))

    # --- Classification principale : sur l'image ENTIERE, comme le modele l'attend ---
    result = _classify(image_rgb)
    mu, sigma, tensor = result["mu"], result["sigma"], result["tensor"]
    pred_idx = int(mu.argmax())

    # --- Grad-CAM sur l'image entiere ---
    target_layer = dict(_backbone.named_modules())[CFG["gradcam_target_layer"]]
    with GradCAM(model=_backbone, target_layers=[target_layer]) as cam:
        grayscale_cam = cam(input_tensor=tensor, targets=[ClassifierOutputTarget(pred_idx)])[0]
    image_resized = cv2.resize(image_rgb, (IMAGE_SIZE, IMAGE_SIZE))
    heatmap_color = cv2.cvtColor(cv2.applyColorMap(np.uint8(255 * grayscale_cam), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    gradcam_overlay = show_cam_on_image(image_resized.astype(np.float32) / 255.0, grayscale_cam,
                                         use_rgb=True, image_weight=0.6)

    # --- Segmentation optionnelle : visualisation + regions d'interet uniquement ---
    inst_map, nuclei = _run_segmentation(image_rgb)
    regions_of_interest, segmentation = [], {}
    if inst_map is not None and nuclei:
        overlay = image_rgb.copy()
        cv2.drawContours(overlay, [n["contour"] for n in nuclei], -1, (255, 0, 0), 1)
        nucleus_mask = cv2.cvtColor(((inst_map > 0) * 255).astype(np.uint8), cv2.COLOR_GRAY2RGB)
        background_mask = cv2.cvtColor(((inst_map == 0) * 255).astype(np.uint8), cv2.COLOR_GRAY2RGB)

        patch_size = CFG.get("patch_size", IMAGE_SIZE)
        for n in nuclei[:12]:  # limite raisonnable pour l'affichage
            crop = crop_nucleus(image_rgb, n["centroid"], patch_size)
            crop_result = _classify(crop)
            crop_pred_idx = int(crop_result["mu"].argmax())
            regions_of_interest.append({
                "id": n["id"], "predicted_class": CLASS_NAMES[crop_pred_idx],
                "confidence": float(crop_result["mu"][crop_pred_idx]), "image": _array_to_base64(crop),
            })
        segmentation = {
            "overlay": _array_to_base64(overlay),
            "background": _array_to_base64(background_mask),
            "cytoplasm": _array_to_base64(background_mask),  # approximation, voir notebook
            "nucleus": _array_to_base64(nucleus_mask),
        }

    return {
        "predicted_class": CLASS_NAMES[pred_idx],
        "confidence": float(mu[pred_idx]),
        "uncertainty": float(sigma[pred_idx]),
        "probabilities": {c: float(p) for c, p in zip(CLASS_NAMES, mu)},
        "gradcam": {"heatmap": _array_to_base64(heatmap_color), "overlay": _array_to_base64(gradcam_overlay)},
        "segmentation": segmentation,
        "regions_of_interest": regions_of_interest,
    }