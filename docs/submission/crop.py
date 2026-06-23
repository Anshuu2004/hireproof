"""Crop the Edge browser chrome (top) + Windows taskbar (bottom) off the three
full-screen *windowed* captures. The other figures are already either full-screen
app captures (04, 05) or tight crops (01, 07-11), so they are left untouched.

All three windowed shots share the same geometry at 1920x1080 (dark-mode Edge):
top chrome (tab strip + address bar) ends at y=101; the Windows taskbar is the
bottom 48px. Crop box keeps rows 101..1031 — the full app, no chrome, no taskbar.

  python crop.py            # back up originals -> _orig/, crop in place
"""
import os
from PIL import Image

CROP = {
    "02-task-gen.png":    (0, 101, 1920, 1019),
    "03-secured-gate.png": (0, 101, 1920, 1019),
    "06-ledger.png":      (0, 101, 1920, 1019),
}

here = os.path.dirname(os.path.abspath(__file__))
shots = os.path.join(here, "screenshots")
orig = os.path.join(shots, "_orig")
os.makedirs(orig, exist_ok=True)

for name, box in CROP.items():
    p = os.path.join(shots, name)
    im = Image.open(p)
    backup = os.path.join(orig, name)
    if not os.path.exists(backup):
        im.save(backup)               # keep the untouched original
    src = Image.open(backup)          # always crop from the pristine original
    out = src.crop(box)
    out.save(p)
    print(f"{name:22s} {src.size[0]}x{src.size[1]} -> {out.size[0]}x{out.size[1]}")
print("done")
