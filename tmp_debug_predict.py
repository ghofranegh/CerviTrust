from PIL import Image
from utils.api import predict
import traceback

img = Image.new('RGB', (224, 224), color='red')
try:
    out = predict(img)
    print('ok', out.keys())
except Exception:
    traceback.print_exc()
