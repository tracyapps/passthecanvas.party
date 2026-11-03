# Inspect the Cream City scene: objects, materials, cameras, images.
# Usage: Blender -b <file.blend> --python studio/scripts/inspect_scene.py -- <out.json>
import bpy, json, sys
out = sys.argv[sys.argv.index('--') + 1]
scene = bpy.context.scene
data = {
  'version': bpy.app.version_string, 'scene': scene.name, 'engine': scene.render.engine,
  'resolution': [scene.render.resolution_x, scene.render.resolution_y], 'samples': getattr(scene.cycles, 'samples', None),
  'camera': scene.camera.name if scene.camera else None,
  'objects': [], 'images': [], 'materials': []
}
for o in bpy.data.objects:
    entry = {'name': o.name, 'type': o.type, 'loc': [round(v, 3) for v in o.matrix_world.translation],
             'dims': [round(v, 3) for v in o.dimensions], 'hidden': o.hide_render,
             'collections': [c.name for c in o.users_collection], 'parent': o.parent.name if o.parent else None}
    if o.type == 'MESH':
        entry['materials'] = [s.material.name for s in o.material_slots if s.material]
    if o.type == 'CAMERA':
        entry['lens_type'] = getattr(o.data, 'panorama_type', None) or getattr(o.data.cycles, 'panorama_type', None) if hasattr(o.data, 'cycles') else getattr(o.data, 'panorama_type', None)
        entry['cam_type'] = o.data.type
    data['objects'].append(entry)
for i in bpy.data.images:
    data['images'].append({'name': i.name, 'path': i.filepath, 'size': list(i.size), 'users': i.users})
for m in bpy.data.materials:
    imgs = [n.image.name for n in (m.node_tree.nodes if m.use_nodes and m.node_tree else []) if n.type == 'TEX_IMAGE' and n.image]
    data['materials'].append({'name': m.name, 'users': m.users, 'images': imgs})
json.dump(data, open(out, 'w'), indent=1)
print('WROTE', out, len(data['objects']))
