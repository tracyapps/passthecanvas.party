# Print node setups for chosen materials + a few object transforms.
import bpy, json, sys, math
out = sys.argv[sys.argv.index('--') + 1]
names = ['Walnut and exposed timber', 'Painting table — sparse paint freckles over worn wood', 'Burnt orange upholstery',
         'Olive green upholstery', 'painted_wooden_chair_01.002', 'SchoolChair_01', 'dining_chair_02', 'metal_stool_02.001', 'folding_wooden_stool', 'WoodenTable_03']
res = {'materials': {}, 'objects': {}, 'render': {}}
for n in names:
    m = bpy.data.materials.get(n)
    if not m: res['materials'][n] = None; continue
    nodes = [{'name': x.name, 'type': x.type, 'inputs': {i.name: (list(i.default_value) if hasattr(i.default_value, '__len__') else i.default_value) for i in x.inputs if hasattr(i, 'default_value') and not i.is_linked and i.name in ('Base Color','Roughness','Color','Scale','Sheen Weight','Strength')}} for x in m.node_tree.nodes]
    links = [f"{l.from_node.name}.{l.from_socket.name} -> {l.to_node.name}.{l.to_socket.name}" for l in m.node_tree.links]
    res['materials'][n] = {'nodes': nodes, 'links': links}
for n in ['Orange sofa — back', 'Orange sofa — seat', 'Olive beanbag — replace with cloth or chosen model', 'PANO_CAM', 'PHOTO — canvas-drying-rack', 'Painting table — worn solid timber top']:
    o = bpy.data.objects.get(n)
    if o: res['objects'][n] = {'loc': list(o.location), 'rot': [math.degrees(a) for a in o.rotation_euler], 'scale': list(o.scale), 'mods': [m.type for m in o.modifiers], 'verts': len(o.data.vertices) if o.type == 'MESH' else None}
s = bpy.context.scene
res['render'] = {'denoise': s.cycles.use_denoising, 'samples': s.cycles.samples, 'device': s.cycles.device, 'film_exposure': s.cycles.film_exposure if hasattr(s.cycles,'film_exposure') else None, 'view': s.view_settings.view_transform, 'look': s.view_settings.look, 'exposure': s.view_settings.exposure,
  'collections_hidden': [c.name for c in bpy.data.collections if c.hide_render]}
json.dump(res, open(out, 'w'), indent=1, default=str)
