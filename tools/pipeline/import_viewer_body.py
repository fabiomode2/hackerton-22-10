"""Importa la malla real del maniquí del visor (exportada desde el navegador)
a Blender, con sus pesos de grupo, para construir y simular la prenda encima."""

import json
import os
import struct
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from blender_lib import activate, reset_scene, shade_smooth, data_to_blender, make_material  # noqa: E402

OUT = os.path.join(HERE, 'out')
BIN = os.path.join(OUT, 'viewer-body.bin')
META = os.path.join(OUT, 'viewer-body-meta.json')
GROUPS = ['torso', 'armL', 'armR', 'legL', 'legR', 'head']


def main():
    with open(META, encoding='utf-8') as fh:
        meta = json.load(fh)
    count = meta['vertexCount']
    index_count = meta['indexCount']
    with open(BIN, 'rb') as fh:
        data = fh.read()
    pos = np.frombuffer(data, dtype=np.float32, count=count * 3).reshape(-1, 3)
    off = count * 3 * 4
    nor = np.frombuffer(data, dtype=np.float32, count=count * 3, offset=off).reshape(-1, 3)
    off += count * 3 * 4
    idx = np.frombuffer(data, dtype=np.uint16, count=index_count, offset=off)
    off += index_count * 2
    grp = np.frombuffer(data, dtype=np.float32, count=count * 6, offset=off).reshape(-1, 6)
    print('loaded', pos.shape, idx.shape, grp.shape, 'offset', off + count * 6 * 4, 'file', len(data))

    reset_scene()
    verts = [data_to_blender(float(x), float(y), float(z)) for x, y, z in pos]
    faces = [tuple(int(v) for v in idx[i:i + 3]) for i in range(0, len(idx), 3)]
    mesh = bpy.data.meshes.new('ViewerBodyMesh')
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new('Mannequin', mesh)
    bpy.context.scene.collection.objects.link(obj)
    shade_smooth(obj)

    for gi, name in enumerate(GROUPS):
        group = obj.vertex_groups.new(name=name)
        for vi in range(count):
            w = float(grp[vi, gi])
            if w > 0.001:
                group.add([vi], w, 'REPLACE')

    # Normales suaves y limpieza
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')

    material = make_material('Mannequin.Skin', '#d7c5b2', roughness=0.62, sheen=0.08,
                             sheen_color='#fff0e0')
    obj.data.materials.append(material)

    bpy.context.scene['viewer_meta'] = json.dumps(meta)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'viewer-body.blend'))
    print('saved', os.path.join(OUT, 'viewer-body.blend'))


if __name__ == '__main__':
    main()
