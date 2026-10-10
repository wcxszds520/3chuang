from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

folder = Path(sys.argv[1])
output = Path(sys.argv[2])
files = list(folder.glob("page-*.jpg")) + list(folder.glob("page-*.png"))
files = sorted(files, key=lambda p: int(p.stem.split("-")[-1]))
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
thumb_w = 300
label_h = 28
thumbs = []
for i, path in enumerate(files, 1):
    with Image.open(path) as im:
        im = im.convert("RGB")
        h = round(thumb_w * im.height / im.width)
        im = im.resize((thumb_w, h))
        canvas = Image.new("RGB", (thumb_w, h + label_h), "white")
        canvas.paste(im, (0, label_h))
        ImageDraw.Draw(canvas).text((8, 6), f"Page {i}", fill="black")
        thumbs.append(canvas)
rows = (len(thumbs) + cols - 1) // cols
cell_h = max(t.height for t in thumbs)
sheet = Image.new("RGB", (cols * thumb_w, rows * cell_h), "#d7d7d7")
for idx, im in enumerate(thumbs):
    x = (idx % cols) * thumb_w
    y = (idx // cols) * cell_h
    sheet.paste(im, (x, y))
output.parent.mkdir(parents=True, exist_ok=True)
sheet.save(output, quality=88)
