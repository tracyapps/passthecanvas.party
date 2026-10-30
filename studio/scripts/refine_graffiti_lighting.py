"""Refine the owner's latest graffiti and lights without rebuilding the studio."""
import bpy, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'studio/cache/graffiti-lighting'
OUT=ROOT/'studio/renders/cream-city/graffiti-lighting';OUT.mkdir(parents=True,exist_ok=True)
source=Path(bpy.data.filepath)
assert not bpy.data.collections.get('GRAFFITI FINISH — outlines and spray'), 'Already refined'
original={o.name:[list(r) for r in o.matrix_basis] for o in bpy.data.objects}
report={'source':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sconces':[],'graffiti':[]}
red=bpy.data.scenes['02 — Red / late afternoon'];bpy.context.window.scene=red
c=bpy.data.collections.new('GRAFFITI FINISH — outlines and spray');red.collection.children.link(c)
font=bpy.data.fonts.load(str(ROOT/'studio/assets/fonts/bangers/Bangers-Regular.ttf'))
font.pack()

def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.88
 return m
ink=material('GRAFFITI — charcoal keyline',(.012,.009,.022));cream=material('GRAFFITI — warm cream outline',(.85,.77,.52))
cyan=material('GRAFFITI — turquoise accents',(.005,.55,.50));pink=material('GRAFFITI — raspberry accents',(.65,.008,.13))
fill=material('GRAFFITI — sunset to electric mint paint',(.5,.01,.3))
n=fill.node_tree.nodes;l=fill.node_tree.links;p=n.get('Principled BSDF')
tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['Generated'],sep.inputs[0])
ramp=n.new('ShaderNodeValToRGB');ramp.name='GRAFFITI COLOURS — bottom to top';ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
for i,(pos,color) in enumerate([(0,(.05,.55,.40,1)),(.24,(.005,.42,.70,1)),(.48,(.20,.015,.55,1)),(.70,(.80,.008,.18,1)),(.87,(1,.22,.012,1)),(1,(.95,.65,.04,1))]):
 e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(pos);e.position=pos;e.color=color
