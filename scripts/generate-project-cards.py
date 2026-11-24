"""Build the tall cards for the projects wheel from each project's logo tile.

Each logo tile sits in the middle of a 2:3 card. The tile's own background is
carried on above and below it: a flat colour stays flat, and a gradient is
continued by fitting a plane to the tile's edge pixels.
Usage: python scripts/generate-project-cards.py
Reads the logos listed in the projects grid of dist/index.html and writes
dist/assets/cards/<logo name>.webp.
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

CARD_W, CARD_H = 400, 600   # 2:3, enough for a ~200px card on a 2x screen
TILE = .8                   # logo tile width as a share of the card width
EDGE = 3                    # some tiles carry a hairline at their edge; trim it
FEATHER = .1                # share of the tile, at its edge, blended into the background
dist = Path(__file__).resolve().parents[1] / 'dist'
html = (dist / 'index.html').read_text()
logos = re.findall(r'<a class="project"[^>]*>.*?<img src="(assets/[^"]+)"', html)
(dist / 'assets/cards').mkdir(exist_ok=True)

for logo in logos:
    tile = np.asarray(Image.open(dist / logo).convert('RGB')).astype(float)[EDGE:-EDGE, EDGE:-EDGE]
    h, w = tile.shape[:2]
    # Fit colour = a + b*u + c*v to the tile's border, in units of tile width.
    rows, cols = np.indices((h, w))
    edge = (rows < 2) | (rows >= h - 2) | (cols < 2) | (cols >= w - 2)
    u = (cols[edge] + .5) / w - .5
    v = (rows[edge] + .5) / w - h / w / 2
    basis = np.column_stack([np.ones_like(u), u, v])
    fit = np.linalg.lstsq(basis, tile[edge], rcond=None)[0]

    # Paint that plane across the card, then lay the tile over it with a soft edge.
    size = round(CARD_W * TILE)
    cy, cx = np.indices((CARD_H, CARD_W))
    # Hold the plane near the tile so a gradient doesn't run to extremes at the card's ends.
    cu = (((cx + .5) - CARD_W / 2) / size).clip(-.6, .6)
    cv = (((cy + .5) - CARD_H / 2) / size).clip(-.6, .6)
    card = (fit[0] + cu[..., None] * fit[1] + cv[..., None] * fit[2]).clip(0, 255)
    sharp = Image.fromarray(tile.astype(np.uint8)).resize((size, size), Image.LANCZOS)
    sharp = sharp.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    ty, tx = np.indices((size, size))
    reach = np.minimum.reduce([tx, ty, size - 1 - tx, size - 1 - ty]) / (size * FEATHER)
    alpha = np.clip(reach, 0, 1)[..., None]
    left, top = (CARD_W - size) // 2, (CARD_H - size) // 2
    patch = card[top:top + size, left:left + size]
    card[top:top + size, left:left + size] = patch * (1 - alpha) + np.asarray(sharp).astype(float) * alpha
    out = dist / 'assets/cards' / Path(logo).name
    Image.fromarray(card.round().astype(np.uint8)).save(out, quality=88, method=6)
    print(f'{out.relative_to(dist)}: {out.stat().st_size:,} bytes')
