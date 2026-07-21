import io
import json
import requests
from PIL import Image

img = Image.new('RGB', (256, 256), (255, 255, 255))
buf = io.BytesIO()
img.save(buf, format='PNG')
buf.seek(0)
files = {'file': ('test.png', buf.getvalue(), 'image/png')}
resp = requests.post('http://127.0.0.1:8000/predict', files=files, timeout=900)
print(resp.status_code)
print(resp.text[:2000])
