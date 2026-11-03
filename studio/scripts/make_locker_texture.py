"""
Make the tall locker texture: the locker photo with its top row of small
lockers repeated once, renumbered 1–3 / 4–6 / 7–9 so no number repeats.

  python3 studio/scripts/make_locker_texture.py [path/to/BoldSerif.ttf]

Reads  _design/room-elements/locker-cabinet-3x2.png
Writes studio/textures/locker-tall.png  (texture_pass.py uses it)
Pixel positions below are in the photo, measured once; top-down.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / '_design' / 'room-elements' / 'locker-cabinet-3x2.png'
OUT = REPO / 'studio' / 'textures' / 'locker-tall.png'

photo = Image.open(SRC).convert('RGBA')
photo = photo.crop(photo.getbbox())
W, H = photo.size
RAIL, ROW_END = 50, 362  # top rail ends / small-lockers row (with its divider) ends
ROW = ROW_END - RAIL

tall = Image.new('RGBA', (W, H + ROW), (0, 0, 0, 0))
tall.paste(photo.crop((0, 0, W, ROW_END)), (0, 0))                 # rail + small row (1 2 3)
tall.paste(photo.crop((0, RAIL, W, ROW_END)), (0, ROW_END))         # small row again (→ 4 5 6)
tall.paste(photo.crop((0, ROW_END, W, H)), (0, ROW_END + ROW))      # big lockers + legs (→ 7 8 9)

# Digit centers on the number plates, in the original photo.
SMALL = [(257, 108), (541, 106), (820, 104)]
BIG = [(257, 428), (588, 433), (820, 419)]
font_path = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
try:
    font = ImageFont.truetype(font_path, 30)
except OSError:
    font = ImageFont.load_default(30)

def renumber(center, digit):
    x, y = center
    box = (x - 13, y - 15, x + 13, y + 15)
    plate = tall.crop(box).convert('RGB')
    # Plate color without the old digit: the brightest half of its pixels.
    pixels = sorted(plate.getdata(), key=sum)
    light = pixels[len(pixels) // 2:]
    color = tuple(sum(p[i] for p in light) // len(light) for i in range(3))
    patch = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), color + (255,))
    # Keep a little of the plate's grime so the patch isn't flat.
    grime = tall.crop(box).filter(ImageFilter.GaussianBlur(4))
    patch = Image.blend(patch, grime, 0.25)
    tall.paste(patch, box[:2])
    layer = Image.new('RGBA', tall.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((x, y), str(digit), font=font, fill=(28, 24, 21, 255), anchor='mm')
    tall.alpha_composite(layer.filter(ImageFilter.GaussianBlur(0.6)))

for i, c in enumerate(SMALL):
    renumber((c[0], c[1] + ROW), 4 + i)          # the repeated small row
for i, c in enumerate(BIG):
    renumber((c[0], c[1] + ROW), 7 + i)          # the big lockers
OUT.parent.mkdir(parents=True, exist_ok=True)
tall.save(OUT)
print('wrote', OUT, tall.size)
