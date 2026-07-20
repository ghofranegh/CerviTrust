"""Backend d'inference : charge le bundle exporte depuis Kaggle et execute le pipeline
complet (HoVer-Net -> EfficientNet+Laplace -> MIL -> Grad-CAM) sur UNE image uploadee."""
import json
import tempfile
from pathlib import Path

import cv2
import numpy as np
import timm
import torch
import torch.nn as nn
from PIL import Image
from laplace import Laplace
from torchvision import transforms
from tiatoolbox.models.engine.nucleus_instance_segmentor import NucleusInstanceSegmentor
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

BUNDLE_DIR = Path(__file__).resolve().parent.parent / "model_bundle"
CFG = json.load(open(BUNDLE_DIR / "inference_config.json"))
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CLASS_NAMES, IMAGE_SIZE, PATCH_SIZE, MIN_AREA = CFG["classes"], CFG["image_size"], CFG["patch_size"], CFG["min_nucleus_area"]

_TRANSFORM = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)), transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


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


def _apply_fedbn_params(model: nn.Module, flat: torch.Tensor):
    modules = dict(model.named_modules())
    names = [n for n, _ in model.named_parameters()
             if not isinstance(modules[n.rsplit(".", 1)[0]], (nn.BatchNorm1d, nn.BatchNorm2d, nn.BatchNorm3d))]
    params, offset = dict(model.named_parameters()), 0
    for n in names:
        numel = params[n].numel()
        params[n].data = flat[offset:offset + numel].view_as(params[n]).clone()
        offset += numel


class AttentionMIL(nn.Module):
    def __init__(self, in_dim, hidden_dim, attention_dim, num_classes, dropout):
        super().__init__()
        self.instance_encoder = nn.Sequential(nn.Linear(in_dim, hidden_dim), nn.ReLU(), nn.Dropout(dropout))
        self.attention_V = nn.Sequential(nn.Linear(hidden_dim, attention_dim), nn.Tanh())
        self.attention_U = nn.Sequential(nn.Linear(hidden_dim, attention_dim), nn.Sigmoid())
        self.attention_w = nn.Linear(attention_dim, 1)
        self.classifier = nn.Linear(hidden_dim, num_classes)

    def forward(self, instances):
        h = self.instance_encoder(instances)
        gated = self.attention_V(h) * self.attention_U(h)
        weights = torch.softmax(self.attention_w(gated).squeeze(-1), dim=0)
        bag = (weights.unsqueeze(-1) * h).sum(dim=0)
        logits = self.classifier(bag)
        return {"slide_probs": torch.softmax(logits, dim=0), "attention_weights": weights}


# ---------- chargement des modeles (une seule fois, au demarrage de l'app) ----------
_backbone = timm.create_model("efficientnet_b0", pretrained=False, num_classes=len(CLASS_NAMES))
_ckpt = torch.load(BUNDLE_DIR / "efficientnet_b0.pt", map_location=DEVICE, weights_only=False)
_backbone.load_state_dict(_ckpt["state_dict"])
_global = torch.load(BUNDLE_DIR / "global_fedbn_state.pt", map_location=DEVICE, weights_only=False)
_apply_fedbn_params(_backbone, torch.tensor(_global["flat_params"], device=DEVICE, dtype=torch.float32))
_backbone.to(DEVICE).eval()

_laplace = Laplace(_backbone, likelihood="classification", subset_of_weights=CFG["laplace"]["subset_of_weights"],
                    hessian_structure=CFG["laplace"]["hessian_structure"], prior_precision=CFG["laplace"]["prior_precision"])
_laplace.load_state_dict(torch.load(BUNDLE_DIR / "laplace_state_fedbn.pt", map_location=DEVICE, weights_only=False))

_mil = AttentionMIL(2 * len(CLASS_NAMES), CFG["mil"]["hidden_dim"], CFG["mil"]["attention_dim"], len(CLASS_NAMES), CFG["mil"]["dropout"]).to(DEVICE)
_mil.load_state_dict(torch.load(BUNDLE_DIR / "attention_mil.pt", map_location=DEVICE, weights_only=False)["state_dict"])
_mil.eval()

_segmentor = NucleusInstanceSegmentor(model=CFG["hovernet_model"], batch_size=4, num_workers=0, device=str(DEVICE))


