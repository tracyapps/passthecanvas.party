"""Repair the owner's saved layout without rebuilding or repositioning it.

Run in Blender against either pre-cleanup studio file. Writes a candidate into
studio/cache/cleanup-2026-10-28, leaving the input untouched until reviewed.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'studio/cache/cleanup-2026-10-28'
RENDERS = ROOT / 'studio/renders/cream-city/cleaned'
LIBRARY = Path('/Users/tapps/Library/CloudStorage/Dropbox/work/3d-stuff/Poly Haven')


def material(name, color, roughness=.7, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m


def collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def mesh(name, vertices, faces, target, mat=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    target.objects.link(o)
    if mat:
        data.materials.append(mat)
    return o


def tube(name, a, b, radius, mat, target):
    delta = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=delta.length,
                                      location=(Vector(a) + Vector(b)) / 2)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    for c in list(o.users_collection):
        c.objects.unlink(o)
    target.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def bulb(name, point, mat, target, radius=.035):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=point)
    o = bpy.context.object
    o.name = name
    for c in list(o.users_collection):
        c.objects.unlink(o)
    target.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def attach(child, parent):
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()
    child.matrix_world = world


def lamp_light(name, position, power, target, parent=None):
    data = bpy.data.lights.new(name, 'POINT')
    data.energy = power
    data.color = (1, .72, .43)
    data.shadow_soft_size = .065
    o = bpy.data.objects.new(name, data)
    target.objects.link(o)
    o.location = position
    bpy.context.view_layer.update()
    if parent:
        attach(o, parent)
    o['Adjustment'] = 'Light Properties > Power (watts). Warm practical light; moves with its fixture.'
    return o


def fix_floor(report):
    m = bpy.data.materials['Worn honey floorboards']
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    report['floor_previous_normal_source'] = [l.from_node.name for l in p.inputs['Normal'].links]
    for socket in ['Normal', 'Coat Normal']:
        for link in list(p.inputs[socket].links):
            m.node_tree.links.remove(link)
        p.inputs[socket].default_value = (0, 0, 0)
    # A free-standing vector curve pointed normals beneath the floor. Restore the scan.
    normal = m.node_tree.nodes.new('ShaderNodeNormalMap')
    normal.name = 'RESTORED — floorboard grain normal'
    normal.inputs['Strength'].default_value = .5
    texture = m.node_tree.nodes.new('ShaderNodeTexImage')
    texture.name = 'RESTORED — Poly Haven wood normal'
    texture.image = bpy.data.images.load(str(LIBRARY / 'wood_floor_worn/textures/wood_floor_worn_nor_gl_1k.exr'), check_existing=True)
    texture.image.colorspace_settings.name = 'Non-Color'
    mapping = next(n for n in m.node_tree.nodes if n.type == 'VECT_MATH')
    m.node_tree.links.new(mapping.outputs[0], texture.inputs['Vector'])
    m.node_tree.links.new(texture.outputs['Color'], normal.inputs['Color'])
    m.node_tree.links.new(normal.outputs['Normal'], p.inputs['Normal'])
    for n in list(m.node_tree.nodes):
        if n.type in {'CURVE_VEC', 'COMBXYZ'} and not any(s.is_linked for s in n.outputs):
            m.node_tree.nodes.remove(n)
    report['floor_fixed'] = 'Restored normal map; preserved diffuse, roughness, geometry and owner placement.'


def cleanup_unused(report):
    # Only discard branches that cannot reach either coffee-table material output.
    removed_nodes = []
    for name in ['modern_coffee_table_02_base', 'modern_coffee_table_02_wood']:
        m = bpy.data.materials.get(name)
        if not m or not m.node_tree:
            continue
        keep = set()
        def visit(node):
            if node in keep:
                return
            keep.add(node)
            for socket in node.inputs:
                for link in socket.links:
                    visit(link.from_node)
        for n in m.node_tree.nodes:
            if n.type == 'OUTPUT_MATERIAL':
                visit(n)
        for n in list(m.node_tree.nodes):
            if n not in keep and n.type != 'FRAME':
                removed_nodes.append(name + ' / ' + n.name)
                m.node_tree.nodes.remove(n)
    report['dead_material_nodes_removed'] = removed_nodes
    removed_images = []
    for image in list(bpy.data.images):
        if image.users == 0 and not image.packed_file and not Path(bpy.path.abspath(image.filepath)).exists():
            removed_images.append(image.name)
            bpy.data.images.remove(image)
    report['unreferenced_missing_images_removed'] = removed_images
    removed_handles = []
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY' and not o.data and not o.children and o.name.startswith('Table chair 4 — MOVE THIS'):
            # Preserve any object with a constraint/driver reference, even if visually empty.
            if any(c.target == o for obj in bpy.data.objects for c in obj.constraints if hasattr(c, 'target')):
                continue
            removed_handles.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
    report['abandoned_handles_removed'] = removed_handles
    removed_collections = []
    for c in list(bpy.data.collections):
        if c.objects or c.children:
            continue
        if any(o.instance_collection == c for o in bpy.data.objects if o.instance_type == 'COLLECTION'):
            continue
        if c.name.startswith(('SPOTS', 'CAMERAS', 'ZONE_', 'LOOK', 'ROOM_')):
            continue
        removed_collections.append(c.name)
        bpy.data.collections.remove(c)
    report['empty_collections_removed'] = removed_collections


def convert_photos(report):
    converted = []
    targets = [o for o in bpy.data.objects if o.type == 'EMPTY' and o.empty_display_type == 'IMAGE'
               and not o.name.startswith('REFERENCE')]
    groups = {}
    if targets:
        shared = bpy.data.collections['STUDIO — shared architecture and furniture']
        groups = {'rug': collection('PHOTO CUTOUTS — rugs', shared),
                  'furniture': collection('PHOTO CUTOUTS — furniture (experimental)', shared)}
    for source in targets:
        assert not source.children and not source.animation_data, source.name
        image = source.data
        assert image and image.size[0] and image.size[1], source.name
        aspect = image.size[0] / image.size[1]
        width = source.empty_display_size * min(1, aspect)
        height = source.empty_display_size * min(1, 1 / aspect)
        ox, oy = source.empty_image_offset
        vertices = [(width * (u + ox), height * (v + oy), 0) for u, v in [(0, 0), (1, 0), (1, 1), (0, 1)]]
        mat = material('PHOTO — ' + image.name, (.7, .7, .7), .85)
        p = mat.node_tree.nodes.get('Principled BSDF')
        texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = image
        mat.node_tree.links.new(texture.outputs['Color'], p.inputs['Base Color'])
        mat.node_tree.links.new(texture.outputs['Alpha'], p.inputs['Alpha'])
        # A small fill preserves the photographed tones without making a glowing billboard.
        mat.node_tree.links.new(texture.outputs['Color'], p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = .08
        p.inputs['Specular IOR Level'].default_value = .15
        target = groups['rug' if 'rug' in image.name.lower() else 'furniture']
        plane = mesh('PHOTO — ' + Path(image.name).stem, vertices, [(0, 1, 2, 3)], target, mat)
        plane.matrix_world = source.matrix_world.copy()
        uv = plane.data.uv_layers.new(name='Photo UV')
        for i, value in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
            uv.data[i].uv = value
        plane['Source image'] = image.name
        plane['Photo note'] = 'Renderable flat cutout. Existing owner placement retained; inspect from PANO_CAM. Not a 3D model.'
        record = {'source': source.name, 'image': image.name, 'result': plane.name,
                  'matrix': [list(r) for r in source.matrix_world], 'display_size': source.empty_display_size}
        bpy.context.view_layer.update()
        for local, original in zip(plane.data.vertices, vertices):
            expected = source.matrix_world @ Vector(original)
            actual = plane.matrix_world @ local.co
            assert (expected - actual).length < 1e-5
        converted.append(record)
        bpy.data.objects.remove(source, do_unlink=True)
    report['photos_converted'] = converted


def emission_center(obj):
    """Locate real bulb patches in a scanned lamp's UV emission map."""
    images = {}
    for index, mat in enumerate(obj.data.materials):
        if not mat or not mat.node_tree:
            continue
        for node in mat.node_tree.nodes:
            if node.type != 'BSDF_PRINCIPLED':
                continue
            for link in node.inputs['Emission Color'].links:
                if link.from_node.type == 'TEX_IMAGE' and link.from_node.image:
                    image = link.from_node.image
                    pixels = np.empty(len(image.pixels), dtype=np.float32)
                    image.pixels.foreach_get(pixels)
                    images[index] = (pixels.reshape(image.size[1], image.size[0], image.channels), image.size[:])
    if not images or not obj.data.uv_layers.active:
        points = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
        return sum(points, Vector()) / len(points)
    uv = obj.data.uv_layers.active.data
    total, point = 0., Vector()
    for face in obj.data.polygons:
        if face.material_index not in images:
            continue
        pixels, (w, h) = images[face.material_index]
        coord = sum((uv[i].uv for i in face.loop_indices), Vector((0, 0))) / len(face.loop_indices)
        brightness = float(pixels[int(coord.y % 1 * h) % h, int(coord.x % 1 * w) % w, :3].max())
        if brightness < .12:
            continue
        weight = face.area * brightness
        point += (obj.matrix_world @ face.center) * weight
        total += weight
    if total > 0:
        return point / total
    return obj.matrix_world.translation.copy()


