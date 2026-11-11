"""Build the hero's pixel portrait data from the brand avatar.

Cuts the character out of its dotted backdrop and redraws it on a small grid
in four neutral tones and two greens. Thin features (line art, the glasses,
jewellery, piping, lettering) are kept deliberately rather than averaged away.
Usage: python scripts/generate-portrait-pixels.py /path/to/avatar.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

GRID = 192           # cells per side of the pixel portrait
BLOCK = 8            # source pixels examined per cell side
WORK = GRID * BLOCK  # working resolution
FEATURE = .2         # share of a cell a feature must cover to claim it
# Paper fenced in by hair and the glasses chain, as fractions of the image.
POCKETS = ((.6816, .6572), (.7412, .6484), (.8242, .3750))
# Cell classes; the page maps them to theme colours. SHADE is internal.
EMPTY, INK, DARK, LIGHT, PAPER, GREEN, LEAF, SHADE = range(8)
assets = Path(__file__).resolve().parents[1] / 'dist/assets'

source = Image.open(sys.argv[1]).convert('RGB')
work = np.asarray(source.resize((WORK, WORK), Image.LANCZOS)).astype(np.float32)
red, green, blue = work[..., 0], work[..., 1], work[..., 2]
luminance = .2126 * red + .7152 * green + .0722 * blue


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
for _ in range(4):
    backdrop = spread(backdrop)  # swallow the anti-aliased fringe

# Keep only the figure itself; this drops the handle lettered beside it.
centre = np.zeros_like(paper)
centre[WORK // 2, WORK // 2] = True
figure = flood(centre, ~backdrop)

# The avatar is flat-shaded, so every source pixel falls cleanly into a class.
leafy = (green > red * 1.2) & (green > blue * 1.1) & (green - np.minimum(red, blue) > 18)
classes = np.full(luminance.shape, PAPER, np.uint8)
classes[luminance < 205] = LIGHT                                       # silver, hair highlights
classes[luminance < 125] = DARK                                        # shaded silver
classes[luminance < 50] = INK                                          # line art, clothing, the book
classes[(luminance >= 50) & (luminance < 125) & (red - blue > 12)] = INK  # hair: a black mass with light strands
classes[(luminance > 150) & (luminance < 215) & (red - green > 22)] = SHADE  # shadows on skin
classes[leafy & (luminance >= 24)] = GREEN
classes[leafy & (luminance >= 110) & (green - np.maximum(red, blue) > 50)] = LEAF
classes[~figure] = EMPTY


def cells(values):
    return values.reshape(GRID, BLOCK, GRID, BLOCK).transpose(0, 2, 1, 3).reshape(GRID, GRID, -1)


cell_classes, cell_tones = cells(classes), cells(luminance)
counts = np.stack([(cell_classes == kind).sum(axis=2) for kind in range(8)], axis=2).astype(np.float32)
inside = BLOCK * BLOCK - counts[..., EMPTY]
# What surrounds each cell: the commonest class across it and its neighbours.
padded = np.pad(counts, ((1, 1), (1, 1), (0, 0)))
around = sum(padded[dy:dy + GRID, dx:dx + GRID] for dy in range(3) for dx in range(3))
around[..., EMPTY] = 0
setting = around.argmax(axis=2)
broad_shade = around[..., SHADE] > around.sum(axis=2) * .3   # dither only real areas of shadow

grid = np.zeros((GRID, GRID), np.uint8)
for row in range(GRID):
    for column in range(GRID):
        if inside[row, column] <= BLOCK * BLOCK * .5:
            continue
        kinds, tones = cell_classes[row, column], cell_tones[row, column]
        # A feature is whatever differs from the surroundings. If it covers
        # enough of the cell it wins, so a thin stroke becomes a line of cells.
        feature = (kinds != EMPTY) & (kinds != setting[row, column])
        if feature.sum() / inside[row, column] >= FEATURE:
            kinds, tones = kinds[feature], tones[feature]
            greens = np.isin(kinds, (GREEN, LEAF))
            if greens.mean() > .5:
                choice = LEAF if tones[greens].mean() >= 110 else GREEN
            elif (kinds == SHADE).mean() > .6:
                choice = SHADE
            else:
                tone = tones[~greens].mean()   # an outlined silver rim averages to a mid grey
                choice = INK if tone < 50 else DARK if tone < 125 else LIGHT if tone < 205 else PAPER
        else:
            tally = counts[row, column].copy()
            tally[EMPTY] = 0
            choice = tally.argmax()
        if choice == SHADE:
            choice = (LIGHT if (row + column) % 2 == 0 else PAPER) if broad_shade[row, column] else PAPER
        grid[row, column] = choice

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
