import base64, io
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from utils.api import predict

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def _img_to_b64(img) -> str | None:
    if img is None:
        return None
    if isinstance(img, str):
        return img
    if isinstance(img, bytes):
        return base64.b64encode(img).decode("utf-8")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

@app.post("/predict")
async def run_predict(file: UploadFile = File(...)):
    image = Image.open(io.BytesIO(await file.read())).convert("RGB")
    result = predict(image)

    segmentation = result.get("segmentation")
    if isinstance(segmentation, dict):
        result["segmentation"] = {k: _img_to_b64(v) for k, v in segmentation.items() if v is not None}
    else:
        result["segmentation"] = {}

    gradcam = result.get("gradcam")
    if isinstance(gradcam, dict):
        result["gradcam"] = {k: _img_to_b64(v) for k, v in gradcam.items() if v is not None}
    else:
        result["gradcam"] = {}

    regions = result.get("regions_of_interest", []) or []
    for roi in regions:
        if isinstance(roi, dict) and roi.get("image") is not None:
            roi["image"] = _img_to_b64(roi["image"])
    result["regions_of_interest"] = regions

    return result