"""
Generate the Flex app icon as PNG + ICO.
Draws a Rolleiflex-style TLR camera mark on a gradient background.
"""
import math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = Path(__file__).parent.parent / "assets"
OUT_DIR.mkdir(exist_ok=True)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = img.load()

    # ── Gradient fill (135° amber → amber-dim) ────────────────────────────
    # amber: (255, 140, 0)  amber-dim: (180, 90, 0)
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            r = int(255 * (1 - t) + 180 * t)
            g = int(140 * (1 - t) + 90  * t)
            b = 0
            pixels[x, y] = (r, g, b, 255)

    # ── Rounded-corner mask ───────────────────────────────────────────────
    radius = size // 5
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)
    w = (255, 255, 255, 235)   # white stroke colour
    lw = max(1, round(size * 0.048))  # line width

    # Scale: icon is 18×22 units mapped into `size` pixels
    # We'll centre a 18:22 ratio shape in the square icon
    cam_w = size * 0.62   # camera body width
    cam_h = size * 0.76   # camera body height
    cx    = size / 2
    cy    = size / 2 + size * 0.01
    x0    = cx - cam_w / 2
    y0    = cy - cam_h / 2
    x1    = cx + cam_w / 2
    y1    = cy + cam_h / 2
    br    = size * 0.09   # body border radius

    # ── Camera body ───────────────────────────────────────────────────────
    draw.rounded_rectangle([x0, y0, x1, y1], radius=br, outline=w, width=lw)

    # ── Viewing hood (top section fill) ───────────────────────────────────
    hood_h = cam_h * 0.17
    draw.rounded_rectangle(
        [x0 + lw/2, y0 + lw/2, x1 - lw/2, y0 + hood_h],
        radius=br * 0.8,
        fill=(255, 255, 255, 28),
        outline=None,
    )
    # hood bottom line
    draw.line([(x0 + lw, y0 + hood_h), (x1 - lw, y0 + hood_h)],
              fill=(255, 255, 255, 80), width=max(1, lw // 2))

    # ── Viewing lens (top, smaller) ───────────────────────────────────────
    vl_cy  = y0 + cam_h * 0.375
    vl_r   = cam_w * 0.275
    vl_box = [cx - vl_r, vl_cy - vl_r, cx + vl_r, vl_cy + vl_r]
    draw.ellipse(vl_box, outline=w, width=lw)
    # inner glass
    vl_ri = vl_r * 0.52
    draw.ellipse([cx - vl_ri, vl_cy - vl_ri, cx + vl_ri, vl_cy + vl_ri],
                 fill=(255, 255, 255, 55))
    # specular highlight
    hl = max(1, round(size * 0.022))
    draw.ellipse([cx + vl_r*0.25, vl_cy - vl_r*0.4,
                  cx + vl_r*0.25 + hl*2, vl_cy - vl_r*0.4 + hl*2],
                 fill=(255, 255, 255, 210))

    # ── Taking lens (bottom, larger) ──────────────────────────────────────
    tl_cy  = y0 + cam_h * 0.73
    tl_r   = cam_w * 0.34
    tl_box = [cx - tl_r, tl_cy - tl_r, cx + tl_r, tl_cy + tl_r]
    draw.ellipse(tl_box, outline=w, width=lw)
    # inner glass
    tl_ri = tl_r * 0.54
    draw.ellipse([cx - tl_ri, tl_cy - tl_ri, cx + tl_ri, tl_cy + tl_ri],
                 fill=(255, 255, 255, 55))
    # specular highlight
    hl2 = max(1, round(size * 0.027))
    draw.ellipse([cx + tl_r*0.22, tl_cy - tl_r*0.38,
                  cx + tl_r*0.22 + hl2*2, tl_cy - tl_r*0.38 + hl2*2],
                 fill=(255, 255, 255, 210))

    # ── Side winding knobs ────────────────────────────────────────────────
    kw = max(2, round(size * 0.06))
    kh = max(4, round(size * 0.16))
    ky = cy - kh / 2 + size * 0.04
    # left
    draw.rounded_rectangle([x0 - kw, ky, x0 - 1, ky + kh],
                            radius=max(1, kw // 2),
                            fill=(255, 255, 255, 180))
    # right
    draw.rounded_rectangle([x1 + 1, ky, x1 + kw, ky + kh],
                            radius=max(1, kw // 2),
                            fill=(255, 255, 255, 180))

    return img


SIZES = [16, 32, 48, 64, 128, 256]
icons = [make_icon(s) for s in SIZES]

icons[-1].save(OUT_DIR / "icon.png")
print(f"Saved {OUT_DIR / 'icon.png'}")

icons[-1].save(
    OUT_DIR / "icon.ico",
    format="ICO",
    sizes=[(s, s) for s in SIZES],
    append_images=icons[:-1],
)
print(f"Saved {OUT_DIR / 'icon.ico'}")