def practical_lights(target, report):
    made = []
    camera = bpy.data.objects['PANO_CAM']
    fixtures = [o for o in bpy.context.scene.objects if o.type == 'MESH' and
                (o.name.startswith('industrial_pipe_lamp') or o.name == 'industrial_wall_lamp')]
    for o in fixtures:
        center = emission_center(o)
        toward_room = camera.matrix_world.translation - center
        toward_room.z *= .25
        center += toward_room.normalized() * .06
        power = 28 if o.name.startswith('industrial_pipe') else 45
        made.append(lamp_light('WARM LIGHT — ' + o.name, center, power, target, o).name)
    warm_glass = material('Warm practical bulb glass', (1, .57, .23), .35, 3)
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('industrial_caged_sconce_c')]:
        points = [o.matrix_world @ Vector(v) for v in o.bound_box]
        center = sum(points, Vector()) / 8
        ymin, ymax = min(p.y for p in points), max(p.y for p in points)
        width = max(p.x for p in points) - min(p.x for p in points)
        for side in [-1, 1]:
            position = Vector((center.x + width * .27 * side, ymax + .025, center.z))
            made.append(lamp_light('WARM LIGHT — ' + o.name + (' left' if side < 0 else ' right'), position, 22, target, o).name)
            glass = bulb('Warm bulb — ' + o.name, position - Vector((0, .04, 0)), warm_glass, target, .025)
            bpy.context.view_layer.update()
            attach(glass, o)
    report['practical_lights_added'] = made


