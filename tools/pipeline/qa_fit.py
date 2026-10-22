"""QA estático: prenda sin simular sobre el maniquí. Detecta si la prenda
nace grande/desplazada antes de culpar al cloth.

Uso:
  blender -b tools/pipeline/out/mannequin.blend --python tools/pipeline/qa_fit.py -- <garment.json> [tag]
"""

import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from blender_lib import (  # noqa: E402
    activate,
    data_to_blender,
    make_material,
    new_mesh_object,
    shade_smooth,
)
from build_mannequin import setup_studio  # noqa: E402

OUT = os.path.join(HERE, 'out')
RENDERS = os.path.join(HERE, 'renders')
os.makedirs(RENDERS, exist_ok=True)


def add_garment(item):
    mat = make_material(
        f"QA.{item['id']}",
        '#c94f3d',
        roughness=0.62,
        sheen=0.2,
    )
    objects = []
    for panel in item['panels']:
        verts = []
        for i in range(0, len(panel['positions']), 3):
            x, y, z = panel['positions'][i:i + 3]
            verts.append(data_to_blender(x, y, z))
        faces = []
        for i in range(0, len(panel['indices']), 3):
            faces.append(tuple(panel['indices'][i:i + 3]))
        obj = new_mesh_object(f"QA.{panel['name']}", verts, faces,
                              uvs=panel.get('uvs'), material=mat,
                              coll=bpy.context.scene.collection)
        shade_smooth(obj)
        objects.append(obj)
    activate(objects[0])
    for obj in objects[1:]:
        obj.select_set(True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = f"QA.{item['id']}"
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return joined


def bbox(obj):
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    garment_path = args[0]
    tag = args[1] if len(args) > 1 else os.path.basename(garment_path).replace('.json', '')
    with open(garment_path, encoding='utf-8') as fh:
        item = json.load(fh)

    garment = add_garment(item)
    body = bpy.data.objects.get('Mannequin')
    print('BODY bbox', bbox(body))
    print('GARMENT bbox', bbox(garment))
    print('BODY dims', [round(v, 3) for v in (bbox(body)[1]-bbox(body)[0],
                                              bbox(body)[3]-bbox(body)[2],
                                              bbox(body)[5]-bbox(body)[4])])
    print('GARMENT dims', [round(v, 3) for v in (bbox(garment)[1]-bbox(garment)[0],
                                                 bbox(garment)[3]-bbox(garment)[2],
                                                 bbox(garment)[5]-bbox(garment)[4])])

    setup_studio()
    scene = bpy.context.scene
    try:
        scene.eevee.taa_render_samples = 24
    except Exception:
        pass
    scene.render.resolution_x = 640
    scene.render.resolution_y = 900
    cam = bpy.data.objects.get('Camera')
    target = bpy.data.objects.get('CameraTarget')

    for name, loc in (
        ('front', (0.0, -3.1, 1.05)),
        ('side', (2.5, -2.2, 1.15)),
        ('back', (0.0, 3.1, 1.05)),
    ):
        cam.location = loc
        target.location = (0.0, 0.0, 0.95)
        scene.render.filepath = os.path.join(RENDERS, f'fit-{tag}-{name}.png')
        bpy.ops.render.render(write_still=True)
        print('render', scene.render.filepath)


if __name__ == '__main__':
    main()
