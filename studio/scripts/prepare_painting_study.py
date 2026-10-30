"""Prepare local-only review images from the owner's SVG export; originals stay intact.
Run with Python + Pillow. Outputs remain inside the gitignored _design folder.
"""
from pathlib import Path
import base64
import copy
import io
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '_design/mockups/asset-review'
OUT.mkdir(exist_ok=True)
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
source = ET.parse(ROOT / '_design/mockups/01-default-blank-canvas.svg').getroot()
# Crop boxes use the owner's artboard coordinates, including the overhanging handles.
regions = {
    'acrylic-paint-pallette': ('acrylic', (0, 0, 320, 230)),
    'pastels': ('pastel', (0, 460, 230, 200)),
    'charcoal': ('charcoal', (0, 630, 240, 205)),
    'airbrush': ('airbrush', (1280, 225, 255, 170)),
    'pencils': ('pencil', (785, 810, 205, 280)),
    'detail-brush': ('detail', (1300, 370, 240, 230)),
    'fan-brush': ('fan', (1280, 610, 250, 235)),
    'flat-brush': ('flat', (1220, 740, 340, 340)),
    'round-brush': ('round', (1300, 485, 220, 205)),
    'palette-knives': ('knife', (965, 805, 230, 290)),
    'acrylic-paint-save-and-mixing': ('tray', (0, 190, 200, 180)),
    'sponge': ('sponge', (175, 860, 170, 175)),
    'water': ('water', (0, 800, 170, 220)),
    'eraser': ('eraser', (120, 895, 125, 125)),
    'sponge-brush': ('foam', (1140, 855, 200, 240)),
    'watercolor-pallete': ('watercolor', (350, 845, 430, 170)),
}

def inline_webp(group):
    for element in group.iter():
        if not element.tag.endswith('image'):
            continue
        key = next(k for k in element.attrib if k.endswith('href'))
        payload = element.attrib[key].split(',', 1)[1]
        image = Image.open(io.BytesIO(base64.b64decode(payload)))
        encoded = io.BytesIO()
        image.save(encoded, 'WEBP', quality=90, method=6)
        element.set(key, 'data:image/webp;base64,' + base64.b64encode(encoded.getvalue()).decode())

for group in source:
    name = group.attrib.get('class', '').removeprefix('layer-')
    if name not in regions:
        continue
    target, (x, y, width, height) = regions[name]
    svg = ET.Element('{'+NS+'}svg', {'viewBox':f'{x} {y} {width} {height}', 'width':str(width), 'height':str(height)})
    # First child is the rough underlay; the remaining groups hold the original cutouts.
    for child in list(group)[1:]:
        photo = copy.deepcopy(child)
        inline_webp(photo)
        svg.append(photo)
    ET.ElementTree(svg).write(OUT / f'study-{target}.svg', encoding='unicode')

wood = next(e for e in source.iter() if e.tag.endswith('image'))
key = next(k for k in wood.attrib if k.endswith('href'))
image = Image.open(io.BytesIO(base64.b64decode(wood.attrib[key].split(',',1)[1])))
image.save(OUT / 'study-wood.webp', 'WEBP', quality=90, method=6)

# Retain the owner's exported surface noise rather than a CSS weave that can form moiré.
canvas = next(group for group in source if group.attrib.get('class') == 'layer-anvas')
surface = ET.Element('{'+NS+'}svg', {'viewBox': '269.85 193.13 974 519', 'preserveAspectRatio': 'none'})
surface.append(copy.deepcopy(source.find('{'+NS+'}defs')))
surface.append(copy.deepcopy(list(canvas)[0]))
ET.ElementTree(surface).write(OUT / 'study-surface.svg', encoding='unicode')
print(f'Prepared {len(regions)} cutout groups and wood texture in {OUT}')
