"""Construye el maniquí de estudio y exporta body.glb + render de control."""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from blender_lib import (  # noqa: E402
    build_mannequin,
    ensure_collection,
    export_glb,
    make_material,
    reset_scene,
)

BODY = {
    'height_cm': 175,
    'bust_cm': 92,
    'waist_cm': 78,
    'hips_cm': 96,
    'shoulder_cm': 44,
    'inseam_cm': 80,
}

OUT = os.path.join(HERE, 'out')
RENDERS = os.path.join(HERE, 'renders')
os.makedirs(RENDERS, exist_ok=True)


def setup_studio():
    scene = bpy.context.scene
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
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

    # Suelo de estudio
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.001))
    floor = bpy.context.object
    floor.name = 'StudioFloor'
    mat = make_material('StudioFloor', '#302d2a', roughness=0.82)
    floor.data.materials.append(mat)

    # Cámara 50 mm equivalente
    bpy.ops.object.camera_add(location=(0.62, -3.05, 1.38))
    cam = bpy.context.object
    cam.name = 'Camera'
    cam.data.lens = 58
    target = bpy.data.objects.new('CameraTarget', None)
    bpy.context.scene.collection.objects.link(target)
    target.location = (0.0, 0.0, 0.92)
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
    return scene


def main():
    reset_scene()
    coll = ensure_collection('Mannequin')
    skin = make_material('Mannequin.Plaster', '#d6c9b8', roughness=0.58, sheen=0.08,
                         sheen_color='#fff6e8')
    pedestal_mat = make_material('Pedestal.Walnut', '#3a2b22', roughness=0.42, metallic=0.05)
    body_obj, pedestal, ring = build_mannequin(BODY, coll, skin, pedestal_mat)
    export_glb([body_obj, pedestal, ring], os.path.join(OUT, 'mannequin.glb'))

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'mannequin.blend'))
    if '--no-render' in sys.argv:
        print('Maniquí guardado sin render.')
        return

    setup_studio()
    scene = bpy.context.scene
    try:
        scene.eevee.taa_render_samples = 24
    except Exception:
        pass
    scene.render.resolution_x = 640
    scene.render.resolution_y = 900
    scene.render.filepath = os.path.join(RENDERS, 'mannequin.png')
    bpy.ops.render.render(write_still=True)
    print(f'Render: {scene.render.filepath}')


if __name__ == '__main__':
    main()
