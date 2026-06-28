# DSH-16 — remove a solid background of ANY color by flood-filling inward from the
# image edges, producing a true-alpha transparent PNG. Used to cut the figure assets
# (generated on a flat chroma background, since gpt-image-2 won't emit transparency).
#
# Auto-detects the background color from the border, or pass it with --bg R,G,B.
# Interior regions matching the bg color are preserved unless connected to the border.
#
# Usage: py scripts/remove-bg.py <in.png> <out.png> [thresh] [--bg R,G,B] [--global] [--preview]
#   thresh: tolerance (default 60; raise if a fringe remains, lower if it eats the subject)
#   --global: remove the bg color EVERYWHERE (not just edge-connected). Use when the
#             subject contains none of the bg color (e.g. a chroma-green key) so even
#             pockets trapped between fingers/limbs are cleared.
import sys
from PIL import Image, ImageDraw
import numpy as np

args = sys.argv[1:]
inp, outp = args[0], args[1]
thresh = 60
bg = None
use_global = "--global" in args
for i, a in enumerate(args[2:], start=2):
    if a == "--bg" and i + 1 < len(args):
        bg = tuple(int(x) for x in args[i + 1].split(","))
    elif a.startswith("--bg="):
        bg = tuple(int(x) for x in a.split("=", 1)[1].split(","))
    elif a.isdigit():
        thresh = int(a)

img = Image.open(inp).convert("RGB")
W, H = img.size

# Auto-detect background color = median of the border pixels.
if bg is None:
    arr0 = np.array(img)
    border = np.concatenate([arr0[0, :, :], arr0[-1, :, :], arr0[:, 0, :], arr0[:, -1, :]])
    bg = tuple(int(v) for v in np.median(border, axis=0))

if use_global:
    # Distance-key: remove every pixel within `thresh` RGB distance of bg, everywhere.
    arr = np.array(img)
    dist = np.sqrt(((arr.astype(int) - np.array(bg)) ** 2).sum(axis=-1))
    mask = dist <= thresh
else:
    SENT = (255, 0, 255) if bg != (255, 0, 255) else (0, 255, 0)  # sentinel != bg

    def matches(px, ref, tol):
        return all(abs(px[i] - ref[i]) <= tol for i in range(3))

    seeds = [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1),
             (W // 2, 0), (W // 2, H - 1), (0, H // 2), (W - 1, H // 2)]
    for s in seeds:
        if matches(img.getpixel(s), bg, thresh):
            ImageDraw.floodfill(img, s, SENT, thresh=thresh)

    arr = np.array(img)
    mask = np.all(arr == np.array(SENT), axis=-1)
alpha = np.where(mask, 0, 255).astype(np.uint8)
rgba = np.dstack([arr, alpha])
rgba[mask] = [0, 0, 0, 0]
Image.fromarray(rgba, "RGBA").save(outp)
print(f"wrote {outp}  bg={bg}  transparent={int(mask.sum())}px ({100 * mask.mean():.1f}%)")

if "--preview" in args:
    fg = Image.fromarray(rgba, "RGBA")
    for name, c in [("ink", (10, 10, 10)), ("card", (24, 24, 27)), ("grey", (155, 155, 155))]:
        canvas = Image.new("RGB", (W, H), c)
        canvas.paste(fg, (0, 0), fg)
        p = outp.replace(".png", f"_on_{name}.jpg")
        canvas.save(p, quality=85)
        print("preview", p)
