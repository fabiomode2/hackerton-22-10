"""Simula una prenda con Blender Cloth y exporta GLB + animación cuantizada.

Uso:
  blender -b --python tools/pipeline/simulate_garment.py -- <garment.json> [frames]
"""

import json
import math
import os
import struct
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from blender_lib import (  # noqa: E402
    activate,
    build_mannequin,
    data_to_blender,
    blender_to_data,
    ensure_collection,
    export_glb,
    make_material,
    new_mesh_object,
    reset_scene,
    shade_smooth,
)

OUT = os.path.join(HERE, 'out')
RENDERS = os.path.join(HERE, 'renders')

FABRIC_SIM = {
    'cotton_jersey': dict(mass=0.22, tension=18, compression=15, shear=16, bending=0.18, air=1.2, self=False),
    'fleece': dict(mass=0.45, tension=30, compression=25, shear=28, bending=0.55, air=1.4, self=False),
    'denim': dict(mass=0.58, tension=55, compression=45, shear=50, bending=1.25, air=1.2, self=False),
    'linen': dict(mass=0.20, tension=22, compression=18, shear=20, bending=0.12, air=1.1, self=False),
    'leather': dict(mass=0.70, tension=80, compression=65, shear=70, bending=2.2, air=1.0, self=False),
    'knit': dict(mass=0.32, tension=16, compression=12, shear=14, bending=0.35, air=1.3, self=False),
}

FABRIC_COLOR = {
    'cotton_jersey': '#e8e2d8',
    'fleece': '#8a8d8b',
    'denim': '#3c5a78',
    'linen': '#a9b8a2',
    'leather': '#4b2e22',
    'knit': '#8f867c',
}

FABRIC_ROUGH = {
    'cotton_jersey': 0.88,
    'fleece': 0.94,
    'denim': 0.72,
    'linen': 0.86,
    'leather': 0.42,
    'knit': 0.9,
}


def smoothstep(edge0, edge1, x):
    if edge1 <= edge0:
        return 1.0 if x >= edge1 else 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def build_garment(item, coll):
    material = make_material(
        f"Garment.{item['id']}",
        FABRIC_COLOR.get(item['fabric'], '#cccccc'),
        roughness=FABRIC_ROUGH.get(item['fabric'], 0.86),
        sheen=0.25 if item['fabric'] in ('fleece', 'knit', 'cotton_jersey') else 0.08,
    )

    objects = []
    for panel in item['panels']:
        verts = []
        for i in range(0, len(panel['positions']), 3):
            x, y, z = panel['positions'][i:i + 3]
            verts.append(data_to_blender(x, y, z))
        faces = []
        indices = panel['indices']
        for i in range(0, len(indices), 3):
            faces.append(tuple(indices[i:i + 3]))
        obj = new_mesh_object(
            f"G.{panel['name']}",
            verts,
            faces,
            uvs=panel.get('uvs'),
            material=material,
            coll=coll,
        )
        shade_smooth(obj)

        # Grupo de pin: la prenda cuelga del borde superior. En mangas, del
        # hombro; en el torso, del cuello; en jeans/faldas, de la cintura.
        group = obj.vertex_groups.new(name='pin')
        zs = [v[2] for v in verts]
        max_z = max(zs)
        pin_all = panel['name'].startswith('strap') or panel['name'] == 'collar'
        for vi, v in enumerate(verts):
            if pin_all:
                weight = 1.0
            else:
                # 1 en el borde, 0 a 3.5 cm del borde.
                weight = 1.0 - smoothstep(0.006, 0.036, max_z - v[2])
            if weight > 0.001:
                group.add([vi], weight, 'REPLACE')

        objects.append(obj)

    # Unir paneles: un solo objeto de tela con varios grupos de vértices.
    activate(objects[0])
    for obj in objects[1:]:
        obj.select_set(True)
    bpy.ops.object.join()
    garment = bpy.context.view_layer.objects.active
    garment.name = f"Garment.{item['id']}"
    shade_smooth(garment)

    # Triángulos -> quads: mejor comportamiento de la tela.
    activate(garment)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    try:
        bpy.ops.mesh.tris_convert_to_quads(face_threshold=0.72, shape_threshold=0.72)
    except Exception as exc:
        print('tris_convert_to_quads:', exc)
    bpy.ops.object.mode_set(mode='OBJECT')

    # La resolución visual se añade DESPUÉS del cloth en add_cloth.
    return garment, material


