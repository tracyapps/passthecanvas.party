"""
A panorama for every seat: see the room from where you sit.

For each spot in apps/web/public/studio/<room>/spots.json (the seats you pick
in the 360° room), this script:
  1. finds the seat in 3D by casting a ray from the center camera (PANO_CAM)
     along the spot's yaw/pitch, the same convention as export_spots.py;
  2. puts a 360° camera at sitting eye height there, facing the room's center;
  3. renders the panorama, and
  4. re-projects every other seat and every wall/lean art area (from the hand
     drawn art.json, also found in 3D by ray casting) into that seat's view,
     dropping the ones hidden behind something.

Output, per seat:  apps/web/public/studio/<room>/seats/<spot>/
   panorama.webp   spots.json   art.json
and seats/index.json listing them (with "draft": true until final renders).

Run (Blender 5.x, background), after texture_pass.py has been saved:
  Blender -b studio/blender/cream-city-studio-wphotos.blend \\
    --python studio/scripts/seat_views.py -- [--room cream-city] [--only spot_a,spot_b] \\
    [--res 2048] [--samples 64] [--data-only] [--final] [--center]
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default

ROOM = arg('--room', 'cream-city')
ONLY = set(filter(None, (arg('--only', '') or '').split(',')))
FINAL = '--final' in ARGS
RES = int(arg('--res', '4096' if FINAL else '2048'))
SAMPLES = int(arg('--samples', '128' if FINAL else '64'))
DATA_ONLY = '--data-only' in ARGS
REPO = Path(bpy.path.abspath('//')).parents[1]
PUBLIC = REPO / 'apps' / 'web' / 'public' / 'studio' / ROOM
OUT = PUBLIC / 'seats'

scene = bpy.context.scene
center = bpy.data.objects['PANO_CAM']
depsgraph = bpy.context.evaluated_depsgraph_get()

def basis(matrix):
    q = matrix.to_quaternion()
    return q @ Vector((0, 0, -1)), q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0))

def direction(matrix, yaw, pitch):
    f, r, u = basis(matrix)
    y, p = math.radians(yaw), math.radians(pitch)
    return (f * math.cos(p) * math.cos(y) + r * math.cos(p) * math.sin(y) + u * math.sin(p)).normalized()

def angles(matrix, point):
    f, r, u = basis(matrix)
    d = (point - matrix.translation).normalized()
    yaw = math.degrees(math.atan2(d.dot(r), d.dot(f)))
    pitch = math.degrees(math.asin(max(-1, min(1, d.dot(u)))))
    return round((yaw + 180) % 360 - 180, 1), round(pitch, 1)

def renders(obj):
    if obj is None or obj.hide_render:
        return False
    if any(c.hide_render for c in obj.users_collection):
        return False
    return obj.visible_get()

def cast(origin, d, max_dist=100.0):
    """First hit on something that actually renders (skips hidden helper objects)."""
    o = origin.copy()
    travelled = 0.0
    for _ in range(64):
        hit, loc, normal, _, obj, _ = scene.ray_cast(depsgraph, o, d, distance=max_dist - travelled)
        if not hit:
            return None
        travelled += (loc - o).length
        if renders(obj):
            return loc, normal, obj, travelled
        o = loc + d * 0.002
    return None

def visible(eye, point):
    d = point - eye
    dist = d.length
    hit = cast(eye, d.normalized(), dist + 0.5)
    return hit is None or hit[3] >= dist - 0.15

# ---------- 1. seats in 3D ----------
spots = json.loads((PUBLIC / 'spots.json').read_text())['spots']
art = json.loads((PUBLIC / 'art.json').read_text())['art']
cm = center.matrix_world
FLOORISH = ('Hardwood', 'Concrete', 'rug', 'kilim', 'floor', 'Floor')

def is_floor(obj, point):
    return point.z < 0.3 and (any(k in obj.name for k in FLOORISH) or obj.name.startswith('PHOTO — rug'))

SEATISH = ('chair', 'Chair', 'stool', 'Stool', 'sofa', 'Sofa', 'cushion', 'beanbag', 'Ottoman', 'Rocking',
           'windowsill', 'Cat tree', 'pillow', 'bench', 'Bench')
HEAD_ABOVE_SEAT = 0.55  # a seated head is about this far above the cushion

def find_seat(spot):
    """Where does this marker's person sit? The marker aims at a seated head,
    so walk along the ray, look straight down at each step, and pick the
    surface the ray passes about a head-height above, preferring things that
    are seats (chairs, sofa, beanbag, sills…)."""
    d = direction(cm, spot['yaw'], spot['pitch'])
    origin = cm.translation
    hit = cast(origin, d)
    if hit is None:
        return None
    if is_floor(hit[2], hit[0]):
        # Pointing at the floor: a floor seat right there.
        return hit[0] + Vector((0, 0, 0.75)), hit[0], 'floor'
    if any(k in hit[2].name for k in SEATISH) and hit[2].type == 'MESH':
        # The marker sits right on a chair (often its back): sit in the middle of it.
        corners = [hit[2].matrix_world @ Vector(c) for c in hit[2].bound_box]
        middle = sum(corners, Vector()) / 8
        low = min(c.z for c in corners)
        seat = Vector((middle.x, middle.y, low + 0.45))
        return hit[0], seat, hit[2].name + ' (direct)'
    end = min(hit[3], 9.0)
    candidates = []
    t = 0.6
    while t < end:
        p = origin + d * t
        down = cast(p, Vector((0, 0, -1)), 3.0)
        if down and not is_floor(down[2], down[0]) and 0.25 <= down[0].z <= 1.3:
            gap = p.z - down[0].z
            seatish = any(k in down[2].name for k in SEATISH)
            candidates.append((abs(gap - HEAD_ABOVE_SEAT) - (0.25 if seatish else 0), p.copy(), down[0].copy(), down[2].name))
        t += 0.04
    if not candidates:
        return hit[0], hit[0], 'surface'
    _, head, seat, name = min(candidates, key=lambda c: c[0])
    return head, seat, name

# Hand-placed eyes for spots the automatic search can't read (sills facing out
# the window, standing at the easel, sitting on the floor). Edit freely: x, y, z
# in meters, same as Blender's N panel.
EYE_OVERRIDES = {
    'spot_window_sill': (-5.2, -1.0, 1.35),
    'spot_window_sill_2': (-5.2, 1.0, 1.35),
    'spot_easel': (3.0, 2.55, 1.6),
    'spot_music': (-2.25, 3.0, 1.1),
    'spot_floor_cats': (-4.3, 3.4, 0.9),
    'spot_ottoman': (-0.65, -1.25, 1.05),
    'spot_cat_tree': (-4.0, 2.2, 1.2),
    'spot_painting_table_green_chair': (1.4, 2.5, 1.2),
}

markers, seats_at, names_at = {}, {}, {}
for s in spots:
    found = find_seat(s)
    if not found:
        print('[seats] no surface for', s['id'])
        continue
    head, seat, what = found
    markers[s['id']] = head  # where the avatar shows
    seats_at[s['id']] = seat  # what they sit on
    names_at[s['id']] = what
    print('[seats] seat', s['id'], 'on', what, [round(v, 2) for v in seat])

# Check the yaw/pitch convention against any spot_* empties that exist.
for o in bpy.data.objects:
    if o.type == 'EMPTY' and o.name in {s['id'] for s in spots}:
        s = next(s for s in spots if s['id'] == o.name)
        print('[seats] convention check', o.name, 'json', (s['yaw'], s['pitch']), 'empty', angles(cm, o.matrix_world.translation))

def eye_for(sid):
    """Sitting eye height above the seat, nudged a little toward the room."""
    if sid in EYE_OVERRIDES:
        return Vector(EYE_OVERRIDES[sid])
    seat = seats_at[sid]
    toward = (cm.translation - seat)
    toward.z = 0
    step = toward.normalized() * 0.15 if toward.length > 0.4 else Vector((0, 0, 0))
    # Seated eye height: about 1.2 m on a chair or sofa, higher on the giant beanbag (you sink into its top).
    z = seat.z + 0.75 if seat.z < 0.3 else (1.45 if 'beanbag' in names_at.get(sid, '') else 1.2)
    return Vector((seat.x + step.x, seat.y + step.y, z))

# ---------- 2. art areas in 3D ----------
art3d = []
for region in art:
    pts = []
    for c in region['corners']:
        hit = cast(cm.translation, direction(cm, c['yaw'], c['pitch']))
        pts.append(hit[0] if hit else None)
    if all(pts):
        art3d.append((region, pts))
    else:
        print('[seats] art area off-surface, skipped:', region['id'])

# ---------- 3. one camera, moved seat to seat ----------
cam = bpy.data.objects.get('SEAT_CAM')
if cam is None:
    cam = bpy.data.objects.new('SEAT_CAM', center.data.copy())
    scene.collection.objects.link(cam)
cam.scale = (1, 1, 1)

index = []
OUT.mkdir(parents=True, exist_ok=True)

if '--center' in ARGS and not DATA_ONLY:
    # The middle-of-the-room panorama the app opens with (same camera the
    # hand-made spots.json and art.json were drawn against).
    scene.camera = center
    scene.render.resolution_x, scene.render.resolution_y = RES, RES // 2
    scene.render.resolution_percentage = 100
    scene.cycles.samples = SAMPLES
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 88
    scene.render.filepath = str(PUBLIC / 'panorama.webp')
    bpy.ops.render.render(write_still=True)
    print('[seats] rendered the center panorama')
for s in spots:
    sid = s['id']
    if ONLY and sid not in ONLY:
        continue
    if sid not in markers:
        continue
    eye = eye_for(sid)
    look = cm.translation - eye
    look.z = 0
    if look.length < 0.2:
        look = Vector((1, 0, 0))
    rot = look.normalized().to_track_quat('-Z', 'Y')
    cam.matrix_world = Matrix.Translation(eye) @ rot.to_matrix().to_4x4()
    bpy.context.view_layer.update()
    vm = cam.matrix_world

    view_spots = []
    for other in spots:
        if other['id'] == sid or other['id'] not in markers:
            continue
        m = markers[other['id']]
        if not visible(eye, m):
            continue
        yaw, pitch = angles(vm, m)
        view_spots.append({**other, 'yaw': yaw, 'pitch': pitch})
    view_art = []
    for region, pts in art3d:
        middle = sum(pts, Vector()) / 4
        if not visible(eye, middle):
            continue
        corners = [dict(zip(('yaw', 'pitch'), angles(vm, p))) for p in pts]
        # Skip areas that wrap around behind this seat (the quad would tear).
        yaws = [c['yaw'] for c in corners]
        if max(yaws) - min(yaws) > 120:
            continue
        view_art.append({**region, 'corners': corners})

    folder = OUT / sid
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'spots.json').write_text(json.dumps({'room': ROOM, 'spots': view_spots}, indent=2) + '\n')
    (folder / 'art.json').write_text(json.dumps({'room': ROOM, 'art': view_art}, indent=2) + '\n')
    index.append({'id': sid, 'label': s['label'], 'eye': [round(v, 3) for v in eye], 'spots': len(view_spots), 'art': len(view_art)})
    print('[seats]', sid, 'eye', [round(v, 2) for v in eye], 'sees', len(view_spots), 'seats and', len(view_art), 'art areas')

    if not DATA_ONLY:
        scene.camera = cam
        scene.render.resolution_x, scene.render.resolution_y = RES, RES // 2
        scene.render.resolution_percentage = 100
        scene.cycles.samples = SAMPLES
        scene.render.image_settings.file_format = 'WEBP'
        scene.render.image_settings.quality = 88
        scene.render.filepath = str(folder / 'panorama.webp')
        bpy.ops.render.render(write_still=True)
        print('[seats] rendered', sid)

existing = {}
index_file = OUT / 'index.json'
if index_file.exists():
    existing = {s['id']: s for s in json.loads(index_file.read_text()).get('seats', [])}
for entry in index:
    existing[entry['id']] = entry
index_file.write_text(json.dumps({'room': ROOM, 'draft': not FINAL, 'resolution': [RES, RES // 2], 'seats': sorted(existing.values(), key=lambda e: e['id'])}, indent=2) + '\n')
print('[seats] done', len(index))
