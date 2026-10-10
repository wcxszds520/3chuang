from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
folder = root / "output" / "project-report" / "assets" / "screenshots-real"
items = [
    ("real11-cargo-on-forks.png", "1  货物上叉"),
    ("real12-cargo-entering-door.png", "2  货物通过唯一门端"),
    ("real13-cargo-placed-target.png", "3  货物到达目标坐标"),
]
panels = []
target_w = 960
font = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 25)
for filename, label in items:
    with Image.open(folder / filename) as source:
        image = source.convert("RGB")
        height = round(target_w * image.height / image.width)
        image = image.resize((target_w, height))
        panel = Image.new("RGB", (target_w, height + 54), "white")
        panel.paste(image, (0, 54))
        draw = ImageDraw.Draw(panel)
        draw.rectangle((0, 0, target_w, 54), fill="#174F43")
        draw.text((22, 10), label, fill="white", font=font, stroke_width=0)
        panels.append(panel)
gap = 22
canvas = Image.new("RGB", (target_w, sum(p.height for p in panels) + gap * 2), "#f4f1ea")
y = 0
for panel in panels:
    canvas.paste(panel, (0, y))
    y += panel.height + gap
canvas.save(folder / "real14-forklift-sequence-montage.png", quality=95)
