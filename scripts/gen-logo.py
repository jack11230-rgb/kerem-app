"""Generate Kerem brand assets from the official logo (public/brand/kerem-logo-original.png).

The source is a small (92x92) raster: gold line art on a light background. Upscaling it
directly is blurry, so we extract the gold strokes as an alpha mask (by colour saturation),
upscale the mask with Lanczos, re-sharpen the edges with a smoothstep curve, and re-colour it
with a clean gold gradient. Outputs:
  public/brand/kerem-mark.png      transparent gold mark for the dark UI (header, login, join)
  public/brand/kerem-logo.png      the mark on cream, square (for sharing / light contexts)
  public/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
  public/favicon.png (48), public/favicon.ico (16/32/48)
Run: python3 scripts/gen-logo.py   (needs Pillow + numpy)
"""
from PIL import Image, ImageFilter
import numpy as np

SRC = 'public/brand/kerem-logo-original.png'
CREAM = (243, 234, 216)  # --cream

# Strokes are darker than the paper: alpha = how much darker than the local background.
# (Colour saturation is unusable: the source has heavy JPEG chroma smearing.)
grey = Image.open(SRC).convert('L')
paper = grey.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(3))
darker = np.asarray(paper, np.float32) - np.asarray(grey, np.float32)
alpha = np.clip((darker - 26) / 52, 0, 1)
ys, xs = np.where(alpha > 0.35)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
alpha = alpha[max(0, y0 - 2):y1 + 2, max(0, x0 - 2):x1 + 2]
H, W = alpha.shape

def smooth(a, lo, hi):
    t = np.clip((a - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)

def mask(height):
    """Mark alpha at a given pixel height, edges re-sharpened."""
    w = round(W * height / H)
    big = Image.fromarray((alpha * 255).astype(np.uint8)).resize((w * 2, height * 2), Image.LANCZOS)
    big = big.filter(ImageFilter.GaussianBlur(height / 160))
    a = smooth(np.asarray(big, np.float32) / 255, 0.30, 0.60)
    return Image.fromarray((a * 255).astype(np.uint8)).resize((w, height), Image.LANCZOS)

def colourise(m, c1, c2):
    w, h = m.size
    yy, xx = np.mgrid[0:h, 0:w]
    t = ((xx / max(w - 1, 1)) + (yy / max(h - 1, 1))) / 2
    rgb = np.stack([c1[i] + (c2[i] - c1[i]) * t for i in range(3)], -1).astype(np.uint8)
    out = Image.fromarray(rgb).convert('RGBA'); out.putalpha(m); return out

LIGHT = ((236, 211, 146), (196, 158, 78))   # for the navy UI
DARK = ((190, 152, 70), (150, 116, 44))     # for cream tiles

mark = colourise(mask(360), *LIGHT); mark.save('public/brand/kerem-mark.png', optimize=True)
print('mark', mark.size)

def tile(size, fill, rounded=False):
    bg = Image.new('RGBA', (size, size), CREAM + (255,))
    # soft vignette like the original paper texture
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.sqrt(((xx - size / 2) / size) ** 2 + ((yy - size * .42) / size) ** 2)
    shade = (1 - np.clip(d * 0.16, 0, .08))[..., None]
    arr = (np.asarray(bg, np.float32)[..., :3] * shade).astype(np.uint8)
    bg = Image.fromarray(arr).convert('RGBA')
    h = round(size * fill)
    m = colourise(mask(h), *DARK)
    bg.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return bg.convert('RGB')

tile(1024, .78).save('public/brand/kerem-logo.png', optimize=True)
tile(192, .78).save('public/icons/icon-192.png', optimize=True)
tile(512, .78).save('public/icons/icon-512.png', optimize=True)
tile(512, .56).save('public/icons/maskable-512.png', optimize=True)   # inside the 80% safe zone
tile(180, .76).save('public/icons/apple-touch-icon.png', optimize=True)
fav = tile(256, .86)
fav.resize((48, 48), Image.LANCZOS).save('public/favicon.png', optimize=True)
fav.save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('icons ok')
