"""Build the hero's pixel portrait data from the brand avatar.

Cuts the character out of its dotted backdrop, shrinks it smoothly to a small
grid and sorts each cell by brightness into ink, two greys or paper, the way
the site's first portrait was sampled. The beanie and eyes keep their green.
Usage: python scripts/generate-portrait-pixels.py /path/to/avatar.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

GRID = 144           # cells per side of the pixel portrait
BLOCK = 8            # source pixels averaged per cell side
WORK = GRID * BLOCK  # working resolution
# Paper fenced in by hair and the glasses chain, as fractions of the image.
POCKETS = ((.6816, .6572), (.7412, .6484), (.8242, .3750))
# Cell classes; the page maps them to theme colours.
EMPTY, INK, DARK, LIGHT, PAPER, GREEN, LEAF = range(7)
assets = Path(__file__).resolve().parents[1] / 'dist/assets'

source = Image.open(sys.argv[1]).convert('RGB')
work = np.asarray(source.resize((WORK, WORK), Image.LANCZOS)).astype(np.float32)


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
paper = (work.max(axis=2) - work.min(axis=2) < 30) & (work.mean(axis=2) > 105)
seeds = np.zeros_like(paper)
seeds[0] = seeds[:, 0] = seeds[:, -1] = True
for x, y in POCKETS:
    column, row = int(x * WORK), int(y * WORK)
    seeds[row - 3:row + 4, column - 3:column + 4] = True
backdrop = flood(seeds, paper)
for _ in range(3):
    backdrop = spread(backdrop)  # swallow the anti-aliased fringe

# Keep only the figure itself; this drops the handle lettered beside it.
centre = np.zeros_like(paper)
centre[WORK // 2, WORK // 2] = True
figure = flood(centre, ~backdrop)


def cells(values):
    return values.reshape(GRID, BLOCK, GRID, BLOCK).transpose(0, 2, 1, 3).reshape(GRID, GRID, -1)


# Average each cell over the figure's own pixels. Averaging is what gives the
# print its soft edges: a line crossing a cell leaves a grey, not a hard step.
inside = cells(figure)
cover = inside.mean(axis=2)
count = np.maximum(inside.sum(axis=2), 1)
red, green, blue = (np.where(inside, cells(work[..., channel]), 0).sum(axis=2) / count for channel in range(3))
luminance = .2126 * red + .7152 * green + .0722 * blue
leafy = (green > red * 1.15) & (green > blue * 1.08) & (green - np.minimum(red, blue) > 12)
rows, columns = np.indices((GRID, GRID))

grid = np.full((GRID, GRID), PAPER, np.uint8)
grid[(luminance < 205) & ((rows + columns) % 2 == 0)] = LIGHT   # lightest tone is a checkerboard
grid[luminance < 130] = DARK
grid[luminance < 65] = INK
grid[leafy & (luminance >= 30)] = GREEN
grid[leafy & (luminance >= 105) & (green - np.maximum(red, blue) > 40) & (cover > .95)] = LEAF  # the eyes, not edge fringe
grid[cover < .5] = EMPTY

# One byte per cell: the class in the red channel, opaque inside the figure.
pixels = np.zeros((GRID, GRID, 4), np.uint8)
pixels[..., 0] = grid * 40
pixels[..., 3] = np.where(grid == EMPTY, 0, 255)
Image.fromarray(pixels, 'RGBA').save(assets / 'portrait-pixels.png', optimize=True)

# Static image for visitors without scripts.
source.resize((1000, 1000), Image.LANCZOS).save(assets / 'portrait.webp', quality=86, method=6)
for name in ('portrait-pixels.png', 'portrait.webp'):
    print(f'{name}: {(assets / name).stat().st_size:,} bytes')
names = ('ink', 'dark', 'light', 'paper', 'green', 'leaf')
print('Cells:', {name: int((grid == kind).sum()) for name, kind in zip(names, (INK, DARK, LIGHT, PAPER, GREEN, LEAF))})