def funky_pendant(target, report):
    brass = material('Aged brass — six-arm pendant', (.24, .13, .045), .38)
    brass.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .8
    black = bpy.data.materials['Blackened steel']
    glow = material('Amber Edison bulbs — pendant', (1, .59, .28), .35, 4)
    handle = bpy.data.objects.new('SIX-ARM PENDANT — MOVE THIS', None)
    target.objects.link(handle)
    handle.empty_display_type = 'PLAIN_AXES'
    handle.empty_display_size = .15
    handle.location = (.2, -2.0, 2.8)
    bpy.context.view_layer.update()
    origin = handle.matrix_world.translation
    parts = [tube('Pendant suspension', origin + Vector((0, 0, .56)), origin, .012, black, target),
             bulb('Pendant brass hub', origin, brass, target, .09)]
    for i in range(6):
        angle = i * math.tau / 6
        end = origin + Vector((math.cos(angle) * .34, math.sin(angle) * .34, .04 if i % 2 else -.06))
        parts.append(tube('Pendant brass arm', origin, end, .013, brass, target))
        parts.append(bulb('Pendant Edison bulb', end, glow, target, .047))
    bpy.context.view_layer.update()
    for o in parts:
        attach(o, handle)
    lamp_light('WARM LIGHT — six-arm pendant', origin + Vector((0, 0, -.13)), 38, target, handle)
    report['new_lamp'] = 'One original six-arm brass/black Edison-style pendant. Separate FINISHES collection; reversible.'


