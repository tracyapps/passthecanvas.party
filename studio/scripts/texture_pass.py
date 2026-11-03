"""
Texture pass for the Cream City studio (Nov 2026).

Moves the Photoshop-only fixes into the Blender scene itself, so every
viewpoint (not just the center panorama) shows them, and roughs the studio up:

  1. Couch: burnt-orange draped-sheet look (lumpy drape, cotton sheen, fine
     weave, a few paint smudges).
  2. Giant beanbag: dark green crushed velvet with paint flecks and folds.
  3. Throw pillow: the striped pillow photo on a soft pillow on the couch.
  4. Locker cabinet: a tall, skinny metal locker (photo front, two rows of
     small lockers on top) behind the painting table.
  5. The flat canvas-drying-rack photo card is removed (only worked from the
     center).
  6. "Lived-in" grime: darker, uneven ceiling/timber with stains; extra paint
     drips and splatters on the painting table; crevice dirt and paint flecks on
     chairs, stools, tables and cabinets.

Everything is procedural or uses the images in _design/room-elements, so it
can be re-run. Run (Blender 5.x, background):
  Blender -b studio/blender/cream-city-studio-wphotos.blend \
    --python studio/scripts/texture_pass.py -- --save
Without --save it only reports what it would change.
"""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAVE = '--save' in ARGS
REPO = Path(bpy.path.abspath('//')).parents[1]
ELEMENTS = REPO / '_design' / 'room-elements'
TEXTURES = REPO / 'studio' / 'textures'
TAG = 'TEXTURE PASS — '  # every node/object this script adds is named with this, so re-runs replace them
report = []


# ---------- small node helpers ----------

def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')

def node(mat, kind, name, x, y, **props):
    nodes = mat.node_tree.nodes
    n = nodes.get(TAG + name) or nodes.new(kind)
    n.name = n.label = TAG + name
    n.location = (x, y)
    for k, v in props.items():
        setattr(n, k, v)
    return n

def link(mat, a, b):
    mat.node_tree.links.new(a, b)

def clear_pass(mat):
    """Remove nodes from an earlier run of this script, restoring the original link."""
    nodes = mat.node_tree.nodes
    bsdf = principled(mat)
    original = mat.get('texture_pass_base')
    for n in [n for n in nodes if n.name.startswith(TAG)]:
        nodes.remove(n)
    if original:
        src = nodes.get(original[0])
        if src:
            link(mat, src.outputs[original[1]], bsdf.inputs['Base Color'])

def base_source(mat):
    """The socket currently feeding Base Color, or None (a plain color)."""
    bsdf = principled(mat)
    sock = bsdf.inputs['Base Color']
    if sock.is_linked:
        l = sock.links[0]
        mat['texture_pass_base'] = [l.from_node.name, l.from_socket.name]
        return l.from_socket
    return None

def mix(mat, name, x, y, blend, fac, a, b):
    m = node(mat, 'ShaderNodeMix', name, x, y, data_type='RGBA', blend_type=blend)
    m.clamp_result = True
    if isinstance(fac, float): m.inputs['Factor'].default_value = fac
    else: link(mat, fac, m.inputs['Factor'])
    for slot, val in (('A', a), ('B', b)):
        sock = next(s for s in m.inputs if s.identifier == f'{slot}_Color')
        if isinstance(val, tuple): sock.default_value = val
        else: link(mat, val, sock)
    return next(s for s in m.outputs if s.identifier == 'Result_Color')

def ramp(mat, name, x, y, src, stops):
    r = node(mat, 'ShaderNodeValToRGB', name, x, y)
    els = r.color_ramp.elements
    while len(els) > 2: els.remove(els[-1])
    for i, (pos, col) in enumerate(stops):
        e = els[i] if i < len(els) else els.new(pos)
        e.position = pos
        e.color = col
    link(mat, src, r.inputs['Fac'])
    return r.outputs['Color']

def coords(mat, x, y, scale=(1, 1, 1)):
    tc = node(mat, 'ShaderNodeTexCoord', 'coords', x, y)
    mp = node(mat, 'ShaderNodeMapping', 'scale', x + 180, y)
    mp.inputs['Scale'].default_value = scale
    link(mat, tc.outputs['Object'], mp.inputs['Vector'])
    return mp.outputs['Vector']

