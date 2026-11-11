"""Build the hero's pixel portrait data from the brand avatar.

Cuts the character out of its dotted backdrop, reduces it to a small grid of
flat colours and draws the waving forearm sprite the page animates.
Usage: python scripts/generate-portrait-pixels.py /path/to/avatar.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

GRID = 128           # cells per side of the pixel portrait
WORK = 1024          # working resolution for the cut-out (GRID * 8)
COLOURS = 28         # flat colours kept in the portrait
POCKETS = ((698, 673), (759, 664), (844, 384))  # at WORK resolution
assets = Path(__file__).resolve().parents[1] / 'dist/assets'

source = Image.open(sys.argv[1]).convert('RGB')
work = np.asarray(source.resize((WORK, WORK), Image.LANCZOS)).astype(np.int16)


def spread(mask):
    """Grow a mask by one pixel in the four cardinal directions."""
    grown = mask.copy()
    grown[1:] |= mask[:-1]
    grown[:-1] |= mask[1:]
    grown[:, 1:] |= mask[:, :-1]
    grown[:, :-1] |= mask[:, 1:]
    return grown


def flood(seeds, passable):
    reached = seeds & passable
    while True:
        grown = spread(reached) & passable
        if (grown == reached).all():
            return reached
        reached = grown


# The backdrop is cream paper with grey halftone dots: bright and unsaturated.
# Flood from the top and side edges so enclosed skin and silver stay put.
luminance = work.mean(axis=2)
chroma = work.max(axis=2) - work.min(axis=2)
paper = (chroma < 30) & (luminance > 105)
edges = np.zeros_like(paper)
edges[0] = edges[:, 0] = edges[:, -1] = True
# A few pockets of paper are fenced in by hair and the glasses chain; seed those as well.
for x, y in POCKETS:
    edges[y, x] = True
backdrop = flood(edges, paper)
backdrop = spread(spread(backdrop))  # swallow the anti-aliased fringe

# Keep only the figure itself; this drops the handle lettered beside it.
centre = np.zeros_like(paper)
centre[WORK // 2, WORK // 2] = True
figure = flood(centre, ~backdrop)

# Reduce to the grid. A cell belongs to the figure when most of it is covered.
block = WORK // GRID
cells = work.reshape(GRID, block, GRID, block, 3).transpose(0, 2, 1, 3, 4).reshape(GRID, GRID, -1, 3)
cover = figure.reshape(GRID, block, GRID, block).transpose(0, 2, 1, 3).reshape(GRID, GRID, -1)
weight = cover[..., None].astype(float)
mean = (cells * weight).sum(axis=2) / np.maximum(weight.sum(axis=2), 1)
# Pull each cell toward its darkest pixels so line art survives the reduction.
dark = np.sort(cells.mean(axis=3), axis=2)[:, :, block * block // 5]
lit = mean.mean(axis=2)
mean *= (np.clip(dark / np.maximum(lit, 1), .0, 1) * .3 + .7)[..., None]
solid = cover.mean(axis=2) > .5

flat = Image.fromarray(mean.clip(0, 255).astype(np.uint8)).quantize(COLOURS, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
pixels = np.dstack([np.asarray(flat), np.where(solid, 255, 0).astype(np.uint8)])
pixels[~solid] = 0
Image.fromarray(pixels, 'RGBA').save(assets / 'portrait-pixels.png', optimize=True)

# The waving forearm: an open hand, a silver cuff and a black sleeve, drawn
# cell by cell. The page rotates it about the bottom-centre cell.
SKIN, SHADE, LINE, CUFF, CLOTH, TRIM = (255, 236, 228), (232, 196, 188), (12, 16, 13), (196, 200, 198), (24, 30, 26), (120, 128, 124)
W, H = 21, 56
arm = np.zeros((H, W, 4), np.uint8)
skin = np.zeros((H, W), bool)
for left, top in ((2, 6), (6, 3), (10, 2), (14, 4)):   # little, ring, middle, index
    skin[top:14, left:left + 3] = True
    skin[top, left] = skin[top, left + 2] = False        # rounded fingertips
skin[13:23, 2:17] = True                                 # palm
skin[22, 2] = skin[22, 16] = skin[21, 2] = False
for row, (start, end) in enumerate(((18, 20), (17, 20), (17, 20), (16, 19), (16, 19), (16, 18), (16, 18)), 10):
    skin[row, start:end] = True                          # thumb
skin[23:25, 5:14] = True                                 # wrist
outline = skin.copy()
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        outline |= np.roll(np.roll(skin, dy, 0), dx, 1)
arm[outline] = (*LINE, 255)
arm[skin] = (*SKIN, 255)
arm[21:23, 4:15] = (*SHADE, 255)                         # heel of the palm
arm[17:19, 13:16] = (*SHADE, 255)                        # base of the thumb
arm[25:30, 2:17] = (*CUFF, 255)
arm[25:30, 2] = arm[25:30, 16] = arm[25, 2:17] = arm[29, 2:17] = (*LINE, 255)
arm[30:, 2:17] = (*CLOTH, 255)
arm[30:, 2] = arm[30:, 16] = (*LINE, 255)
arm[32:, 5] = (*TRIM, 255)                               # jacket piping
Image.fromarray(arm, 'RGBA').save(assets / 'portrait-wave.png', optimize=True)

# Static image for visitors without scripts, and a quick visual check.
source.resize((1000, 1000), Image.LANCZOS).save(assets / 'portrait.webp', quality=86, method=6)
for name in ('portrait-pixels.png', 'portrait-wave.png', 'portrait.webp'):
    print(f'{name}: {(assets / name).stat().st_size:,} bytes')
print(f'Figure cells: {int(solid.sum()):,}')