def tabletop_paint(report):
    obj = bpy.data.objects.get('Painting table — worn solid timber top')
    if not obj:
        return
    original = obj.data.materials[0]
    mat = original.copy()
    mat.name = 'Painting table — sparse paint freckles over worn wood'
    obj.data.materials[0] = mat
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    original_color = shader.inputs['Base Color'].links[0].from_socket
    coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 110
    noise.inputs['Detail'].default_value = 2
    links.new(coord.outputs['Generated'], noise.inputs['Vector'])
    mask = nodes.new('ShaderNodeValToRGB')
    mask.name = 'Sparse paint only — keep the wood visible'
    mask.color_ramp.elements[0].position = .74
    mask.color_ramp.elements[1].position = .80
    links.new(noise.outputs['Fac'], mask.inputs[0])
    colors = nodes.new('ShaderNodeValToRGB')
    colors.color_ramp.elements[0].color = (.025, .05, .27, 1)
    colors.color_ramp.elements[1].color = (.72, .13, .035, 1)
    middle = colors.color_ramp.elements.new(.52)
    middle.color = (.53, .63, .08, 1)
    links.new(noise.outputs['Color'], colors.inputs[0])
    mix = nodes.new('ShaderNodeMixRGB')
    links.new(mask.outputs['Color'], mix.inputs[0])
    links.new(original_color, mix.inputs[1])
    links.new(colors.outputs['Color'], mix.inputs[2])
    links.new(mix.outputs[0], shader.inputs['Base Color'])
    report['surface_finish'] = 'Sparse original paint freckles on main table only; floor/ceiling do not inherit them.'