def add_cloth(garment, fabric):
    spec = FABRIC_SIM.get(fabric, FABRIC_SIM['cotton_jersey'])
    mod = garment.modifiers.new('Cloth', 'CLOTH')
    s = mod.settings
    s.quality = 10
    s.mass = spec['mass']
    s.air_damping = spec['air']
    s.tension_stiffness = spec['tension']
    s.compression_stiffness = spec['compression']
    s.shear_stiffness = spec['shear']
    s.bending_stiffness = spec['bending']
    s.vertex_group_mass = 'pin'
    s.pin_stiffness = 18.0
    s.use_pressure = False
    s.use_dynamic_mesh = False
    s.effector_weights.gravity = 1.0

    cs = mod.collision_settings
    cs.use_collision = True
    cs.collision_quality = 4
    cs.distance_min = 0.002
    cs.friction = 6.0
    cs.use_self_collision = bool(spec['self'])
    cs.self_distance_min = 0.0018
    cs.self_friction = 6.0

    # Subdivisión visual después del cloth: el bake se calcula en la malla
    # base y la animación/export se muestrean en la malla subdividida.
    subd = garment.modifiers.new('SubdivAfter', 'SUBSURF')
    subd.subdivision_type = 'SIMPLE'
    subd.levels = 1
    subd.render_levels = 1
    return mod


def add_body_collision(body):
    mod = body.modifiers.new('Collision', 'COLLISION')
    mod.settings.thickness_outer = 0.003
    mod.settings.cloth_friction = 7.0
    mod.settings.damping = 0.1
    return mod


def bake_cloth(scene, garment, frames):
    scene.frame_start = 1
    scene.frame_end = frames
    scene.frame_set(1)
    bpy.context.view_layer.update()
    print(f'Baking cloth {frames} frames…', flush=True)
    with bpy.context.temp_override(active_object=garment, selected_objects=[garment]):
        bpy.ops.ptcache.bake_all(bake=True)
    print('Bake done.', flush=True)
    scene.frame_set(frames)
    bpy.context.view_layer.update()


def record_cloth_animation(garment, frames, filepath):
    """Simula paso a paso y graba posiciones. No usa el operador de bake:
    en Blender 5.2 el bake_all con caché en disco es órdenes de magnitud más
    lento que avanzar frames y leer la malla evaluada."""
    import time
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frames
    depsgraph = bpy.context.evaluated_depsgraph_get()
    frames_data = []
    lo = [float('inf')] * 3
    hi = [float('-inf')] * 3
    t0 = time.time()
    for frame in range(1, frames + 1):
        scene.frame_set(frame)
        depsgraph.update()
        eval_obj = garment.evaluated_get(depsgraph)
        mesh = eval_obj.to_mesh()
        positions = []
        for v in mesh.vertices:
            x, y, z = blender_to_data(v.co.x, v.co.y, v.co.z)
            positions.append((x, y, z))
            for i, value in enumerate((x, y, z)):
                lo[i] = min(lo[i], value)
                hi[i] = max(hi[i], value)
        frames_data.append(positions)
        eval_obj.to_mesh_clear()
        if frame % 8 == 0 or frame == frames:
            print(f'  frame {frame}/{frames} · {len(positions)} vértices · {time.time() - t0:.1f}s', flush=True)

    vertex_count = len(frames_data[0])
    span = [max(1e-9, hi[i] - lo[i]) for i in range(3)]
    with open(filepath, 'wb') as fh:
        fh.write(b'SPCL')
        fh.write(struct.pack('<HIIHH', 1, frames, vertex_count, scene.render.fps, 0))
        fh.write(struct.pack('<6f', *lo, *hi))
        for positions in frames_data:
            for p in positions:
                fh.write(struct.pack('<HHH',
                                     int(round((p[0] - lo[0]) / span[0] * 65535)),
                                     int(round((p[1] - lo[1]) / span[1] * 65535)),
                                     int(round((p[2] - lo[2]) / span[2] * 65535))))
    print(f'Animación: {filepath} ({os.path.getsize(filepath) / 1024 / 1024:.2f} MB, {frames} frames)')
    return frames_data[-1]


