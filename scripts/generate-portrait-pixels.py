"""Build the hero's pixel portrait data from the brand avatar.

Cuts the character out of its dotted backdrop and reduces it to a small grid
of ink, dithered grey and two greens, in the manner of a one-bit print.
Usage: python scripts/generate-portrait-pixels.py /path/to/avatar.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

GRID = 144           # cells per side of the pixel portrait
WORK = 1152          # working resolution for the cut-out (GRID * 8)
POCKETS = ((785, 757), (854, 747), (950, 432))  # paper fenced in by hair and chain, at WORK resolution
EMPTY, INK, GREY, GREEN, LEAF, PAPER = range(6)  # cell classes; the page maps them to theme colours
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
seeds = np.zeros_like(paper)
seeds[0] = seeds[:, 0] = seeds[:, -1] = True
for x, y in POCKETS:
    seeds[y, x] = True
backdrop = flood(seeds, paper)
backdrop = spread(spread(backdrop))  # swallow the anti-aliased fringe

# Keep only the figure itself; this drops the handle lettered beside it.
centre = np.zeros_like(paper)
centre[WORK // 2, WORK // 2] = True
figure = flood(centre, ~backdrop)

# Gather each cell's pixels, then judge it by coverage, tone and hue.
block = WORK // GRID


def cells(values):
    return values.reshape(GRID, block, GRID, block).transpose(0, 2, 1, 3).reshape(GRID, GRID, -1)


inside = cells(figure)
solid = inside.mean(axis=2) > .5
count = np.maximum(inside.sum(axis=2), 1)
red, green, blue = (np.where(inside, cells(work[..., c]), 0).sum(axis=2) / count for c in range(3))
tone = (red + green + blue) / 3
lines = (cells(luminance < 32) & inside).sum(axis=2) / count   # share of line art in the cell
leafy = (green > red * 1.22) & (green > blue * 1.12) & (green - np.minimum(red, blue) > 14)

rows, columns = np.indices((GRID, GRID))
checker = (rows + columns) % 2 == 0
sparse = (rows % 2 == 0) & (columns % 2 == 0)


def shade(where, pattern, value):
    grid[where & pattern] = value


grid = np.full((GRID, GRID), PAPER, np.uint8)
shade((tone >= 125) & (tone < 200), sparse, GREY)      # light tones: scattered grey
shade((tone >= 70) & (tone < 125), checker, INK)       # mid tones: checkerboard
shade((tone >= 34) & (tone < 70), checker | sparse, INK)  # dark tones: mostly ink
grid[(tone < 34) | (lines > .33)] = INK
grid[leafy & (tone >= 34)] = GREEN
shade(leafy & (tone >= 34) & (tone < 47), checker, INK)   # folds of the beanie
grid[leafy & (tone >= 90)] = LEAF
grid[leafy & (lines > .4)] = INK                          # ribs of the beanie
grid[~solid] = EMPTY

# One byte per cell: the class in the red channel, opaque inside the figure.
pixels = np.zeros((GRID, GRID, 4), np.uint8)
pixels[..., 0] = grid * 40
pixels[..., 3] = np.where(grid == EMPTY, 0, 255)
Image.fromarray(pixels, 'RGBA').save(assets / 'portrait-pixels.png', optimize=True)

# Static image for visitors without scripts.
source.resize((1000, 1000), Image.LANCZOS).save(assets / 'portrait.webp', quality=86, method=6)
for name in ('portrait-pixels.png', 'portrait.webp'):
    print(f'{name}: {(assets / name).stat().st_size:,} bytes')
print('Cells:', {label: int((grid == value).sum()) for label, value in (('ink', INK), ('grey', GREY), ('green', GREEN), ('leaf', LEAF))})
