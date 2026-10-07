"""'Stress' docs: deliberately bad photos to see how the app fails (Not found vs wrong values)."""
import json, random
from pathlib import Path
from PIL import Image, ImageFilter
OUT = Path(__file__).resolve().parent.parent / "test-docs"
random.seed(5)
exp = json.loads((OUT / "expected.json").read_text())
def degrade(src, dst, scale, blur, angle):
    im = Image.open(OUT / src).convert("RGB")
    im = im.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(100, 95, 90))
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
    im.save(OUT / dst, quality=60)
    e = dict(exp[src]); e["set"] = "stress"; e["note"] = f"Degraded copy of {src}: scale {scale}, blur {blur}, rotation {angle} deg."
    exp[dst] = e
degrade("de_traffic_fine_photo.jpg", "stress_de_traffic_fine_tiny_blurry.jpg", 0.4, 1.6, 4)
degrade("en_hotel_email.png", "stress_en_hotel_rotated_8deg.jpg", 0.7, 1.0, 8)
degrade("it_hotel_cancellation.jpg", "stress_it_hotel_very_low_res.jpg", 0.3, 0.8, 0)
(OUT / "expected.json").write_text(json.dumps(exp, indent=2, ensure_ascii=False))