def noise(mat, name, x, y, vec, scale, detail=6.0, rough=0.6):
    n = node(mat, 'ShaderNodeTexNoise', name, x, y)
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    link(mat, vec, n.inputs['Vector'])
    return n

def splatter(mat, name, x, y, vec, scale, size, palette_mix=0.35, cluster=0.58):
    """Random paint marks: Voronoi cells, only their centers, each a random color.
    The coordinates are wobbled with noise so marks are blotchy, not polka dots,
    and a large, slow noise gates them so they gather in a few places."""
    wob = noise(mat, name + ' wobble', x - 400, y + 150, vec, scale * 0.8, 4.0, 0.6)
    off = node(mat, 'ShaderNodeVectorMath', name + ' offset', x - 200, y + 150, operation='MULTIPLY_ADD')
    link(mat, wob.outputs['Color'], off.inputs[0])
    off.inputs[1].default_value = (0.9 / scale, 0.9 / scale, 0.9 / scale)
    link(mat, vec, off.inputs[2])
    v = node(mat, 'ShaderNodeTexVoronoi', name, x, y)
    v.inputs['Scale'].default_value = scale
    v.inputs['Randomness'].default_value = 1.0
    link(mat, off.outputs[0], v.inputs['Vector'])
    dots = ramp(mat, name + ' mask', x + 200, y, v.outputs['Distance'], [(size * 0.6, (1, 1, 1, 1)), (size, (0, 0, 0, 1))])
    gate_noise = noise(mat, name + ' clusters', x - 400, y - 350, vec, 1.3, 2.0, 0.5)
    gate = ramp(mat, name + ' cluster mask', x - 150, y - 350, gate_noise.outputs['Fac'], [(cluster, (0, 0, 0, 1)), (cluster + 0.08, (1, 1, 1, 1))])
    mask = mix(mat, name + ' gathered', x + 400, y, 'MULTIPLY', 1.0, dots, gate)
    # Random cell colors, pushed toward saturated paint.
    hsv = node(mat, 'ShaderNodeHueSaturation', name + ' paint', x + 200, y - 180)
    hsv.inputs['Saturation'].default_value = 1.8
    hsv.inputs['Value'].default_value = 1.1
    link(mat, v.outputs['Color'], hsv.inputs['Color'])
    return mask, hsv.outputs['Color']

def bump(mat, name, x, y, height, strength, distance=0.02):
    b = node(mat, 'ShaderNodeBump', name, x, y)
    b.inputs['Strength'].default_value = strength
    b.inputs['Distance'].default_value = distance
    link(mat, height, b.inputs['Height'])
    bsdf = principled(mat)
    normal = bsdf.inputs['Normal']
    if normal.is_linked and not normal.links[0].from_node.name.startswith(TAG):
        link(mat, normal.links[0].from_socket, b.inputs['Normal'])
    link(mat, b.outputs['Normal'], normal)


# ---------- 1–2. upholstery ----------