def predict(image: Image.Image) -> dict:
    image_rgb = np.array(image.convert("RGB"))
    with tempfile.TemporaryDirectory() as tmp:
        img_path = Path(tmp) / "upload.png"
        cv2.imwrite(str(img_path), cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR))
        result = _segmentor.run(
            images=[str(img_path)], save_dir=str(Path(tmp) / "raw"), patch_mode=False,
            input_resolutions=[{"units": "baseline", "resolution": 1.0}], auto_get_mask=False, overwrite=True,
        )
        inst_dict = read_tiatoolbox_zarr(result[img_path])
        print(f"[predict] segmentation terminee : {len(inst_dict)} noyaux detectes")


    inst_map = np.zeros(image_rgb.shape[:2], dtype=np.int32)
    crops, centroids, nucleus_ids = [], [], []
    for nid, nucleus in inst_dict.items():
        contour = np.array(nucleus["contour"], dtype=np.int32)
        if cv2.contourArea(contour) < MIN_AREA:
            continue
        cv2.drawContours(inst_map, [contour], -1, int(nid), thickness=-1)
        crops.append(crop_nucleus(image_rgb, nucleus["centroid"], PATCH_SIZE))
        centroids.append(nucleus["centroid"])
        nucleus_ids.append(nid)

    nucleus_mask_img = Image.fromarray(((inst_map > 0) * 255).astype(np.uint8))
    background_mask_img = Image.fromarray(((inst_map == 0) * 255).astype(np.uint8))  # approximation, voir docstring
    overlay = image_rgb.copy()
    cv2.drawContours(overlay, [np.array(inst_dict[n]["contour"], dtype=np.int32) for n in nucleus_ids], -1, (255, 0, 0), 1)

    if not crops:
        return {"predicted_class": "NILM", "confidence": 0.0, "probabilities": {c: 0.0 for c in CLASS_NAMES},
                "segmentation": {"overlay": Image.fromarray(overlay), "background": background_mask_img,
                                  "cytoplasm": background_mask_img, "nucleus": nucleus_mask_img},
                "gradcam": {"heatmap": image.copy(), "overlay": image.copy()}, "regions_of_interest": []}

    print(f"[predict] {len(crops)} crops extraits, debut de l'echantillonnage Laplace (30 passes)...")
    batch = torch.stack([_TRANSFORM(Image.fromarray(c)) for c in crops]).to(DEVICE)
    with torch.no_grad():
        samples = _laplace.predictive_samples(batch, n_samples=30)
    print("[predict] echantillonnage Laplace termine")
    mu, sigma = samples.mean(dim=0).cpu().numpy(), samples.std(dim=0).cpu().numpy()

    features = torch.tensor(np.concatenate([mu, sigma], axis=1), dtype=torch.float32).to(DEVICE)
    with torch.no_grad():
        mil_out = _mil(features)
    slide_probs = mil_out["slide_probs"].cpu().numpy()
    attn = mil_out["attention_weights"].cpu().numpy()
    pred_idx = int(slide_probs.argmax())

    order = np.argsort(-attn)[:CFG["top_k_cells"]]
    regions_of_interest, attn_overlay = [], overlay.copy()
    for i in order:
        w = float(attn[i])
        color = tuple(int(c * 255) for c in [1, 1 - w, 0])
        cv2.circle(attn_overlay, (int(centroids[i][0]), int(centroids[i][1])), 2 + int(6 * w), color, -1)
        cell_pred_idx = int(mu[i].argmax())
        regions_of_interest.append({"id": int(nucleus_ids[i]), "predicted_class": CLASS_NAMES[cell_pred_idx],
                                     "confidence": float(mu[i][cell_pred_idx]), "image": Image.fromarray(crops[i])})

    top_i = order[0]
    target_layer = dict(_backbone.named_modules())[CFG["gradcam_target_layer"]]
    crop_tensor = _TRANSFORM(Image.fromarray(crops[top_i])).unsqueeze(0).to(DEVICE)
    with GradCAM(model=_backbone, target_layers=[target_layer]) as cam:
        print("[predict] calcul du Grad-CAM...")
        grayscale_cam = cam(input_tensor=crop_tensor, targets=[ClassifierOutputTarget(int(mu[top_i].argmax()))])[0]
    crop_float = cv2.resize(crops[top_i], (IMAGE_SIZE, IMAGE_SIZE)).astype(np.float32) / 255.0
    gradcam_overlay = show_cam_on_image(crop_float, grayscale_cam, use_rgb=True, image_weight=0.65)

    return {
        "predicted_class": CLASS_NAMES[pred_idx], "confidence": float(slide_probs[pred_idx]),
        "probabilities": {c: float(p) for c, p in zip(CLASS_NAMES, slide_probs)},
        "segmentation": {"overlay": Image.fromarray(overlay), "background": background_mask_img,
                          "cytoplasm": background_mask_img, "nucleus": nucleus_mask_img},
        "gradcam": {"heatmap": Image.fromarray((grayscale_cam * 255).astype(np.uint8)),
                    "overlay": Image.fromarray(attn_overlay)},
        "regions_of_interest": regions_of_interest,
    }