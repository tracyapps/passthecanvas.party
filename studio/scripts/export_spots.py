"""
Export spot directions from the Blender studio to spots.json.

How to use (Blender 4.x / 5.x):
  1. Open the studio .blend.
  2. Make sure the panoramic camera is named  PANO_CAM  (or set CAMERA_NAME below).
  3. Every spot is an Empty whose name starts with  spot_   e.g. spot_couch_left.
     Optional custom properties on the empty:
        label  -> "Couch, left cushion"   (what people see and hear)
        zone   -> "couch"                 (defaults to the 2nd part of the name)
  4. Scripting workspace -> open this file -> Run Script.
  5. spots.json is written to  apps/web/public/studio/<room>/spots.json
     where <room> is the Blender scene name (e.g. "loft").

Yaw: degrees left/right from straight ahead (positive = to the right).
Pitch: degrees up/down (negative = looking down).
These match Photo Sphere Viewer's yaw/pitch.

FIRST TIME: verify the alignment once. Put a bright test cube where a spot is,
render the panorama, and check the marker lands on it in the browser. If it is
off by a constant angle, set YAW_OFFSET_DEG below and re-run.
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

CAMERA_NAME = "PANO_CAM"
SPOT_PREFIX = "spot_"
YAW_OFFSET_DEG = 0.0  # adjust after the first alignment check
# The repo root, found relative to this .blend (studio/blender/xyz.blend -> repo root)
REPO_ROOT = Path(bpy.path.abspath("//")).parents[1]


def direction_angles(camera, target_location):
    """Return (yaw, pitch) in degrees from the camera to a point in the world."""
    cam_matrix = camera.matrix_world
    rotation = cam_matrix.to_quaternion()
    forward = rotation @ Vector((0.0, 0.0, -1.0))  # cameras look down their -Z
    right = rotation @ Vector((1.0, 0.0, 0.0))
    up = rotation @ Vector((0.0, 1.0, 0.0))

    direction = (target_location - cam_matrix.translation).normalized()
    yaw = math.degrees(math.atan2(direction.dot(right), direction.dot(forward))) + YAW_OFFSET_DEG
    pitch = math.degrees(math.asin(max(-1.0, min(1.0, direction.dot(up)))))
    # keep yaw in -180..180
    yaw = (yaw + 180.0) % 360.0 - 180.0
    return round(yaw, 2), round(pitch, 2)


def main():
    scene = bpy.context.scene
    camera = bpy.data.objects.get(CAMERA_NAME)
    if camera is None:
        raise RuntimeError(f"No camera named {CAMERA_NAME!r} in this file.")

    spots = []
    for obj in sorted(scene.objects, key=lambda o: o.name):
        if obj.type != "EMPTY" or not obj.name.startswith(SPOT_PREFIX):
            continue
        yaw, pitch = direction_angles(camera, obj.matrix_world.translation)
        parts = obj.name.split("_")
        spots.append(
            {
                "id": obj.name,
                "zone": obj.get("zone", parts[1] if len(parts) > 1 else "room"),
                "label": obj.get("label", obj.name.replace("_", " ")),
                "yaw": yaw,
                "pitch": pitch,
            }
        )

    room = scene.name.lower().replace(" ", "-")
    out_dir = REPO_ROOT / "apps" / "web" / "public" / "studio" / room
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "spots.json"
    out_file.write_text(json.dumps({"room": room, "spots": spots}, indent=2) + "\n")
    print(f"Wrote {len(spots)} spots to {out_file}")


main()
