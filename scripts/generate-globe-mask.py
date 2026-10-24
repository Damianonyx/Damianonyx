"""Build the globe's local land mask from public-domain Natural Earth data.
Source: https://github.com/datasets/geo-countries (ODC-PDDL).
Usage: python scripts/generate-globe-mask.py /path/to/countries.geojson
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

width, height = 1800, 900
mask = Image.new('L', (width, height))
draw = ImageDraw.Draw(mask)
for feature in json.loads(Path(sys.argv[1]).read_text())['features']:
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        for index, ring in enumerate(polygon):
            points = [((lon + 180) / 360 * (width - 1), (90 - lat) / 180 * (height - 1)) for lon, lat, *_ in ring]
            draw.polygon(points, fill=255 if index == 0 else 0)
output = Path(__file__).resolve().parents[1] / 'dist/assets/globe-land.png'
mask.save(output, optimize=True)
print(f'Land mask: {output.stat().st_size:,} bytes')