l.new(sep.outputs['Y'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=155;noise.inputs['Detail'].default_value=2
l.new(tex.outputs['Generated'],noise.inputs['Vector'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.0015;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal'])
# Sparse worn flecks expose the wall through the paint rather than adding relief.
wear=n.new('ShaderNodeMath');wear.operation='LESS_THAN';wear.inputs[1].default_value=.26;l.new(noise.outputs['Fac'],wear.inputs[0])
transparent=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader');l.new(wear.outputs[0],mix.inputs[0]);l.new(p.outputs[0],mix.inputs[1]);l.new(transparent.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],n.get('Material Output').inputs['Surface'])

def child(name,data,parent,mat,z):
 o=bpy.data.objects.new(name,data);c.objects.link(o);o.parent=parent;o.matrix_parent_inverse=Matrix.Identity(4);o.location=(0,0,z)
 if mat:o.data.materials.clear();o.data.materials.append(mat)
 return o

def polygon(name,points,parent,mat,z):
 d=bpy.data.meshes.new(name);d.from_pydata([(x,y,z) for x,y in points],[],[tuple(range(len(points)))]);d.update()
 return child(name,d,parent,mat,0)

# Keep the owner-edited phrase, line breaks, tilt and occupied rectangle.
g=bpy.data.objects['Original brick graffiti.001'];oldbounds=[Vector(v) for v in g.bound_box]
x0=min(v.x for v in oldbounds);x1=max(v.x for v in oldbounds);y0=min(v.y for v in oldbounds);y1=max(v.y for v in oldbounds)
oldmatrix=g.matrix_world.copy();body=g.data.body
g.data=g.data.copy();g.data.font=font;g.data.size=1;g.data.shear=.09;g.data.space_line=.80;g.data.extrude=0;g.data.bevel_depth=0;g.data.offset=0
g.data.materials.clear();g.data.materials.append(fill);bpy.context.view_layer.update()
b=[Vector(v) for v in g.bound_box];nx0=min(v.x for v in b);nx1=max(v.x for v in b);ny0=min(v.y for v in b);ny1=max(v.y for v in b)
sx=(x1-x0)/(nx1-nx0);sy=(y1-y0)/(ny1-ny0)
g.matrix_world=oldmatrix @ Matrix.Translation((x0-nx0*sx,y0-ny0*sy,0)) @ Matrix.Diagonal((sx,sy,1,1))
g['Help']='Editable Bangers lettering. GRAFFITI COLOURS ramp changes the fill. Two child text objects supply outlines.'
for name,offset,mat,z in [('GRAFFITI — dark spray keyline',.047,ink,-.010),('GRAFFITI — cream inner outline',.024,cream,-.005)]:
 d=g.data.copy();d.offset=offset;child(name,d,g,mat,z)
# Original irregular splashes and paint drips, all parented to the owner's lettering.
rng=random.Random(2810)
for i in range(65):
 x=rng.uniform(nx0-.14,nx1+.14);y=rng.uniform(ny0-.12,ny1+.12)
 if nx0+.03<x<nx1-.03 and ny0+.03<y<ny1-.03:continue
 radius=rng.uniform(.003,.014)
 pts=[(x+math.cos(a*math.tau/7)*radius*rng.uniform(.7,1.3),y+math.sin(a*math.tau/7)*radius*rng.uniform(.7,1.3)) for a in range(7)]
 polygon('GRAFFITI — spray fleck',pts,g,cyan if i%3 else pink,-.012)
for i,frac in enumerate([.12,.28,.56,.77,.88]):
 x=nx0+(nx1-nx0)*frac;length=rng.uniform(.045,.14);w=.006
 polygon('GRAFFITI — short paint run',[(x-w,ny0+.022),(x+w,ny0+.022),(x+w*.5,ny0-length),(x-w*.5,ny0-length)],g,cyan if i%2 else pink,-.002)
# A loose hand-sprayed underline breaks up the perfectly typeset silhouette.
polygon('GRAFFITI — turquoise swoosh',[(nx0-.05,ny0-.075),(nx1+.10,ny0-.025),(nx1-.03,ny0-.058),(nx0+.12,ny0-.10)],g,cyan,-.013)
report['graffiti']={'body':body,'preserved_occupied_rectangle':True,'font':'Bangers / SIL OFL 1.1'}

# Extract connected mesh islands to address just the glass, retaining scanned metal.
def islands(mesh):
 adj=[set() for _ in mesh.vertices]
 for e in mesh.edges:
  a,b=e.vertices;adj[a].add(b);adj[b].add(a)
 seen=set();result=[]
 for i in range(len(mesh.vertices)):
  if i in seen:continue
  todo=[i];seen.add(i);part=[]
  while todo:
   a=todo.pop();part.append(a)
   for b in adj[a]:
    if b not in seen:seen.add(b);todo.append(b)
  result.append(part)
 return result

glass=bpy.data.materials.new('SCONCE — lightly frosted transmitting glass');glass.use_nodes=True;n=glass.node_tree.nodes;l=glass.node_tree.links;p=n.get('Principled BSDF')
p.inputs['Base Color'].default_value=(.96,.89,.73,1);p.inputs['Transmission Weight'].default_value=1;p.inputs['Roughness'].default_value=.20;p.inputs['IOR'].default_value=1.45
# Cycles shadow-ray transparency lets a small internal bulb illuminate the room
# without expensive refractive caustics, while camera rays still see glass.
path=n.new('ShaderNodeLightPath');clear=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader');l.new(path.outputs['Is Shadow Ray'],mix.inputs[0]);l.new(p.outputs[0],mix.inputs[1]);l.new(clear.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],n.get('Material Output').inputs['Surface'])
glass['Technique']='Frosted glass for camera rays; transparent shadow rays for stable practical lighting.'
bulbmat=material('SCONCE — warm internal bulb',(1,.62,.25));p=bulbmat.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.55,.18,1);p.inputs['Emission Strength'].default_value=5
fixtures=sorted([o for o in red.objects if o.name.startswith('industrial_caged_sconce_c') and o.type=='MESH'],key=lambda o:o.name)
bulbs=[o for o in bpy.data.objects if o.name.startswith('Warm bulb — industrial_caged_sconce_c')]
lights=[o for o in bpy.data.objects if o.name.startswith('WARM LIGHT — industrial_caged_sconce_c')]
changed=set([g.name])
for fixture in fixtures:
 fixture.data=fixture.data.copy();parts=islands(fixture.data)
 # The two 265-vertex enclosed cylinders are glass; the larger islands are cages.
 panes=[part for part in parts if len(part)==265]
 assert len(panes)==2,(fixture.name,'Unexpected glass topology',len(panes))
 index=len(fixture.data.materials);fixture.data.materials.append(glass)
 selected=set(i for part in panes for i in part)
 for face in fixture.data.polygons:
  if all(i in selected for i in face.vertices):face.material_index=index
 centers=[]
 for part in panes:
  v=[fixture.data.vertices[i].co for i in part]
  center=Vector(tuple((min(p[k] for p in v)+max(p[k] for p in v))/2 for k in range(3)));centers.append(center)
 for side,center in enumerate(centers):
  target=fixture.matrix_world@center
  if bulbs:
   bulb=min(bulbs,key=lambda o:(o.matrix_world.translation-target).length);bulbs.remove(bulb)
  else:
   bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.025)
   bulb=bpy.context.object
  bulb.name='Warm bulb — '+fixture.name+(' left' if side==0 else ' right')
  bulb.parent=fixture;bulb.matrix_parent_inverse=Matrix.Identity(4);bulb.location=center;bulb.rotation_euler=(0,0,0);bulb.scale=(.65,.65,1.5)
  bulb.data=bulb.data.copy();bulb.data.materials.clear();bulb.data.materials.append(bulbmat);changed.add(bulb.name)
  # Move each bulb into the same scene collections as its fixture.
  for col in list(bulb.users_collection):col.objects.unlink(bulb)
  for col in fixture.users_collection:col.objects.link(bulb)
  if lights:
   light=min(lights,key=lambda o:(o.matrix_world.translation-target).length);lights.remove(light);light.data=light.data.copy()
  else:
   d=bpy.data.lights.new('SCONCE internal warm light','POINT');light=bpy.data.objects.new(d.name,d)
  light.name='SCONCE LIGHT — '+fixture.name+(' left' if side==0 else ' right')
  for col in list(light.users_collection):col.objects.unlink(light)
  for col in fixture.users_collection:col.objects.link(light)
  light.parent=fixture;light.matrix_parent_inverse=Matrix.Identity(4);light.location=center;light.rotation_euler=(0,0,0);light.scale=(1,1,1)
  light.data.energy=18;light.data.color=(1,.67,.38);light.data.shadow_soft_size=.018
  light['Help']='Inside the frosted glass. Moves with this fixture; Light Properties > Power adjusts brightness.'
 report['sconces'].append({'fixture':fixture.name,'glass_islands':2,'bulbs_inside':2,'point_lights_inside':2})

# Subtle jewel hues on the existing practicals: keep most power warm, tint accents.
colors=[(1,.45,.20),(.16,.60,1),(.70,.16,.40)]
for k in range(1,4):
 group=sorted([o for o in bpy.data.objects if o.type=='LIGHT' and o.name.startswith('Mosaic %d — warm corner light'%k)],key=lambda o:o.name)
 for i,o in enumerate(group):
  o.data=o.data.copy();o.data.color=colors[i%3];o.data.energy=9 if i==0 else 4
  o.data.shadow_soft_size=.09
# Low-power broad washes fall on the nearby wall, without rainbow floodlighting.
for k in range(1,4):
 globe=bpy.data.objects['MOSAIC GLOBE %d — coloured glass tiles'%k]
 pts=[globe.matrix_world@Vector(v) for v in globe.bound_box];center=sum(pts,Vector())/8
 d=bpy.data.lights.new('MOSAIC COLOUR — soft wall wash %d'%k,'AREA');d.energy=5;d.color=colors[k-1];d.shape='DISK';d.size=.30
 o=bpy.data.objects.new(d.name,d);bpy.data.collections['MOSAIC PENDANT — beanbag corner'].objects.link(o)
 # Put washes behind the globes facing the nearest south wall, avoiding glass occlusion.
 o.location=center+Vector((0,-.31,0));o.rotation_euler=Vector((0,-1,-.15)).to_track_quat('-Z','Y').to_euler()
 bpy.context.view_layer.update();w=o.matrix_world.copy();o.parent=bpy.data.objects['TURKISH LAMP — MOVE THIS'];o.matrix_parent_inverse=o.parent.matrix_world.inverted();o.matrix_world=w

bpy.context.view_layer.update()
# All existing layout objects except the requested graffiti/bulb/light repairs stay fixed.
exempt=lambda name:name.startswith(('Original brick graffiti.001','Warm bulb — industrial_caged_sconce_c','WARM LIGHT — industrial_caged_sconce_c'))
for name,basis in original.items():
 if not exempt(name):assert [list(r) for r in bpy.data.objects[name].matrix_basis]==basis,name
report['existing_layout_transforms_preserved']=sum(not exempt(name) for name in original)
for s in bpy.data.scenes:
 s.render.resolution_x=4096;s.render.resolution_y=2048;s.render.resolution_percentage=100;s.cycles.samples=128
red.render.filepath=str(OUT/'graffiti-lighting-panorama-4k.png')
notes=bpy.data.texts.new('GRAFFITI + SCONCES — controls')
notes.write('Graffiti wording remains editable in Original brick graffiti.001. Its two text children are outline layers; update their text too when changing wording.\nGRAFFITI COLOURS ramp adjusts the gradient. Outline and spray objects are children.\nSconces now have separate transmitting glass and correctly parented bulbs/lights inside. SCONCE LIGHT > Power adjusts brightness.\nMOSAIC COLOUR wall washes are subtle accents; Power adjusts their strength.\n')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(CACHE/'cream-city-studio-wphotos.blend'))
(CACHE/'report.json').write_text(json.dumps(report,indent=2));print('CANDIDATE VERIFIED AND SAVED',flush=True)
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='METAL'
red.cycles.device='GPU';red.cycles.samples=48;red.render.resolution_x=2048;red.render.resolution_y=1024
red.render.filepath=str(OUT/'graffiti-lighting-review.png');bpy.ops.render.render(write_still=True)
print('REVIEW RENDER COMPLETE',flush=True)
