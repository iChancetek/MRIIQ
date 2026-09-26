"""
Generate all PWA and web icon sizes from the generated MRI IQ image icon.
"""
from pathlib import Path
from PIL import Image

SRC_IMAGE = Path(r"C:\Users\chanc\.gemini\antigravity-ide\brain\d0da6ace-b18f-43be-bb12-38276294e58c\mriiq_pwa_icon_1790450322364.jpg")

REPO_ROOT = Path(__file__).resolve().parents[2]
DIRS_TO_POPULATE = [
    REPO_ROOT / "public",
    REPO_ROOT / "public" / "icons",
    REPO_ROOT / "frontend" / "public",
    REPO_ROOT / "frontend" / "public" / "icons",
]

for d in DIRS_TO_POPULATE:
    d.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC_IMAGE).convert("RGBA")

# Standard PWA and Web Icon targets
SIZES = {
    "icon-512x512.png": (512, 512),
    "icon-192x192.png": (192, 192),
    "apple-touch-icon.png": (180, 180),
    "favicon-32x32.png": (32, 32),
    "favicon-16x16.png": (16, 16),
    "icon.png": (512, 512),
}

for filename, size in SIZES.items():
    resized = img.resize(size, Image.Resampling.LANCZOS)
    for base_dir in [REPO_ROOT / "public" / "icons", REPO_ROOT / "frontend" / "public" / "icons"]:
        resized.save(base_dir / filename, format="PNG")
        print(f"Saved {base_dir / filename}")

# OpenGraph Social Card (1200x630)
og_canvas = Image.new("RGBA", (1200, 630), (10, 14, 23, 255))
# Place 550x550 logo in center of 1200x630
center_logo = img.resize((550, 550), Image.Resampling.LANCZOS)
x_offset = (1200 - 550) // 2
y_offset = (630 - 550) // 2
og_canvas.paste(center_logo, (x_offset, y_offset), center_logo)

for base_dir in [REPO_ROOT / "public" / "icons", REPO_ROOT / "frontend" / "public" / "icons"]:
    og_canvas.convert("RGB").save(base_dir / "og-image.png", format="PNG")
    print(f"Saved {base_dir / 'og-image.png'}")

# Save favicon.ico (multi-resolution 16, 32, 48)
ico_sizes = [(16, 16), (32, 32), (48, 48)]
for base_dir in [REPO_ROOT / "public", REPO_ROOT / "frontend" / "public"]:
    img.save(base_dir / "favicon.ico", format="ICO", sizes=ico_sizes)
    print(f"Saved {base_dir / 'favicon.ico'}")

# Also copy high-res icon to public root
for base_dir in [REPO_ROOT / "public", REPO_ROOT / "frontend" / "public"]:
    img.resize((512, 512), Image.Resampling.LANCZOS).save(base_dir / "apple-touch-icon.png", format="PNG")
    img.resize((192, 192), Image.Resampling.LANCZOS).save(base_dir / "icon.png", format="PNG")

print("All PWA icons successfully generated!")
