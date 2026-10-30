"""Build an editable Cream City loft using the owner's installed Poly Haven library.

Run with Blender, not system Python. See studio/CREAM-CITY-GUIDE.md.
Only writes the new cream-city-studio.blend and its own review renders.
"""

import argparse
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "studio" / "renders" / "cream-city"
BLEND = ROOT / "studio" / "blender" / "cream-city-studio.blend"
random.seed(27)


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--library", type=Path)
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def collection(name, parent):
    result = bpy.data.collections.new(name)
    parent.children.link(result)
    return result


def move_to(obj, target):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def material(name, color, roughness=0.65, metallic=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return result


def pbr(name, asset, library, cream=False):
    """UVs are measured in metres, so every wall keeps the same brick size."""
    folder = library / asset
    info = json.loads((folder / "info.json").read_text())
    size = info["dimensions"][0] / 1000
    result = material(name, (0.5, 0.4, 0.3))
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    shader = nodes.get("Principled BSDF")
    coordinates = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeVectorMath")
    mapping.operation = "SCALE"
    mapping.inputs[3].default_value = 1 / size
    links.new(coordinates.outputs["UV"], mapping.inputs[0])
    textures = list((folder / "textures").iterdir())
    for token, socket in [("_diff_", "Base Color"), ("_rough_", "Roughness"), ("_nor_gl_", None)]:
        path = next(p for p in textures if token in p.name)
        node = nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(path), check_existing=True)
        if token != "_diff_":
            node.image.colorspace_settings.name = "Non-Color"
        links.new(mapping.outputs[0], node.inputs["Vector"])
        if socket == "Base Color" and cream:
            ramp = nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].position = 0.08
            ramp.color_ramp.elements[0].color = (0.23, 0.185, 0.115, 1)
            ramp.color_ramp.elements[1].position = 0.78
            ramp.color_ramp.elements[1].color = (0.79, 0.67, 0.45, 1)
            links.new(node.outputs["Color"], ramp.inputs[0])
            links.new(ramp.outputs[0], shader.inputs[socket])
        elif socket:
            links.new(node.outputs["Color"], shader.inputs[socket])
        else:
            normal = nodes.new("ShaderNodeNormalMap")
            normal.inputs["Strength"].default_value = 0.65
            links.new(node.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs[0], shader.inputs["Normal"])
    return result


