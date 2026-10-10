from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "playwright" / "stage3" / "visual-audit"
OUTPUT.mkdir(parents=True, exist_ok=True)


GROUPS = {
    "three-contact-sheet.jpg": [
        ROOT / "output" / "playwright" / "stage3" / "three" / f"{index:02d}-{name}.png"
        for index, name in enumerate([
            "overview", "door", "side", "top", "forklift-pickup", "forklift-entering",
            "forklift-placed", "manual-pickup", "manual-carrying", "manual-entering",
            "manual-placed", "filter-by-port", "filter-by-actor", "filter-by-batch",
            "speed-16x", "group-expanded", "blocked"
        ], start=1)
    ],
    "compliance-contact-sheet.jpg": [
        ROOT / "output" / "playwright" / "stage3" / "compliance" / name
        for name in [
            "01-vgm-evidence.png", "02-ctu-evidence.png", "03-ippc-evidence.png",
            "04-rule-highlight.png", "05-ai-explanation.png", "06-manual-review.png"
        ]
    ],
    "responsive-contact-sheet.jpg": [
        ROOT / "output" / "playwright" / "final" / f"{viewport}-{route}.png"
        for viewport in ["1920x1080", "1672x941", "1280x720"]
        for route in ["dashboard", "cargo", "container", "twin", "compliance", "report"]
    ],
    "negative-contact-sheet.jpg": [
        ROOT / "output" / "playwright" / "ui-states" / name
        for name in [
            "01-packing-500.png", "02-packing-timeout.png", "03-ai-500.png", "04-pdf-missing.png",
            "05-vlm-unavailable.png", "06-download-build-failure.png", "07-corrupt-session-recovery.png",
            "08-three-no-plan.png", "09-three-filter-no-results.png", "10-manual-missing-attributes.png",
            "11-forklift-door-blocked.png", "12-manual-oversized.png"
        ]
    ]
}


def build_sheet(name: str, files: list[Path]) -> dict:
    missing = [str(file) for file in files if not file.exists()]
    if missing:
        raise FileNotFoundError(f"Missing screenshots for {name}: {missing}")
    columns = 4 if len(files) > 6 else 3
    tile_width = 420
    image_height = 236
    label_height = 30
    gap = 12
    rows = (len(files) + columns - 1) // columns
    sheet = Image.new("RGB", (
        gap + columns * (tile_width + gap),
        gap + rows * (image_height + label_height + gap)
    ), "#dfe5e1")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=15)
    entries = []
    for index, file in enumerate(files):
        with Image.open(file) as source:
            image = ImageOps.contain(source.convert("RGB"), (tile_width, image_height), Image.Resampling.LANCZOS)
            x = gap + (index % columns) * (tile_width + gap)
            y = gap + (index // columns) * (image_height + label_height + gap)
            backdrop = Image.new("RGB", (tile_width, image_height), "white")
            backdrop.paste(image, ((tile_width - image.width) // 2, (image_height - image.height) // 2))
            sheet.paste(backdrop, (x, y))
            draw.rectangle((x, y, x + tile_width - 1, y + image_height - 1), outline="#71827a", width=1)
            draw.text((x + 5, y + image_height + 6), file.name, fill="#17382f", font=font)
            entries.append({"name": file.name, "width": source.width, "height": source.height, "bytes": file.stat().st_size})
    target = OUTPUT / name
    sheet.save(target, "JPEG", quality=88, optimize=True)
    return {"sheet": str(target), "bytes": target.stat().st_size, "screenshots": entries}


def main() -> None:
    manifest = {name: build_sheet(name, files) for name, files in GROUPS.items()}
    (OUTPUT / "contact-sheet-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()

