"""
Canvas storage on the steel shelves in the coffee nook (the shelf with the old
laptop): rows of canvases standing on edge, like a drying/storage rack, some
painted and some blank, plus one leaning face-out per shelf so a painting
shows from the room. Re-runnable: everything it adds is named "CANVAS RACK — …".

  Blender -b studio/blender/cream-city-studio-wphotos.blend \
    --python studio/scripts/add_canvas_rack.py -- --save
"""
import bpy, bmesh, math, random, sys

SAVE = '--save' in sys.argv
TAG = 'CANVAS RACK — '
SHELF = 'steel_frame_shelves_03'
BLANK = 'Unpainted canvas — space for your own work'
# Shelf levels (top surface z, meters) and how tall a canvas can be there.
# Measured on the shelf; the laptop's level is left alone.
LEVELS = [
    {'z': 0.88, 'max_h': 0.38, 'row': (-2.66, -1.92), 'face_out_y': -1.45},
    {'z': 1.98, 'max_h': 0.48, 'row': (-1.92, -1.10), 'face_out_y': -2.35},
]
BACK_X, FRONT_X = 8.60, 7.77  # the shelf runs along y; the room is toward -x
PALETTES = [
    [(0.80, 0.25, 0.08), (0.95, 0.70, 0.20), (0.15, 0.25, 0.55), (0.92, 0.88, 0.80)],
    [(0.10, 0.35, 0.40), (0.85, 0.55, 0.45), (0.95, 0.90, 0.70), (0.20, 0.12, 0.10)],
    [(0.55, 0.10, 0.30), (0.95, 0.45, 0.55), (0.30, 0.20, 0.55), (0.98, 0.85, 0.40)],
    [(0.25, 0.45, 0.15), (0.75, 0.70, 0.30), (0.45, 0.25, 0.10), (0.90, 0.92, 0.85)],
    [(0.05, 0.08, 0.20), (0.20, 0.45, 0.80), (0.90, 0.95, 1.00), (0.95, 0.55, 0.10)],
]
rng = random.Random(1225)

def clear():
    for o in [o for o in bpy.data.objects if o.name.startswith(TAG)]:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in [m for m in bpy.data.materials if m.name.startswith(TAG) and m.users == 0]:
        bpy.data.materials.remove(m)

def collection():
    col = bpy.data.collections.get('CANVAS RACK — nook shelves')
    if col is None:
        col = bpy.data.collections.new('CANVAS RACK — nook shelves')
        bpy.context.scene.collection.children.link(col)
    return col

def painting(index):
    """An abstract painting: swirled noise through a small palette, with brushy streaks."""
    mat = bpy.data.materials.new(f'{TAG}painting {index}')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50))
    mp.inputs['Scale'].default_value = (rng.uniform(1.5, 4), rng.uniform(1.5, 4), rng.uniform(1.5, 4))
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = rng.uniform(1.2, 3.5)
    nz.inputs['Detail'].default_value = 12
    nz.inputs['Distortion'].default_value = rng.uniform(0.5, 3.0)
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = rng.choice(['CONSTANT', 'EASE', 'LINEAR'])
    pal = rng.choice(PALETTES)
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.25, (*pal[0], 1)
    els[1].position, els[1].color = 0.75, (*pal[-1], 1)
    for k, col in enumerate(pal[1:-1]):
        e = els.new(0.25 + 0.5 * (k + 1) / (len(pal) - 1))
        e.color = (*col, 1)
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    # Visible brush texture: a fine stretched wave pattern as bump.
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.inputs['Scale'].default_value = rng.uniform(25, 60)
    wave.inputs['Distortion'].default_value = 8
    nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = 0.55
    return mat

def canvas(name, width, height, thickness, location, rotation, mat):
    me = bpy.data.meshes.new(TAG + name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(TAG + name, me)
    collection().objects.link(o)
    o.scale = (width, thickness, height)
    o.location = location
    o.rotation_euler = rotation
    o.data.materials.append(mat)
    b = o.modifiers.new('soft edges', 'BEVEL')
    b.width = 0.004
    b.segments = 2
    return o

def main():
    clear()
    blank = bpy.data.materials.get(BLANK)
    count = 0
    for li, level in enumerate(LEVELS):
        y0, y1 = level['row']
        y = y0
        while y < y1:
            h = rng.uniform(0.6, 1.0) * level['max_h']
            w = rng.uniform(0.35, 0.78)
            painted = rng.random() < 0.6
            mat = painting(count) if painted else blank
            lean = math.radians(rng.uniform(-6, 6))
            x = BACK_X - 0.03 - w / 2 - rng.uniform(0, 0.08)
            canvas(f'stored {li}-{count}', w, h, 0.022, (x, y, level['z'] + h / 2 + 0.003), (lean, 0, 0), mat)
            count += 1
            y += rng.uniform(0.045, 0.09)
        # One leaning face-out, so a painting reads from the room.
        h = level['max_h'] * 0.95
        w = h * rng.choice([0.8, 1.25, 1.0])
        canvas(f'face out {li}', w, h, 0.025, (BACK_X - 0.07, level['face_out_y'], level['z'] + h / 2 * math.cos(math.radians(8)) + 0.003),
               (math.radians(8), 0, math.radians(90)), painting(count))
        count += 1
    print(f'[canvas-rack] placed {count} canvases on {len(LEVELS)} shelves')
    if SAVE:
        bpy.ops.wm.save_mainfile()
        print('[canvas-rack] saved')

main()