def add_studio(scene, garment):
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass

    world = bpy.data.worlds.new('StudioWorld')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.055, 0.052, 0.048, 1.0)
    bg.inputs['Strength'].default_value = 1.0
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.001))
    floor = bpy.context.object
    floor.name = 'StudioFloor'
    floor.data.materials.append(make_material('StudioFloor', '#302d2a', roughness=0.82))

    bpy.ops.object.camera_add(location=(0.55, -2.65, 1.30))
    cam = bpy.context.object
    cam.data.lens = 62
    target = bpy.data.objects.new('CameraTarget', None)
    bpy.context.scene.collection.objects.link(target)
    target.location = (0.0, 0.0, 0.98)
    constraint = cam.constraints.new('TRACK_TO')
    constraint.target = target
    constraint.track_axis = 'TRACK_NEGATIVE_Z'
    constraint.up_axis = 'UP_Y'
    scene.camera = cam

    def area(name, loc, energy, size, color, rot):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = energy
        data.shape = 'DISK'
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = rot
        return obj

    area('Key', (-1.9, -2.4, 3.0), 900, 2.2, (1.0, 0.95, 0.88), (0.75, 0.0, -0.65))
    area('Fill', (2.4, -1.4, 1.6), 320, 1.8, (0.78, 0.86, 1.0), (1.25, 0.0, 0.95))
    area('Rim', (0.9, 2.3, 2.7), 700, 1.6, (1.0, 0.92, 0.82), (-0.95, 0.0, 2.7))


def main():
    argv = sys.argv
    args = argv[argv.index('--') + 1:] if '--' in argv else []
    if not args:
        raise SystemExit('Falta el JSON de la prenda')
    garment_path = args[0]
    frames = int(args[1]) if len(args) > 1 else 72
    with open(garment_path, 'r', encoding='utf-8') as fh:
        item = json.load(fh)

    os.makedirs(RENDERS, exist_ok=True)
    reset_scene()
    coll = ensure_collection('Scene')
    skin = make_material('Mannequin.Plaster', '#d6c9b8', roughness=0.58, sheen=0.08,
                         sheen_color='#fff6e8')
    pedestal_mat = make_material('Pedestal.Walnut', '#3a2b22', roughness=0.42, metallic=0.05)
    body, pedestal, ring = build_mannequin(item['body'], coll, skin, pedestal_mat)
    add_body_collision(body)

    garment, material = build_garment(item, coll)
    add_cloth(garment, item['fabric'])
    print(f"Prenda: {item['id']} · {len(garment.data.vertices)} vértices de simulación · {len(garment.data.polygons)} caras")

    bin_path = os.path.join(OUT, f"{item['id']}.cloth.bin")
    record_cloth_animation(garment, frames, bin_path)

    glb_path = os.path.join(OUT, f"{item['id']}.glb")
    export_glb([garment], glb_path)

    add_studio(bpy.context.scene, garment)
    scene = bpy.context.scene
    scene.render.filepath = os.path.join(RENDERS, f"{item['id']}.png")
    bpy.ops.render.render(write_still=True)
    print(f'Render: {scene.render.filepath}')


if __name__ == '__main__':
    main()