def small_art(target, report):
    palette = [material('Original print — ultramarine', (.025, .065, .24)),
               material('Original print — vermilion', (.6, .10, .035)),
               material('Original print — chartreuse', (.36, .43, .045))]
    made = []
    for index, name in enumerate(['Small studio artwork paper.001', 'Small studio artwork paper.002']):
        paper = bpy.data.objects.get(name)
        if not paper:
            continue
        points = [Vector(p) for p in paper.bound_box]
        width = max(p.x for p in points) - min(p.x for p in points)
        height = max(p.z for p in points) - min(p.z for p in points)
        y = min(p.y for p in points) - .002
        # Flat, original geometric colour studies; existing blank easels remain blank.
        for j, (cx, cz, sx, sz) in enumerate([(-.15, -.12, .45, .38), (.16, .17, .25, .39)]):
            x, z, dx, dz = cx * width, cz * height, sx * width / 2, sz * height / 2
            o = mesh('Original colour study — block', [(x-dx,y,z-dz),(x+dx,y,z-dz),(x+dx,y,z+dz),(x-dx,y,z+dz)], [(0,1,2,3)], target, palette[(index+j)%3])
            o.parent = paper
            o.matrix_parent_inverse = Matrix.Identity(4)
            made.append(o.name)
        radius = min(width,height) * .12
        vertices = [(math.cos(a * math.tau/40)*radius + width*.12, y-.001,
                     math.sin(a * math.tau/40)*radius-height*.2) for a in range(40)]
        o = mesh('Original colour study — circle', vertices, [tuple(range(40))], target, palette[(index+2)%3])
        o.parent = paper
        o.matrix_parent_inverse = Matrix.Identity(4)
        made.append(o.name)
    report['small_original_art_added'] = made


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    source = Path(bpy.data.filepath)
    assert source.parent == ROOT / 'studio/blender', 'Open the owner file, not a prior candidate.'
    assert not bpy.context.scene.get('cleanup_2026_10_28'), 'This file is already repaired.'
    CACHE.mkdir(parents=True, exist_ok=True)
    RENDERS.mkdir(parents=True, exist_ok=True)
    bpy.context.view_layer.update()
    before = {o.name:[list(r) for r in o.matrix_basis] for o in bpy.data.objects if o.type in {'MESH','CAMERA','ARMATURE'}}
    report = {'source':str(source)}
    fix_floor(report)
    cleanup_unused(report)
    convert_photos(report)
    shared = bpy.data.collections['STUDIO — shared architecture and furniture']
    finishing = collection('FINISHES — warm practicals, original prints and pendant', shared)
    practical_lights(finishing, report)
    funky_pendant(finishing, report)
    tabletop_paint(report)
    small_art(finishing, report)
    # Keep parent handles and SPOTS; they look empty but carry essential relationships.
    for scene in bpy.data.scenes:
        scene['cleanup_2026_10_28'] = True
        scene.camera = bpy.data.objects['PANO_CAM']
        scene.render.engine = 'CYCLES'
        scene.render.resolution_x = 4096
        scene.render.resolution_y = 2048
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.cycles.samples = 128
        scene.cycles.use_denoising = True
        scene.cycles.transparent_max_bounces = 16
        scene.render.filepath = str(RENDERS / (source.stem + '-' + scene.get('render_slug', 'red-afternoon') + '-4k.png'))
    bpy.context.view_layer.update()
    changed = []
    for name, basis in before.items():
        o = bpy.data.objects.get(name)
        assert o is not None, 'Existing geometry was removed: ' + name
        error = max(abs(o.matrix_basis[r][c]-basis[r][c]) for r in range(4) for c in range(4))
        if error > 1e-6:
            changed.append((name,error))
    assert not changed, changed
    report['existing_geometry_and_camera_transforms_preserved'] = len(before)
    bpy.ops.file.pack_all()
    unresolved = [i.name for i in bpy.data.images if i.source == 'FILE' and i.users and not i.packed_file
                  and not Path(bpy.path.abspath(i.filepath)).exists()]
    assert not unresolved, unresolved
    report['packed_image_count'] = len([i for i in bpy.data.images if i.packed_file])
    # An in-file note makes the render command easy to recover next time.
    note = bpy.data.texts.get('START HERE — render and photo notes') or bpy.data.texts.new('START HERE — render and photo notes')
    note.clear()
    note.write('RENDER A PANORAMA\nChoose the Red / late afternoon scene. PANO_CAM is already active.\n'
               'Top menu: Render > Render Image (F12 / fn+F12).\n'
               'Render window: Image > Save As. Use a 2:1 resolution: 4096 x 2048.\n\n'
               'PHOTOS\nThe four placed IMAGE empties in the wphotos file were converted to alpha-textured mesh planes.\n'
               'They render now but remain flat cutouts. Check from PANO_CAM, not a roaming viewport.\n'
               'PHOTO CUTOUTS collections separate rugs from optional furniture. They are shared across lighting scenes.\n'
               'SOURCE references and SPOTS are intentional; do not delete their empties.\n\n'
               'LIGHTING\nFINISHES collection contains new warm point lights, parented to existing fixtures,\n'
               'one optional six-arm brass pendant and two original small colour studies.\n'
               'Select a WARM LIGHT object > Light Properties > Power to brighten/dim it.\n'
               'The main floor repair restores its normal map; owner geometry placement is unchanged.\n')
    candidate = CACHE / source.name
    bpy.ops.wm.save_as_mainfile(filepath=str(candidate))
    report['candidate'] = str(candidate)
    (CACHE / (source.stem + '-cleanup-report.json')).write_text(json.dumps(report, indent=2))
    print('CANDIDATE SAVED', candidate, flush=True)
    if args.render:
        scene = bpy.context.scene
        scene.cycles.samples = 48
        scene.cycles.device = 'GPU'
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for device in prefs.devices:
            device.use = device.type == 'METAL'
        scene.render.resolution_x = 2048
        scene.render.resolution_y = 1024
        scene.render.filepath = str(RENDERS / (source.stem + '-review-2k.png'))
        bpy.ops.render.render(write_still=True)
        print('REVIEW RENDER COMPLETE', flush=True)


if __name__ == '__main__':
    main()