def upholstery(name, dark, light, sheen_tint, sheen, rough, fold_scale, fold_strength, weave, smudge_scale):
    mat = bpy.data.materials.get(name)
    if not mat: report.append(f'missing material {name}'); return
    mat.use_nodes = True
    clear_pass(mat)
    bsdf = principled(mat)
    vec = coords(mat, -1400, 0)
    folds = noise(mat, 'folds', -1050, 200, vec, fold_scale, 8.0, 0.55)
    color = ramp(mat, 'fabric tone', -800, 200, folds.outputs['Fac'], [(0.35, dark), (0.7, light)])
    mask, paint = splatter(mat, 'smudges', -1050, -250, vec, smudge_scale, 0.12)
    paint_soft = mix(mat, 'smudge tone', -600, -250, 'MIX', 0.55, paint, (0.85, 0.82, 0.75, 1))
    final = mix(mat, 'paint on fabric', -400, 150, 'MIX', mask, color, paint_soft)
    link(mat, final, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Sheen Weight'].default_value = sheen
    bsdf.inputs['Sheen Tint'].default_value = sheen_tint
    bsdf.inputs['Sheen Roughness'].default_value = 0.4
    if weave:
        w = node(mat, 'ShaderNodeTexWave', 'weave', -1050, -550)
        w.inputs['Scale'].default_value = weave
        link(mat, vec, w.inputs['Vector'])
        height = mix(mat, 'weave + folds', -800, -550, 'ADD', 0.25, folds.outputs['Fac'], w.outputs['Color'])
    else:
        height = folds.outputs['Fac']
    bump(mat, 'fabric bump', -300, -400, height, fold_strength)
    report.append(f'upholstery: {name}')

def lumpy(obj_names, texture_name, size, strength, subdiv=2):
    """Soft folds in the actual shape (visible from every seat), not just shading."""
    tex = bpy.data.textures.get(TAG + texture_name) or bpy.data.textures.new(TAG + texture_name, 'CLOUDS')
    tex.noise_scale = size
    tex.noise_depth = 2
    for n in obj_names:
        o = bpy.data.objects.get(n)
        if not o: report.append(f'missing object {n}'); continue
        for m in [m for m in o.modifiers if m.name.startswith(TAG)]:
            o.modifiers.remove(m)
        s = o.modifiers.new(TAG + 'soften', 'SUBSURF')
        s.levels = 1
        s.render_levels = subdiv
        s.subdivision_type = 'SIMPLE' if len(o.data.vertices) < 50 else 'CATMULL_CLARK'
        d = o.modifiers.new(TAG + 'drape folds', 'DISPLACE')
        d.texture = tex
        d.texture_coords = 'GLOBAL'
        d.strength = strength
        d.mid_level = 0.5
        # Soft cloth, not facets: smooth shading after the folds.
        for poly in o.data.polygons:
            poly.use_smooth = True
        for m in o.modifiers:
            if m.type == 'WEIGHTED_NORMAL':
                m.show_render = m.show_viewport = False
        report.append(f'lumpy: {n}')


# ---------- 3–4. new photo-faced objects ----------

def photo_material(name, image_path, u, v, sides=(0.32, 0.36, 0.34, 1), rough=0.6, rust=False):
    """Image on the object's front/back (local X–Z plane); plain color elsewhere."""
    mat = bpy.data.materials.get(TAG + name) or bpy.data.materials.new(TAG + name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (500, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (200, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tc = nt.nodes.new('ShaderNodeTexCoord'); tc.location = (-1200, 0)
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); sep.location = (-1000, 0)
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    # u = a·x + b, v = c·z + d  (object coords run -1…1 on the default cube)
    mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY_ADD'; mu.location = (-800, 100)
    mu.inputs[1].default_value, mu.inputs[2].default_value = u
    nt.links.new(sep.outputs['X'], mu.inputs[0])
    mv = nt.nodes.new('ShaderNodeMath'); mv.operation = 'MULTIPLY_ADD'; mv.location = (-800, -100)
    mv.inputs[1].default_value, mv.inputs[2].default_value = v
    nt.links.new(sep.outputs['Z'], mv.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ'); comb.location = (-600, 0)
    nt.links.new(mu.outputs[0], comb.inputs['X']); nt.links.new(mv.outputs[0], comb.inputs['Y'])
    img = nt.nodes.new('ShaderNodeTexImage'); img.location = (-400, 0)
    img.image = bpy.data.images.load(str(image_path), check_existing=True)
    img.extension = 'EXTEND'
    nt.links.new(comb.outputs[0], img.inputs['Vector'])
    # Facing ±Y (the photo side) gets the photo; the other faces get the side color.
    geo = nt.nodes.new('ShaderNodeNewGeometry'); geo.location = (-800, -400)
    vt = nt.nodes.new('ShaderNodeVectorTransform'); vt.location = (-600, -400)
    vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'OBJECT'
    nt.links.new(geo.outputs['Normal'], vt.inputs['Vector'])
    sep2 = nt.nodes.new('ShaderNodeSeparateXYZ'); sep2.location = (-400, -400)
    nt.links.new(vt.outputs['Vector'], sep2.inputs['Vector'])
    ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; ab.location = (-250, -400)
    nt.links.new(sep2.outputs['Y'], ab.inputs[0])
    gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.location = (-100, -400)
    gt.inputs[1].default_value = 0.6
    nt.links.new(ab.outputs[0], gt.inputs[0])
    side = sides
    if rust:
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.location = (-400, -650)
        nz.inputs['Scale'].default_value = 9; nz.inputs['Detail'].default_value = 10
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        rr = nt.nodes.new('ShaderNodeValToRGB'); rr.location = (-200, -650)
        rr.color_ramp.elements[0].position = 0.55; rr.color_ramp.elements[0].color = sides
        rr.color_ramp.elements[1].position = 0.72; rr.color_ramp.elements[1].color = (0.25, 0.12, 0.05, 1)
        nt.links.new(nz.outputs['Fac'], rr.inputs['Fac'])
        side = rr.outputs['Color']
    m = nt.nodes.new('ShaderNodeMix'); m.data_type = 'RGBA'; m.location = (0, -100)
    nt.links.new(gt.outputs[0], m.inputs['Factor'])
    a = next(s for s in m.inputs if s.identifier == 'A_Color')
    if isinstance(side, tuple): a.default_value = side
    else: nt.links.new(side, a)
    nt.links.new(img.outputs['Color'], next(s for s in m.inputs if s.identifier == 'B_Color'))
    nt.links.new(next(s for s in m.outputs if s.identifier == 'Result_Color'), bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    return mat

def place_object(name, collection_name, location, rotation_deg, dims, mat, subdiv=0, bevel=0.0):
    old = bpy.data.objects.get(TAG + name)
    if old:
        # Keep wherever the owner moved it in Blender.
        location, rotation_deg = tuple(old.location), [math.degrees(a) for a in old.rotation_euler]
        dims = tuple(old.scale[i] * 2 for i in range(3))
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new(TAG + name)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=2.0); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(TAG + name, me)
    col = bpy.data.collections.get(collection_name)
    if col is None:
        col = bpy.data.collections.new(collection_name)
        bpy.context.scene.collection.children.link(col)
    col.objects.link(o)
    o.location = location
    o.rotation_euler = [math.radians(a) for a in rotation_deg]
    o.scale = (dims[0] / 2, dims[1] / 2, dims[2] / 2)
    o.data.materials.append(mat)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 3
        b.affect = 'EDGES'
    if subdiv:
        s = o.modifiers.new('soft', 'SUBSURF'); s.levels = s.render_levels = subdiv
    for p in o.data.polygons: p.use_smooth = True
    report.append(f'placed {o.name} at {[round(c, 2) for c in location]}')
    return o

def tall_locker_image():
    """The tall locker texture. studio/scripts/make_locker_texture.py makes a
    cleaner, renumbered version (1–9); use it when it exists."""
    premade = TEXTURES / 'locker-tall.png'
    if premade.exists():
        img = bpy.data.images.load(str(premade), check_existing=True)
        img.reload()
        return premade, img.size[0] / img.size[1]
    try:
        from PIL import Image  # not in Blender's Python on every install
    except ImportError:
        Image = None
    TEXTURES.mkdir(parents=True, exist_ok=True)
    out = TEXTURES / 'locker-tall.png'
    src = ELEMENTS / 'locker-cabinet-3x2.png'
    img = bpy.data.images.load(str(src), check_existing=True)
    w, h = img.size
    px = list(img.pixels)  # RGBA floats, bottom row first
    # Bounding box of the opaque cabinet.
    alpha_rows = [any(px[(y * w + x) * 4 + 3] > 0.5 for x in range(0, w, 4)) for y in range(h)]
    alpha_cols = [any(px[(y * w + x) * 4 + 3] > 0.5 for y in range(0, h, 4)) for x in range(w)]
    y0, y1 = alpha_rows.index(True), h - 1 - alpha_rows[::-1].index(True)
    x0, x1 = alpha_cols.index(True), w - 1 - alpha_cols[::-1].index(True)
    cw, ch = x1 - x0 + 1, y1 - y0 + 1
    rows = [px[((y0 + r) * w + x0) * 4:((y0 + r) * w + x1 + 1) * 4] for r in range(ch)]  # bottom → top
    # The small top lockers sit in roughly the top 30% (below a thin top rail).
    # Bottom-first fractions: legs 0–0.07, big lockers 0.07–0.62, small top row
    # 0.62–0.94, top rail 0.94–1. Repeat the small row once above itself.
    lo, hi = int(ch * 0.62), int(ch * 0.94)
    tall = rows[:hi] + rows[lo:hi] + rows[hi:]
    new = bpy.data.images.new(TAG + 'locker-tall', cw, len(tall), alpha=True)
    new.pixels = [v for row in tall for v in row]
    new.filepath_raw = str(out); new.file_format = 'PNG'; new.save()
    report.append(f'locker image {cw}x{len(tall)} → {out}')
    return out, cw / len(tall)


# ---------- 6. grime ----------

def timber_grime(name):
    mat = bpy.data.materials.get(name)
    if not mat: report.append(f'missing material {name}'); return
    clear_pass(mat)
    src = base_source(mat)
    bsdf = principled(mat)
    vec = coords(mat, -1600, -800)
    tone = noise(mat, 'age tone', -1250, -700, vec, 1.6, 6.0, 0.6)
    darken = ramp(mat, 'darker, uneven', -1000, -700, tone.outputs['Fac'], [(0.3, (0.36, 0.33, 0.31, 1)), (0.75, (0.62, 0.58, 0.55, 1))])
    base = src if src else tuple(bsdf.inputs['Base Color'].default_value)
    aged = mix(mat, 'aged wood', -700, -500, 'MULTIPLY', 1.0, base, darken)
    stains = noise(mat, 'water stains', -1250, -1050, vec, 5.5, 4.0, 0.5)
    stain_mask = ramp(mat, 'stain mask', -1000, -1050, stains.outputs['Fac'], [(0.6, (0, 0, 0, 1)), (0.7, (0.55, 0.55, 0.55, 1))])
    stained = mix(mat, 'stained', -450, -600, 'MIX', stain_mask, aged, (0.05, 0.03, 0.02, 1))
    ao = node(mat, 'ShaderNodeAmbientOcclusion', 'crevice dirt', -700, -1300)
    ao.inputs['Distance'].default_value = 0.15
    dirt = ramp(mat, 'dirt amount', -450, -1300, ao.outputs['AO'], [(0.0, (0.35, 0.35, 0.35, 1)), (0.9, (1, 1, 1, 1))])
    final = mix(mat, 'dirty corners', -250, -600, 'MULTIPLY', 1.0, stained, dirt)
    link(mat, final, bsdf.inputs['Base Color'])
    report.append(f'timber grime: {name}')

def studio_wear(name, flecks=True, drips=True, dirt=0.4, darker=0.85, fleck_scale=45.0, fleck_size=0.09):
    mat = bpy.data.materials.get(name)
    if not mat or not mat.use_nodes: report.append(f'missing material {name}'); return
    try:
        bsdf = principled(mat)
    except StopIteration:
        report.append(f'no principled in {name}'); return
    clear_pass(mat)
    src = base_source(mat)
    base = src if src else tuple(bsdf.inputs['Base Color'].default_value)
    vec = coords(mat, -1800, -900)
    color = mix(mat, 'worn darker', -900, -700, 'MULTIPLY', 1.0, base, (darker, darker * 0.97, darker * 0.94, 1))
    ao = node(mat, 'ShaderNodeAmbientOcclusion', 'crevice dirt', -1200, -1100)
    ao.inputs['Distance'].default_value = 0.08
    d = ramp(mat, 'dirt amount', -950, -1100, ao.outputs['AO'], [(0.0, (1 - dirt, 1 - dirt, 1 - dirt, 1)), (0.85, (1, 1, 1, 1))])
    color = mix(mat, 'dirty crevices', -700, -800, 'MULTIPLY', 1.0, color, d)
    if drips:
        # Drips: noise stretched tall, so marks run downhill on the sides.
        tall = node(mat, 'ShaderNodeMapping', 'drip stretch', -1500, -1500)
        tall.inputs['Scale'].default_value = (28, 28, 2.2)
        link(mat, vec, tall.inputs['Vector'])
        dn = noise(mat, 'drips', -1250, -1500, tall.outputs['Vector'], 1.0, 3.0, 0.4)
        dm = ramp(mat, 'drip mask', -1000, -1500, dn.outputs['Fac'], [(0.74, (0, 0, 0, 1)), (0.78, (0.8, 0.8, 0.8, 1))])
        # Only a few patches get drips (a slow noise gate), so they read as
        # the odd spill, not stripes on everything.
        gn = noise(mat, 'drip patches', -1250, -1300, vec, 0.9, 2.0, 0.5)
        gate = ramp(mat, 'drip patch mask', -1000, -1300, gn.outputs['Fac'], [(0.6, (0, 0, 0, 1)), (0.68, (1, 1, 1, 1))])
        dm = mix(mat, 'drips gathered', -800, -1450, 'MULTIPLY', 1.0, dm, gate)
        dmask, dpaint = splatter(mat, 'drip colors', -1250, -1800, vec, 3.0, 2.0)  # big cells = one color per drip area
        # Old, dried paint: knocked back toward the surface color.
        dpaint = mix(mat, 'dried drip tone', -700, -1800, 'MIX', 0.45, dpaint, color)
        color = mix(mat, 'paint drips', -500, -900, 'MIX', dm, color, dpaint)
    if flecks:
        fmask, fpaint = splatter(mat, 'flecks', -1250, -2200, vec, fleck_scale, fleck_size)
        color = mix(mat, 'paint flecks', -300, -900, 'MIX', fmask, color, fpaint)
    link(mat, color, bsdf.inputs['Base Color'])
    report.append(f'studio wear: {name}')


# ---------- run ----------

def main():
    # 1. Couch: draped orange sheet.
    upholstery('Burnt orange upholstery', dark=(0.22, 0.055, 0.018, 1), light=(0.42, 0.12, 0.035, 1),
               sheen_tint=(0.9, 0.55, 0.35, 1), sheen=0.25, rough=0.92, fold_scale=3.5, fold_strength=0.35, weave=420.0, smudge_scale=7.0)
    lumpy(['Orange sofa — back', 'Orange sofa — seat', 'Orange sofa arm', 'Orange sofa arm.001',
           'Loose sofa cushion', 'Loose sofa cushion.001', 'Loose sofa cushion.002'], 'sheet drape', 0.38, 0.05, subdiv=4)
    # 2. Beanbag: dark green crushed velvet.
    upholstery('Olive green upholstery', dark=(0.003, 0.014, 0.005, 1), light=(0.014, 0.045, 0.013, 1),
               sheen_tint=(0.3, 0.5, 0.25, 1), sheen=0.35, rough=0.62, fold_scale=6.0, fold_strength=0.55, weave=0.0, smudge_scale=5.0)
    lumpy(['Olive beanbag — replace with cloth or chosen model'], 'beanbag folds', 0.42, 0.16, subdiv=2)

    # 3. Throw pillows: the owner replaced this script's photo pillow with
    #    Poly Haven's throw_pillows_01 (Nov 3), so it is no longer added.
    old = bpy.data.objects.get(TAG + 'throw pillow')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)

    # 4. Tall skinny locker behind the painting table (against the north-east brick).
    locker_path, aspect = tall_locker_image()
    locker_mat = photo_material('locker cabinet', locker_path, (-0.5, 0.5), (0.5, 0.5), sides=(0.3, 0.35, 0.34, 1), rough=0.55, rust=True)
    # Against the east brick, left of the coffee-nook opening (as in the
    # edited panorama); the photo faces west into the room. Deliberately
    # skinnier than the photo's own proportions, like the Photoshop version.
    height = 2.3
    place_object('locker cabinet', 'ZONE_table', (5.24, 1.35, 0.21 + height / 2), (0, 0, 90), (0.8, 0.45, height), locker_mat, bevel=0.01)

    # 5. The drying-rack photo card only worked from the center: remove it.
    rack = bpy.data.objects.get('PHOTO — canvas-drying-rack')
    if rack:
        bpy.data.objects.remove(rack, do_unlink=True)
        report.append('removed PHOTO — canvas-drying-rack')

    # 6. Grime.
    timber_grime('Walnut and exposed timber')
    studio_wear('Painting table — sparse paint freckles over worn wood', dirt=0.3, darker=0.8, fleck_scale=18.0, fleck_size=0.12)
    for name in ['painted_wooden_chair_01.002', 'SchoolChair_01', 'dining_chair_02', 'metal_stool_02.001', 'folding_wooden_stool',
                 'WoodenTable_03', 'industrial_coffee_table', 'painted_wooden_nightstand', 'drawer_cabinet', 'wine_barrel_01',
                 'Shelf_01', 'painted_wooden_cabinet_02', 'modern_coffee_table_02_wood']:
        studio_wear(name)

    for line in report: print('[texture-pass]', line)
    if '--render' in ARGS:
        out = ARGS[ARGS.index('--render') + 1]
        scene = bpy.context.scene
        scene.camera = bpy.data.objects['PANO_CAM']
        scene.render.resolution_x, scene.render.resolution_y = 2048, 1024
        scene.render.resolution_percentage = 100
        scene.cycles.samples = 64
        scene.render.filepath = out
        bpy.ops.render.render(write_still=True)
        print('[texture-pass] rendered', out)
        # Leave the file's own render settings as they were.
        scene.render.resolution_x, scene.render.resolution_y = 4096, 2048
        scene.cycles.samples = 128
    if SAVE:
        bpy.ops.wm.save_mainfile()
        print('[texture-pass] saved', bpy.data.filepath)

main()