def box(name, location, size, mat, target, bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Project each face in world metres, avoiding stretched brickwork on long walls.
    uv = obj.data.uv_layers.active
    for face in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        axes = (1, 2) if axis == 0 else (0, 2) if axis == 1 else (0, 1)
        for index in face.loop_indices:
            point = obj.data.vertices[obj.data.loops[index].vertex_index].co + obj.location
            uv.data[index].uv = (point[axes[0]], point[axes[1]])
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft real-world edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return move_to(obj, target)


def cylinder(name, start, end, radius, mat, target):
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=direction.length,
                                      location=(Vector(start) + Vector(end)) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return move_to(obj, target)


def ellipsoid(name, location, size, mat, target):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return move_to(obj, target)


def asset(name, label, location, width, rotation, target, library):
    path = library / name / (name + ".blend")
    with bpy.data.libraries.load(str(path), link=False) as (source, loaded):
        loaded.collections = [source.collections[0]]
    source_collection = loaded.collections[0]
    target.children.link(source_collection)
    source_collection.name = label
    # A parent Empty makes each multi-part scan movable as one item.
    parent = bpy.data.objects.new(label + " — MOVE THIS", None)
    target.objects.link(parent)
    parent.empty_display_type = "PLAIN_AXES"
    parent.empty_display_size = 0.3
    meshes = [o for o in source_collection.all_objects if o.type == "MESH"]
    points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    xmin, xmax = min(v.x for v in points), max(v.x for v in points)
    ymin, ymax = min(v.y for v in points), max(v.y for v in points)
    zmin = min(v.z for v in points)
    center = Vector(((xmin + xmax) / 2, (ymin + ymax) / 2, zmin))
    factor = width / (xmax - xmin)
    for obj in list(source_collection.objects):
        if obj.parent is None:
            obj.location -= center
            obj.parent = parent
    parent.scale = (factor,) * 3
    parent.location = location
    parent.rotation_euler.z = math.radians(rotation)
    parent["source"] = "Poly Haven / " + name + " / CC0"
    return parent


def text(name, content, location, size, mat, target, rotation=(90, 0, 0)):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = content
    curve.align_x = "CENTER"
    curve.size = size
    curve.extrude = 0.002
    curve.bevel_depth = 0.003
    obj = bpy.data.objects.new(name, curve)
    target.objects.link(obj)
    obj.location = location
    obj.rotation_euler = tuple(math.radians(a) for a in rotation)
    obj.data.materials.append(mat)
    return obj


def light(name, location, energy, color, target, aim=None, size=1):
    data = bpy.data.lights.new(name, "AREA" if aim is not None else "POINT")
    data.energy = energy
    data.color = color
    if aim is not None:
        data.shape = "DISK"
        data.size = size
    else:
        data.shadow_soft_size = size
    obj = bpy.data.objects.new(name, data)
    target.objects.link(obj)
    obj.location = location
    if aim is not None:
        obj.rotation_euler = (Vector(aim) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def spot(name, label, location, target, zone):
    obj = bpy.data.objects.new("spot_" + name, None)
    obj.location = location
    obj.empty_display_type = "SPHERE"
    obj.empty_display_size = 0.12
    obj["label"] = label
    obj["zone"] = zone
    target.objects.link(obj)


def rug(name, center, size, target, colors):
    x, y = center
    width, depth = size
    for i, color in enumerate(colors):
        border = 0.13 * i
        mat = material(name + " woven band " + str(i), color, 0.98)
        box(name + " border " + str(i), (x, y, 0.018 + i * 0.002),
            (width - border * 2, depth - border * 2, 0.008), mat, target, 0.003)
    # Small diamonds suggest a woven kilim without bringing in unlicensed artwork.
    for row in range(5):
        for col in range(3):
            obj = box(name + " woven diamond", (x + (col - 1) * 0.45, y + (row - 2) * 0.4, 0.034),
                      (0.20, 0.20, 0.004), bpy.data.materials[name + " woven band 1"], target, 0)
            obj.rotation_euler.z = math.pi / 4


def build(library):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    base_scene = bpy.context.scene
    base_scene.name = "01 — Lime / daylight"
    shared = collection("STUDIO — shared architecture and furniture", base_scene.collection)
    shell = collection("ROOM_shell — 11m × 8m × 3.6m", shared)
    table = collection("ZONE_table", shared)
    lounge = collection("ZONE_couch", shared)
    cats = collection("ZONE_cats — sculpted placeholders", shared)
    art = collection("ZONE_easel", shared)
    cafe = collection("ZONE_snacks — coffee nook", shared)
    details = collection("ROOM_pipes_lights_details", shared)
    spots = collection("SPOTS — export after final placement", shared)
    cameras = collection("CAMERAS", shared)
    references = collection("REFERENCES — your original cutouts (hidden)", shared)
    references.hide_render = True
    references.hide_viewport = True

    cream = pbr("Cream City — warm buff brick (tinted scan, not exact local brick)", "whitewashed_brick", library, True)
    floor = pbr("Worn honey floorboards", "wood_floor_worn", library)
    wood = pbr("Walnut and exposed timber", "wood_floor", library)
    concrete = pbr("Concrete — workshop and coffee nook", "concrete_floor", library)
    black = material("Blackened steel", (0.022, 0.027, 0.025), 0.37, 0.7)
    silver = material("Galvanised ductwork", (0.38, 0.4, 0.41), 0.37, 0.82)
    paper = material("Unpainted canvas — space for your own work", (0.85, 0.81, 0.69), 0.92)
    orange = material("Burnt orange upholstery", (0.52, 0.13, 0.035), 0.95)
    olive = material("Olive green upholstery", (0.12, 0.18, 0.06), 0.95)
    terracotta = material("Terracotta", (0.43, 0.135, 0.06))
    sisal = material("Sisal — cat scratch posts", (0.47, 0.35, 0.19), 1)
    oatmeal = material("Cat tree felt", (0.43, 0.40, 0.32), 1)

    box("Hardwood — main studio", (-1.1, 0, -0.10), (8.8, 8, 0.2), floor, shell)
    box("Concrete — side aisle", (4.4, 0, -0.10), (2.2, 8, 0.2), concrete, shell)
    box("Brass floor transition", (3.3, 0, 0.003), (0.025, 8, 0.006), silver, shell, 0)
    box("North — long brick wall", (0, 4.12, 1.8), (11.25, 0.24, 3.6), cream, shell)
    box("South — brick wall", (0, -4.12, 1.8), (11.25, 0.24, 3.6), cream, shell)
    box("East — brick beside opening", (5.62, 2.15, 1.8), (0.24, 3.7, 3.6), cream, shell)
    box("East — brick beside opening south", (5.62, -3.35, 1.8), (0.24, 1.3, 3.6), cream, shell)
    box("East — doorway lintel", (5.62, -1.2, 3.27), (0.24, 3, 0.66), cream, shell)
    # A real adjoining room makes the opening read as depth rather than a painted door.
    box("Nook concrete floor", (7.2, -1.2, -0.1), (3.2, 3, 0.2), concrete, shell)
    box("Nook end wall", (8.82, -1.2, 1.8), (0.24, 3.25, 3.6), cream, shell)
    for y in [-2.82, 0.42]:
        box("Nook side wall", (7.2, y, 1.8), (3.2, 0.24, 3.6), cream, shell)
    box("Ceiling timber deck", (1.6, 0, 3.72), (14.5, 8.25, 0.2), wood, shell)
    for y in [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]:
        box("Exposed ceiling joist", (0, y, 3.43), (11.2, 0.14, 0.35), wood, shell)
    for x in [-3.65, 2.6]:
        box("Heavy cross beam", (x, 0, 3.18), (0.23, 8, 0.25), wood, shell)
    # Solid masonry around actual openings, rather than glass pasted over a wall.
    box("Window wall low brick", (-5.62, 0, 0.39), (0.24, 8.25, 0.78), cream, shell)
    box("Window wall upper brick", (-5.62, 0, 3.28), (0.24, 8.25, 0.64), cream, shell)
    for y in [-4, -2, 0, 2, 4]:
        box("Window brick pier", (-5.62, y, 1.85), (0.26, 0.28, 2.2), cream, shell)
    for y in [-3, -1, 1, 3]:
        for edge in [-0.86, 0.86]:
            box("Window frame upright", (-5.49, y + edge, 1.88), (0.12, 0.06, 2.18), black, shell)
        for z in [0.8, 1.52, 2.23, 2.96]:
            box("Window transom", (-5.49, y, z), (0.12, 1.78, 0.055), black, shell)
        box("Window central mullion", (-5.49, y, 1.88), (0.12, 0.045, 2.18), black, shell)
        box("Deep timber windowsill", (-5.43, y, 0.79), (0.48, 1.87, 0.065), wood, shell)
    # Distant masonry outside prevents the windows from opening into an empty void.
    exterior = material("Distant neighbouring brick", (0.30, 0.25, 0.19))
    box("Neighbouring building outside", (-14, 0, 1.4), (0.4, 24, 4), exterior, shell)
    windowmat = material("Distant blue-grey windows", (0.19, 0.25, 0.29), 0.3, 0.3)
    for y in range(-10, 11, 2):
        for z in [0.7, 2.7]:
            box("Neighbour window", (-13.77, y, z), (0.04, 0.9, 1.3), windowmat, shell)

    for y in [-2.8, 2.6]:
        cylinder("Long black service pipe", (-5.3, y, 3.06), (5.3, y, 3.06), 0.035, black, details)
    cylinder("Silver ventilation duct", (2, -3.9, 3.02), (2, 3.9, 3.02), 0.14, silver, details)
    for y in [-3, -1.5, 0, 1.5, 3]:
        cylinder("Duct joint collar", (2, y - 0.02, 3.02), (2, y + 0.02, 3.02), 0.15, silver, details)
    box("Black track lighting rail", (3.5, 2.7, 3.12), (3, 0.045, 0.045), black, details)
    for x in [2.35, 3.5, 4.65]:
        cylinder("Track light body", (x, 2.7, 3.1), (x, 2.8, 2.91), 0.075, black, details)
    for x, y in [(-1.3, 1.2), (1.3, 1.2), (-2.3, -2.6)]:
        asset("hanging_industrial_lamp", "Industrial pendant", (x, y, 2.12), 0.5, 0, details, library)

    # Main surface has no finished artwork: it belongs to the people at the party.
    box("Painting table — worn solid timber top", (0, 1.55, 0.80), (2.85, 1.24, 0.09), wood, table)
    for x in [-1.15, 1.15]:
        for y in [1.10, 2.0]:
            box("Painting table leg", (x, y, 0.39), (0.09, 0.09, 0.78), wood, table)
    box("Blank shared canvas", (0, 1.55, 0.856), (1.25, 0.82, 0.018), paper, table)
    for index, (x, y, angle) in enumerate([(-0.85, 0.45, 180), (0.85, 0.45, 180), (-0.85, 2.65, 0), (0.85, 2.65, 0)]):
        asset("painted_wooden_chair_01", "Table chair " + str(index + 1), (x, y, 0.035), 0.46, angle, table, library)
        spot("table_" + str(index + 1), "Painting table, seat " + str(index + 1), (x, y, 1.28), spots, "table")
    for x in [-1.08, 1.08]:
        cylinder("Brush pot", (x, 1.6, 0.85), (x, 1.6, 1.0), 0.07, terracotta, table)
        for i in range(7):
            px, py = x + random.uniform(-0.035, 0.035), 1.6 + random.uniform(-0.035, 0.035)
            cylinder("Brush handle", (px, py, 0.90), (px + 0.02, py, 1.16 + random.random() * 0.07), 0.005, wood, table)

    rug("Lounge kilim", (-2.4, -2.15), (3.7, 2.7), lounge,
        [(0.30, 0.065, 0.045), (0.59, 0.39, 0.16), (0.12, 0.19, 0.22), (0.38, 0.105, 0.065)])
    # The orange couch echoes the owner's sheet-covered sofa without pretending a PNG is a model.
    box("Orange sofa — seat", (-2.4, -3.20, 0.44), (2.45, 0.85, 0.28), orange, lounge, 0.13)
    box("Orange sofa — back", (-2.4, -3.60, 0.78), (2.48, 0.24, 0.70), orange, lounge, 0.10)
    for x in [-3.55, -1.25]:
        box("Orange sofa arm", (x, -3.19, 0.64), (0.22, 0.9, 0.55), orange, lounge, 0.10)
        for y in [-3.45, -2.95]:
            box("Sofa foot", (x, y, 0.10), (0.08, 0.08, 0.20), wood, lounge)
    for x in [-3.1, -2.4, -1.7]:
        cushion = box("Loose sofa cushion", (x, -3.40, 0.87), (0.62, 0.21, 0.48), orange, lounge, 0.10)
        cushion.rotation_euler.x = -0.15
    asset("wooden_table_02", "Low coffee table", (-2.4, -1.87, 0.035), 1.05, 8, lounge, library).scale.z *= 0.6
    asset("modern_arm_chair_01", "Lounge armchair", (-4.35, -1.3, 0.035), 0.82, -60, lounge, library)
    asset("Rockingchair_01", "Rocking chair nook", (0.55, -3.0, 0.035), 0.75, 15, lounge, library)
    ellipsoid("Olive beanbag — replace with cloth or chosen model", (2.3, -3.1, 0.35), (0.7, 0.7, 0.38), olive, lounge)
    spot("couch_left", "Orange sofa, left", (-3.1, -3.1, 1.25), spots, "couch")
    spot("couch_right", "Orange sofa, right", (-1.7, -3.1, 1.25), spots, "couch")
    spot("rocker", "Rocking chair", (0.55, -3, 1.3), spots, "rocker")
    spot("beanbag", "Green beanbag", (2.3, -3.1, 0.95), spots, "beanbag")

    # Cat silhouettes are deliberately labelled maquettes, pending a licensed realistic model.
    box("Cat tree base", (-4.6, 2.8, 0.08), (1.0, 0.8, 0.16), oatmeal, cats, 0.05)
    for x, y, height in [(-4.9, 2.65, 1.8), (-4.35, 2.85, 1.15)]:
        cylinder("Sisal scratching post", (x, y, 0.15), (x, y, height), 0.065, sisal, cats)
        box("Cat tree perch", (x, y, height), (0.72, 0.58, 0.07), oatmeal, cats, 0.05)
    for index, (x, y, z, color) in enumerate([(-4.9, 2.65, 1.89, (0.12, 0.1, 0.08)), (-4.35, 2.85, 1.24, (0.62, 0.33, 0.12))]):
        fur = material("Cat maquette " + str(index), color, 1)
        ellipsoid("Sleeping cat — body placeholder", (x, y, z + 0.09), (0.26, 0.16, 0.12), fur, cats)
        ellipsoid("Sleeping cat — head placeholder", (x + 0.17, y - 0.03, z + 0.16), (0.105, 0.09, 0.09), fur, cats)
        for ear in [-0.05, 0.05]:
            bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.043, depth=0.09, location=(x + 0.17, y + ear, z + 0.26))
            obj = bpy.context.object
            obj.name = "Cat maquette ear"
            obj.data.materials.append(fur)
            move_to(obj, cats)
    spot("cats_top", "Cat tree, top perch", (-4.9, 2.65, 1.95), spots, "cats")
    spot("cats_lower", "Cat tree, lower perch", (-4.35, 2.85, 1.3), spots, "cats")

    for x, y, width in [(-4.7, -3.4, 0.8), (-4.8, 0.1, 0.75), (4.7, 3.2, 0.9), (7.9, -2.3, 0.55)]:
        asset("potted_plant_02", "Potted greenery", (x, y, 0.03), width, 0, details, library)
    # Blank canvases on an easel, drying rack and wall leave room for guest art.
    for x in [2.1, 3.7]:
        for dx in [-0.27, 0.27]:
            cylinder("Easel front leg", (x + dx, 3.2, 0), (x + dx * 0.4, 3.45, 2.1), 0.024, wood, art)
        cylinder("Easel back leg", (x, 3.85, 0), (x, 3.42, 1.9), 0.022, wood, art)
        box("Easel canvas ledge", (x, 3.34, 0.85), (0.85, 0.10, 0.06), wood, art)
        box("Blank stretched canvas", (x, 3.43, 1.35), (0.72, 0.045, 0.92), paper, art)
    for i in range(4):
        panel = box("Leaning spare canvas", (4.6 + i * 0.07, 3.2 - i * 0.07, 0.52), (0.06, 0.75, 1.0), paper, art)
        panel.rotation_euler.y = -0.12
    for x, width, height in [(-2.7, 0.8, 1.05), (-1.45, 0.6, 0.8), (0, 0.95, 0.7)]:
        box("Simple timber art frame", (x, 3.96, 2.05), (width + 0.06, 0.05, height + 0.06), wood, art)
        box("Small studio artwork paper", (x, 3.92, 2.05), (width, 0.012, height), paper, art)
        # Original, restrained colour study instead of somebody else's reference photograph.
        box("Original abstract colour study", (x, 3.906, 2.08), (width * 0.55, 0.008, height * 0.45), olive if x < -2 else orange, art, 0)

    box("Coffee nook worktop", (7.8, -1.2, 0.95), (1.4, 0.65, 0.08), wood, cafe)
    for x in [7.25, 8.35]:
        box("Coffee counter base", (x, -1.2, 0.46), (0.15, 0.6, 0.92), black, cafe)
    box("Coffee machine — simple placeholder", (7.8, -1.2, 1.2), (0.48, 0.38, 0.42), silver, cafe, 0.04)
    box("Coffee machine dark fascia", (7.8, -1.407, 1.23), (0.4, 0.02, 0.25), black, cafe)
    for x in [7.2, 8.3]:
        cylinder("Coffee mug", (x, -1.25, 1), (x, -1.25, 1.11), 0.045, paper, cafe)
    text("Nook hand-lettered sign", "COFFEE / IDEAS", (8.67, -1.2, 2.15), 0.19, paper, cafe, (90, 0, -90))

    # Readily selectable image references retain every original, without baking them into renders.
    for index, path in enumerate(sorted((ROOT / "_design" / "room-elements").glob("*.png"))):
        obj = bpy.data.objects.new("REFERENCE — " + path.stem, None)
        obj.empty_display_type = "IMAGE"
        obj.data = bpy.data.images.load(str(path), check_existing=True)
        obj.empty_display_size = 1.5
        obj.location = (14 + (index % 6) * 2, (index // 6) * 2, 1.2)
        obj["note"] = "Original 2D cutout. Reference only; not a 3D mesh."
        references.objects.link(obj)

    pano_data = bpy.data.cameras.new("PANO_CAM")
    pano_data.type = "PANO"
    pano_data.panorama_type = "EQUIRECTANGULAR"
    pano = bpy.data.objects.new("PANO_CAM", pano_data)
    cameras.objects.link(pano)
    pano.location = (0, -0.75, 1.6)
    pano.rotation_euler = (math.pi / 2, 0, 0)
    preview_data = bpy.data.cameras.new("REVIEW_CAM")
    preview_data.lens = 20
    preview = bpy.data.objects.new("REVIEW_CAM", preview_data)
    cameras.objects.link(preview)
    preview.location = (4.8, -3.45, 1.85)
    preview.rotation_euler = (Vector((-1.3, 1.3, 1.65)) - preview.location).to_track_quat("-Z", "Y").to_euler()
    spot("canvas", "Shared painting canvas", (0, 1.55, 0.87), spots, "table")

    variants = [
        ("01 — Lime / daylight", "lime-daylight", (0.38, 0.52, 0.035), (0.78, 0.85, 1), 0.40, 650, "CREATE COOL SH*T"),
        ("02 — Red / late afternoon", "red-afternoon", (0.48, 0.035, 0.025), (1, 0.72, 0.43), 0.23, 500, "ART IS RESISTANCE"),
        ("03 — Charcoal / evening", "charcoal-evening", (0.035, 0.043, 0.045), (0.32, 0.46, 0.72), 0.10, 280, "CREATE COOL SH*T"),
    ]
    scenes = []
    for index, (name, slug, color, sky, strength, daylight, words) in enumerate(variants):
        scene = base_scene if index == 0 else bpy.data.scenes.new(name)
        if index:
            scene.collection.children.link(shared)
        scene["render_slug"] = slug
        scene["status"] = "Editable design draft. Cats, beanbag and coffee machine are maquettes."
        scene.unit_settings.system = "METRIC"
        scene.camera = pano
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 128
        scene.cycles.use_denoising = True
        scene.cycles.device = "GPU"
        scene.render.resolution_x = 4096
        scene.render.resolution_y = 2048
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = str(OUTPUT / (slug + "-panorama.png"))
        scene.view_settings.view_transform = "AgX"
        scene.world = bpy.data.worlds.new(name + " sky")
        scene.world.use_nodes = True
        background = scene.world.node_tree.nodes.get("Background")
        background.inputs[0].default_value = (*sky, 1)
        background.inputs[1].default_value = strength
        variant = collection("LOOK — " + slug + " — accent and lighting", scene.collection)
        accent = material("ACCENT — " + slug + " — change Base Color", color, 0.86)
        box("Painted accent wall — north end", (3.9, 3.965, 1.65), (3.2, 0.045, 3.3), accent, variant)
        box("Painted nook reveal", (5.485, -2.9, 1.65), (0.045, 0.65, 3.3), accent, variant)
        box("Accent in adjoining room", (8.68, -1.2, 1.65), (0.045, 3, 3.3), accent, variant)
        neon = material("NEON — " + slug, (1, 0.58, 0.22))
        shader = neon.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Emission Color"].default_value = (1, 0.39, 0.11, 1)
        shader.inputs["Emission Strength"].default_value = 5
        text("Editable neon lettering", words, (3.9, 3.88, 2.58), 0.17, neon, variant)
        # Quiet original graffiti on the entry-side brick, away from the main painting view.
        text("Original brick graffiti", "MAKE\nSOMETHING", (3.5, -3.96, 1.75), 0.31, accent, variant, (90, 0, 180))
        for y in [-3, -1, 1, 3]:
            light("Window daylight", (-5.95, y, 2.0), daylight, sky, variant, (0, y, 0.5), 1.5)
        for x, y in [(-1.3, 1.2), (1.3, 1.2), (-2.3, -2.6)]:
            light("Warm pendant pool", (x, y, 2.35), 130 if index < 2 else 230, (1, 0.70, 0.43), variant, (x, y, 0), 0.45)
        light("Coffee nook warm light", (7, -1.2, 2.8), 110, (1, 0.71, 0.42), variant, (7.5, -1.2, 0), 0.8)
        light("Neon wall wash", (3.9, 3.6, 2.6), 15 if index < 2 else 35, (1, 0.28, 0.06), variant, None, 0.45)
        for x in [2.35, 3.5, 4.65]:
            light("Art wall track spotlight", (x, 2.78, 2.9), 45, (1, 0.82, 0.58), variant, (x, 3.95, 1.5), 0.16)
        # Glare is kept subtle; the image still has to work behind accessible HTML controls.
        compositor = bpy.data.node_groups.new(name + " subtle glow", "CompositorNodeTree")
        compositor.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        scene.compositing_node_group = compositor
        nodes = compositor.nodes
        render = nodes.new("CompositorNodeRLayers")
        glare = nodes.new("CompositorNodeGlare")
        glare.inputs["Type"].default_value = "Fog Glow"
        glare.inputs["Quality"].default_value = "Medium"
        glare.inputs["Strength"].default_value = 0.2
        render.scene = scene
        output = nodes.new("NodeGroupOutput")
        compositor.links.new(render.outputs["Image"], glare.inputs["Image"])
        compositor.links.new(glare.outputs["Image"], output.inputs["Image"])
        scenes.append(scene)
    return scenes, pano, preview


def main():
    args = arguments()
    if BLEND.exists() and not args.force:
        raise RuntimeError("Refusing to overwrite your editable studio. Use a copy or explicitly pass --force.")
    library = args.library
    if library is None:
        registered = bpy.context.preferences.filepaths.asset_libraries.get("Poly Haven")
        if registered:
            library = Path(registered.path)
    if library is None or not (library / "whitewashed_brick" / "info.json").exists():
        raise RuntimeError("Poly Haven library not found. Supply --library /path/to/library.")
    required = ["whitewashed_brick", "wood_floor_worn", "wood_floor", "concrete_floor", "hanging_industrial_lamp",
                "painted_wooden_chair_01", "wooden_table_02", "modern_arm_chair_01", "Rockingchair_01", "potted_plant_02"]
    missing = [name for name in required if not (library / name / (name + ".blend")).exists()]
    if missing:
        raise RuntimeError("Download these library assets first: " + ", ".join(missing))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    scenes, pano, preview = build(library)
    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = "METAL"
    preferences.get_devices()
    for device in preferences.devices:
        device.use = device.type == "METAL"
    # Pack image bytes so moving the .blend will not break the downloaded scans.
    bpy.ops.file.pack_all()
    bpy.context.window.scene = scenes[0]
    # Open inside the room instead of showing the outside of its opaque roof.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.shading.type = "MATERIAL"
                area.spaces.active.overlay.show_overlays = False
    welcome = bpy.data.texts.new("START HERE — Cream City studio")
    welcome.write(
        "Three looks: use the scene selector at the top right.\n"
        "Architecture and furniture are shared. Accent colours and lights are independent.\n"
        "Select a scanned prop's MOVE THIS parent to move the whole object.\n"
        "Cats and several props are maquettes. Photographic studies are separate AI images, not exact renders.\n"
        "Beginner guide: studio/CREAM-CITY-GUIDE.md in the project folder.\n"
        "PANO_CAM renders a 2:1 panorama; REVIEW_CAM is an ordinary perspective camera.\n"
        "Save As a working copy before changing the layout or rerunning the generator.\n"
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    if args.render:
        for scene in scenes:
            bpy.context.window.scene = scene
            scene.cycles.samples = 48
            scene.render.resolution_x = 1600
            scene.render.resolution_y = 1000
            scene.camera = preview
            scene.render.filepath = str(OUTPUT / (scene["render_slug"] + "-review.png"))
            bpy.ops.render.render(write_still=True)
            scene.camera = pano
            scene.render.resolution_x = 2048
            scene.render.resolution_y = 1024
            scene.cycles.samples = 48
            scene.render.filepath = str(OUTPUT / (scene["render_slug"] + "-panorama-draft.png"))
            bpy.ops.render.render(write_still=True)
    print("Saved editable studio:", BLEND)


if __name__ == "__main__":
    main()
