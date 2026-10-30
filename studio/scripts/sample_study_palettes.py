"""Rebuild the local painting-study swatches from the owner's unchanged photos.

Run with Python + Pillow. Coordinates use a 1280-square reference for square assets (1536 x 1024 for
watercolor), scaled to the original PNG size before sampling. Each
color is the median RGB of an 11 x 11 patch. These are photographic appearance
samples, not pigment identities, calibrated paint colors, or a mixing model.
"""
from pathlib import Path
from statistics import median
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / '_design/artist-tools'
# Bottle centers avoid caps, wood, and the most obvious splatters. Despite its
# filename, the acrylic photo shows 19 bottles, not 24 separately visible colors.
ACRYLIC = [
    ('Warm white', 170, 423), ('Golden yellow', 305, 450),
    ('Bright orange', 439, 425), ('Red orange', 584, 358),
    ('Brick red', 686, 409), ('Deep magenta', 775, 339),
    ('Bright pink', 873, 441), ('Deep violet blue', 913, 307),
    ('Soft lavender', 1029, 386), ('Deep blue', 205, 801),
    ('Bright blue', 314, 817), ('Turquoise', 423, 791),
    ('Deep teal', 500, 751), ('Olive green', 607, 756),
    ('Dark olive', 712, 746), ('Golden ochre', 827, 709),
    ('Rust brown', 931, 670), ('Deep brown', 1027, 652),
    ('Soft black', 1131, 632),
]
WATERCOLOR_NAMES = [
    'Pale lemon', 'Bright yellow', 'Golden yellow', 'Earth yellow', 'Amber',
    'Orange', 'Burnt red', 'Scarlet', 'Deep red', 'Wine', 'Dark plum', 'Rose',
    'Deep violet', 'Bright blue', 'Cobalt blue', 'Navy', 'Blue teal', 'Turquoise',
    'Deep green', 'Forest green', 'Olive', 'Lime', 'Dark olive', 'Warm brown',
    'Red brown', 'Earth red', 'Deep brown', 'Brown black', 'Ochre', 'Sand',
    'Rust', 'Warm gray', 'Charcoal gray', 'Soft black', 'Cool gray', 'Warm white',
]
PASTEL_NAMES = [
    'Warm white', 'Lemon', 'Pale gold', 'Golden yellow', 'Coral orange',
    'Bright orange', 'Coral red', 'Crimson', 'Dusty red', 'Light pink',
    'Rose pink', 'Orchid', 'Violet', 'Lavender',
    'Midnight blue', 'Royal blue', 'Sky blue', 'Bright azure', 'Turquoise',
    'Muted teal', 'Mint green', 'Yellow green', 'Pale mint', 'Olive green',
    'Sand', 'Apricot', 'Terracotta',
    'Clay red', 'Burnt orange', 'Earth brown', 'Deep brown', 'Warm brown',
    'Peach', 'Cream', 'Warm gray', 'Blue gray', 'Cool gray', 'Dark gray',
    'Charcoal gray', 'Soft black',
]
# The pastel tray actually has 14, 13, and 13 sticks, rather than a regular grid.
PASTEL_POINTS = [
    (220, 285), (300, 300), (375, 310), (448, 320), (522, 337),
    (596, 344), (670, 355), (744, 365), (820, 373), (893, 391),
    (968, 397), (1041, 410), (1118, 428), (1182, 440),
    (167, 515), (249, 527), (335, 543), (422, 560), (507, 579),
    (588, 594), (672, 612), (753, 623), (835, 640), (918, 650),
    (1001, 665), (1080, 682), (1162, 699),
    (113, 755), (200, 774), (281, 792), (365, 808), (451, 823),
    (533, 837), (620, 855), (699, 874), (785, 893), (867, 910),
    (950, 925), (1035, 944), (1120, 965),
]
PENCIL = [
    ('Graphite', 94, 319), ('Slate graphite', 232, 222),
    ('Soft graphite', 362, 228), ('Charcoal black', 501, 190),
    ('Earth red', 665, 155), ('Deep blue', 815, 235),
    ('Leaf green', 967, 255), ('Golden yellow', 1083, 345),
    ('Fine black', 1210, 385),
]
CHARCOAL = [
    ('Vine gray', 187, 508), ('Compressed black', 407, 383),
    ('Soft charcoal', 488, 526), ('Light gray', 812, 479),
    ('Earth brown', 939, 511), ('Warm red', 963, 441),
    ('Chalk white', 292, 944), ('Cool gray', 641, 861),
]

def sample_rows(filename, samples):
    picture = Image.open(SOURCES / filename).convert('RGBA')
    rows = []
    for name, x, y in samples:
        if picture.width == picture.height:
            x = round(x * picture.width / 1280)
            y = round(y * picture.height / 1280)
        patch = picture.crop((x - 5, y - 5, x + 6, y + 6))
        pixels = [patch.getpixel((column, row)) for row in range(11) for column in range(11)]
        assert all(pixel[3] >= 240 for pixel in pixels), (filename, name, 'transparent patch')
        rgb = [round(median(pixel[channel] for pixel in pixels)) for channel in range(3)]
        rows.append((name, '#' + ''.join(f'{channel:02x}' for channel in rgb)))
    assert len({name for name, _ in rows}) == len(rows)
    return rows

watercolor = []
for row in range(3):
    for column in range(12):
        # Perspective shifts the first well slightly between the three rows.
        x = [147, 133, 119][row] + round(column * [91.5, 93, 95][row])
        watercolor.append((WATERCOLOR_NAMES[row * 12 + column], x, [350, 477, 605][row]))
pastel = [(name, x, y) for name, (x, y) in zip(PASTEL_NAMES, PASTEL_POINTS, strict=True)]
palettes = {
    'acrylic': sample_rows('acrylic-paint-organizer-24.png', ACRYLIC),
    'watercolor': sample_rows('watercolor-palette-36.png', watercolor),
    'pastel': sample_rows('soft-pastels-tray.png', pastel),
    'pencil': sample_rows('art-pencils-selection.png', PENCIL),
    'charcoal': sample_rows('charcoal-set-tray.png', CHARCOAL),
}
lines = [
    "import type { PaintingMedium } from './painting-selection';",
    "import { EXTRA_PENCIL_COLORS, EXTRA_CHARCOAL_COLORS } from './study-palette-extras';", '',
    '// Photo appearance samples for this local study; these are not pigment identities.',
    '// Rebuild with studio/scripts/sample_study_palettes.py; source photos stay unchanged.',
    'export const PHOTO_PALETTES: Record<PaintingMedium, { name: string; hex: string }[]> = {',
]
for medium, colors in palettes.items():
    lines.append(f'  {medium}: [')
    for name, color in colors:
        lines.append(f"    {{ name: '{name}', hex: '{color}' }},")
    lines.append('  ],')
    print(f'{medium}: {len(colors)} photo samples')
lines.append('};')
lines.extend(['', 'export const STUDY_PALETTES = {', '  ...PHOTO_PALETTES,',
              '  pencil: [...PHOTO_PALETTES.pencil, ...EXTRA_PENCIL_COLORS],',
              '  charcoal: [...PHOTO_PALETTES.charcoal, ...EXTRA_CHARCOAL_COLORS],', '};'])
(ROOT / 'apps/web/src/lib/canvas/study-palettes.ts').write_text('\n'.join(lines) + '\n')
