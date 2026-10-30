"""Purple neon and redirected red-scene track lights; preserve the owner layout."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];CACHE=ROOT/'studio/cache/purple-neon';OUT=ROOT/'studio/renders/cream-city/purple-neon';OUT.mkdir(parents=True,exist_ok=True)
source=Path(bpy.data.filepath);original={o.name:[list(row) for row in o.matrix_basis] for o in bpy.data.objects}
s=bpy.data.scenes['02 — Red / late afternoon'];bpy.context.window.scene=s
pano=s.camera
assert not bpy.data.materials.get("NEON — purple violet / readable script"), "Purple refinement is already present"
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='METAL'
s.cycles.device='GPU'
def closeup(name):
 d=bpy.data.cameras.new('Temporary neon review');o=bpy.data.objects.new(d.name,d);s.collection.objects.link(o);o.location=(3.75,.45,2.3);o.rotation_euler=(Vector((3.95,3.91,2.35))-o.location).to_track_quat('-Z','Y').to_euler();d.lens=36;s.camera=o
 s.render.resolution_x=1400;s.render.resolution_y=900;s.cycles.samples=64;s.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
 s.camera=pano;bpy.data.objects.remove(o,do_unlink=True)
closeup('neon-before')
g=bpy.data.objects['Editable neon lettering.001'];g.data=g.data.copy();g.data.bevel_depth=.0012
m=g.data.materials[0].copy();m.name='NEON — purple violet / readable script';g.data.materials[0]=m
p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.16,.008,.44,1);p.inputs['Emission Color'].default_value=(.30,.008,1,1);p.inputs['Emission Strength'].default_value=1.7
m.diffuse_color=(.30,.008,1,1)
g['Help']='Purple neon: Material Properties > Emission Strength 1.7. Reduced bevel preserves the small script gaps.'
wash=bpy.data.objects['Neon wall wash.001'];wash.data=wash.data.copy();wash.data.color=(.30,.025,1);wash.data.energy=6
tracks=sorted([o for o in s.objects if o.name.startswith('Art wall track spotlight')],key=lambda o:o.name)
assert len(tracks)==3
report={'source':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'tracks':[],'neon_emission':1.7,'neon_bevel':.0012}
for o,shift,target in zip(tracks,[(-.25,-.18,.02),(-.20,-.15,.02),(.20,-.1,.02)],[(1.25,3.98,2.2),(1.70,3.98,1.1),(5.48,3.1,1.8)]):
 before=list(o.location);o.location+=Vector(shift);o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();o.data=o.data.copy();o.data.energy=32
 # Limit spill from the tiny area lights so they illuminate the brick beside the sign.
 o.data.spread=.85;o['Help']='Aimed away from the neon lettering toward brick/corner; 32 W.'
 report['tracks'].append({'name':o.name,'before':before,'after':list(o.location),'target':target})
for name,basis in original.items():
 if name not in [o.name for o in tracks]:assert [list(row) for row in bpy.data.objects[name].matrix_basis]==basis,name
report['unchanged_layout_transforms']=len(original)-len(tracks)
s.render.resolution_x=4096;s.render.resolution_y=2048;s.render.resolution_percentage=100;s.cycles.samples=128;s.render.filepath=str(OUT/'purple-neon-panorama-4k.png')
bpy.ops.wm.save_as_mainfile(filepath=str(CACHE/source.name));(CACHE/'report.json').write_text(json.dumps(report,indent=2));print('CANDIDATE SAVED; SIGN POSITION AND ROOM LAYOUT PRESERVED',flush=True)
closeup('purple-neon-closeup');print('PURPLE NEON CLOSEUP COMPLETE',flush=True)
s.render.resolution_x=4096;s.render.resolution_y=2048;s.cycles.samples=128;s.render.filepath=str(OUT/'purple-neon-panorama-4k.png');bpy.ops.render.render(write_still=True);print('FINAL 4K COMPLETE',flush=True)
