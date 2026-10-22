import os
import sys
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_mannequin import setup_studio  # noqa: E402

bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'out', 'viewer-body.blend'))
setup_studio()
scene = bpy.context.scene
scene.render.resolution_x = 640
scene.render.resolution_y = 900
try:
    scene.eevee.taa_render_samples = 24
except Exception:
    pass
cam = bpy.data.objects.get('Camera')
target = bpy.data.objects.get('CameraTarget')
cam.location = (0.0, -3.2, 1.10)
target.location = (0.0, 0.0, 0.95)
scene.render.filepath = os.path.join(HERE, 'renders', 'viewer-body.png')
bpy.ops.render.render(write_still=True)
print('render', scene.render.filepath)
