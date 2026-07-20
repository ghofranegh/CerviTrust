import base64, io
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from utils.api import predict

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def _img_to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

@app.post("/predict")
async def run_predict(file: UploadFile = File(...)):
    image = Image.open(io.BytesIO(await file.read())).convert("RGB")
    result = predict(image)
    result["segmentation"] = {k: _img_to_b64(v) for k, v in result["segmentation"].items()}
    result["gradcam"] = {k: _img_to_b64(v) for k, v in result["gradcam"].items()}
    for roi in result["regions_of_interest"]:
        roi["image"] = _img_to_b64(roi["image"])
    return result