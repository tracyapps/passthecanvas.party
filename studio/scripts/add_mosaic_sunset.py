"""Add an original mosaic pendant and editable sunset to the latest owner layout.
Writes a candidate first; never reruns the room generator or moves existing props.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'studio/cache/mosaic-sunset'
OUT=ROOT/'studio/renders/cream-city/mosaic-sunset'
OUT.mkdir(parents=True,exist_ok=True)
assert not bpy.data.collections.get('MOSAIC PENDANT — beanbag corner'), 'Already added'
original={o.name: [list(r) for r in o.matrix_basis] for o in bpy.data.objects}
source=Path(bpy.data.filepath)
red=bpy.data.scenes['02 — Red / late afternoon']
bpy.context.window.scene=red

def coll(name):
 c=bpy.data.collections.new(name);return c
lamp=coll('MOSAIC PENDANT — beanbag corner')
for s in bpy.data.scenes:s.collection.children.link(lamp)
sky=coll('SUNSET — outside windows (red look)');red.collection.children.link(sky)

def mat(name,color,metal=0,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
 p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.28
 p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
 p.inputs['Coat Weight'].default_value=.35
 return m
bronze=mat('Mosaic — aged bronze',(.13,.065,.025),.82)
grout=mat('Mosaic — charcoal grout',(.018,.012,.008))
palette=[mat('Mosaic glass — '+n,c,.12,.7) for n,c in [
 ('cobalt',(.012,.055,.65)),('turquoise',(.008,.5,.56)),('emerald',(.025,.35,.08)),
 ('lemon',(.95,.62,.018)),('amber',(.95,.19,.008)),('ruby',(.55,.012,.025)),('pearl',(.75,.63,.4))]]
handle=bpy.data.objects.new('TURKISH LAMP — MOVE THIS',None);lamp.objects.link(handle)
handle.empty_display_type='CIRCLE';handle.empty_display_size=.5;handle.location=(1.95,-3.32,3.48)
handle['Help']='Move this parent to move every globe, chain and light together. Light Properties > Power adjusts the corner brightness.'
bpy.context.view_layer.update()
def place(o,name,material):
 o.name=name
 for c in list(o.users_collection):c.objects.unlink(o)
 lamp.objects.link(o)
 if material:o.data.materials.append(material)
 world=o.matrix_world.copy();o.parent=handle;o.matrix_parent_inverse=handle.matrix_world.inverted();o.matrix_world=world
 return o

def sphere(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,location=loc)
 o=place(bpy.context.object,name,material);o.scale=scale
 for p in o.data.polygons:p.use_smooth=True
 return o

def tube(name,a,b,r,material):
 d=Vector(b)-Vector(a)
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2)
 o=place(bpy.context.object,name,material);o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
 for p in o.data.polygons:p.use_smooth=True
 return o

def ring(name,loc,major,minor,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=8,location=loc,rotation=rot)
 return place(bpy.context.object,name,bronze)

tube('Mosaic — ceiling rose',(1.95,-3.32,3.43),(1.95,-3.32,3.52),.20,bronze)
# Three staggered globes leave the beanbag's seated head space clear.
for k,(cx,cy,cz,r) in enumerate([(1.34,-3.32,2.76,.21),(1.98,-3.32,2.40,.235),(2.63,-3.32,2.08,.215)],1):
 tube('Mosaic — canopy arm', (1.95,-3.32,3.46),(cx,cy,3.40),.018,bronze)
 # Alternating chain-link planes read as real hanging hardware in close views.
 z=cz+r*.8+.10
 while z<3.39:
  ring('Mosaic — hanging chain', (cx,cy,z),.022,.004,(math.pi/2,0,(int(z*100)%2)*math.pi/2));z+=.043
 sphere('Mosaic — dark grout globe',(cx,cy,cz),(r,r,r*.78),grout)
 for sign in [-1,1]:
  sphere('Mosaic — bronze cap',(cx,cy,cz+sign*r*.73),(.085,.085,.04),bronze)
  ring('Mosaic — globe rim',(cx,cy,cz+sign*r*.67),.10,.009)
 tube('Mosaic — bottom finial',(cx,cy,cz-r*.8),(cx,cy,cz-r*.8-.10),.022,bronze)
 verts=[];faces=[];colors=[];rows=28;cols=64
 for row in range(2,rows-2):
  for col in range(cols):
   # Individual inset tiles leave visible dark grout lines between glass pieces.
   coords=[]
   for v,u in [(row+.09,col+.09),(row+.09,col+.91),(row+.91,col+.91),(row+.91,col+.09)]:
    phi=math.pi*v/rows;theta=2*math.pi*u/cols
    coords.append((cx+r*1.012*math.sin(phi)*math.cos(theta),cy+r*1.012*math.sin(phi)*math.sin(theta),cz+r*.78*1.012*math.cos(phi)))
   start=len(verts);verts.extend(coords);faces.append(tuple(range(start,start+4)))
   # Repeated eight-point rosettes are original geometry, not a copy of the photo.
   theta=2*math.pi*(col+.5)/cols;phi=math.pi*(row+.5)/rows
   u=(math.cos(theta)*.72+math.sin(theta)*.69)*math.sin(phi);v=math.cos(phi)
   angle=math.atan2(v,u);radius=math.sqrt(u*u+v*v)
   star=radius/(.80+.16*math.cos(8*angle))
   band=int(star*8)%7
   colors.append(band)
 data=bpy.data.meshes.new('Individually cut mosaic tiles');data.from_pydata(verts,[],faces);data.update()
 o=bpy.data.objects.new('MOSAIC GLOBE %d — coloured glass tiles'%k,data);lamp.objects.link(o)
 for m in palette:data.materials.append(m)
 for p,index in zip(data.polygons,colors):p.material_index=index
 world=o.matrix_world.copy();o.parent=handle;o.matrix_parent_inverse=handle.matrix_world.inverted();o.matrix_world=world
 # Real lights provide illumination; the glass emission supplies the jewel glow.
 for dx,dy in [(-r*1.12,0),(0,r*1.12),(r*1.12,0)]:
  d=bpy.data.lights.new('Mosaic %d — warm corner light'%k,'POINT');d.energy=14;d.color=(1,.63,.30);d.shadow_soft_size=.12
  l=bpy.data.objects.new(d.name,d);lamp.objects.link(l);l.location=(cx+dx,cy+dy,cz-.03)
  bpy.context.view_layer.update();w=l.matrix_world.copy();l.parent=handle;l.matrix_parent_inverse=handle.matrix_world.inverted();l.matrix_world=w

# Clear the existing ventilation duct without moving any owner objects.
handle.location.x-=.4
bpy.context.view_layer.update()

# A distant, self-lit procedural sky sits in front of the placeholder building.
# Existing exterior architecture remains untouched and returns when this collection is hidden.
data=bpy.data.meshes.new('Sunset backdrop');data.from_pydata([(-12,-25,-3),(-12,25,-3),(-12,25,15),(-12,-25,15)],[],[(0,1,2,3)])
data.update();o=bpy.data.objects.new('SUNSET — editable sky backdrop',data);sky.objects.link(o)
m=bpy.data.materials.new('SUNSET — peach rose violet clouds');m.use_nodes=True;n=m.node_tree.nodes;n.clear();links=m.node_tree.links
out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');em.inputs['Strength'].default_value=.65;links.new(em.outputs[0],out.inputs['Surface'])
tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');links.new(tex.outputs['Generated'],sep.inputs[0])
ramp=n.new('ShaderNodeValToRGB');ramp.name='SUNSET COLOURS — bottom to top';ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
for i,(pos,color) in enumerate([(0,(.08,.035,.07,1)),(.16,(.75,.16,.035,1)),(.29,(1,.38,.11,1)),(.43,(.8,.16,.27,1)),(.65,(.22,.10,.40,1)),(1,(.035,.055,.20,1))]):
 e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(pos);e.position=pos;e.color=color
links.new(sep.outputs['Z'],ramp.inputs[0])
scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(1,2,20);links.new(tex.outputs['Generated'],scale.inputs[0])
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3;noise.inputs['Detail'].default_value=4;noise.inputs['Roughness'].default_value=.7;links.new(scale.outputs[0],noise.inputs['Vector'])
cloud=n.new('ShaderNodeMixRGB');cloud.blend_type='SCREEN';cloud.inputs[0].default_value=.08;links.new(ramp.outputs[0],cloud.inputs[1]);links.new(noise.outputs['Fac'],cloud.inputs[2]);links.new(cloud.outputs[0],em.inputs[0]);o.data.materials.append(m)
o['Help']='Hide the SUNSET collection with its camera icon to restore the original exterior. Shader Editor > SUNSET COLOURS changes the gradient.'
sun_material=mat('SUNSET — low amber sun',(1,.28,.045),0,1.4)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=.38,location=(-11.8,1.9,2.3))
sun=bpy.context.object;sun.name='SUNSET — low sun disc'
for c in list(sun.users_collection):c.objects.unlink(sun)
sky.objects.link(sun);sun.data.materials.append(sun_material)
# Keep neutral world fill; warm only the active look's four window area lights.
for l in red.objects:
 if l.type=='LIGHT' and l.name.startswith('Window daylight'):
  l.data=l.data.copy();l.data.color=(1,.63,.43);l.data.energy*=.80
bpy.context.view_layer.update()
for name,basis in original.items():assert [list(r) for r in bpy.data.objects[name].matrix_basis]==basis,name
for s in bpy.data.scenes:
 s.render.resolution_x=4096;s.render.resolution_y=2048;s.render.resolution_percentage=100;s.cycles.samples=128
red.render.filepath=str(OUT/'mosaic-sunset-panorama-4k.png')
notes=bpy.data.texts.new('MOSAIC LAMP + SUNSET — controls')
notes.write('Move the whole pendant: select TURKISH LAMP — MOVE THIS.\nBrightness: select Mosaic warm corner light > Light Properties > Power.\nSunset: red/afternoon look only. Hide SUNSET collection camera icon to restore old exterior.\nSky colours: material SUNSET — peach rose violet clouds > SUNSET COLOURS ramp.\nRender > Render Image; render window Image > Save As.\nReference photo is inspiration only, never mapped into this scene.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(CACHE/'cream-city-studio-wphotos.blend'))
(CACHE/'report.json').write_text(json.dumps({'source':str(source),'preserved_objects':len(original),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()},indent=2))
print('CANDIDATE SAVED; EXISTING TRANSFORMS PRESERVED',len(original),flush=True)
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='METAL'
red.cycles.device='GPU';red.cycles.samples=48;red.render.resolution_x=2048;red.render.resolution_y=1024
red.render.filepath=str(OUT/'mosaic-sunset-panorama-review.png');bpy.ops.render.render(write_still=True)
print('REVIEW RENDER COMPLETE',flush=True)
