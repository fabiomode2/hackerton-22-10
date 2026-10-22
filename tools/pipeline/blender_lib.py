"""
Utilidades de geometría y maniquí para el pipeline de cloth simulation.

Blender trabaja Z-arriba. Nuestros datos trabajan Y-arriba y Z-frontal.
Convenio de conversión (el mismo que usa el exportador glTF con export_yup=True):

    blender = (x, -z, y)      glTF = (x, y, z)

Así el GLB final sale con Y arriba y Z frontal, idéntico al contrato del repo.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector


# ---------------------------------------------------------------------------
# Escena
# ---------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 24
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.film_transparent = False
    return scene


def ensure_collection(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def link_to(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return obj


# ---------------------------------------------------------------------------
# Conversión de coordenadas
# ---------------------------------------------------------------------------

def data_to_blender(x, y, z):
    return (x, -z, y)


def blender_to_data(x, y, z):
    return (x, z, -y)


# ---------------------------------------------------------------------------
# Materiales
# ---------------------------------------------------------------------------

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(value, alpha=1.0):
    value = value.lstrip('#')
    r, g, b = (int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def make_material(name, color, roughness=0.6, metallic=0.0, sheen=0.0,
                  sheen_color=None, transmission=0.0, ior=1.45):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    if bsdf is None:
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = nt.nodes.get('Material Output') or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    rgba = hex_rgba(color) if isinstance(color, str) else color
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = ior
    for key, value in (
        ('Sheen Weight', sheen),
        ('Sheen Roughness', 0.85),
        ('Specular IOR Level', 0.5),
        ('Transmission Weight', transmission),
    ):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    if sheen_color and 'Sheen Tint' in bsdf.inputs:
        bsdf.inputs['Sheen Tint'].default_value = hex_rgba(sheen_color)
    mat.diffuse_color = rgba
    return mat


# ---------------------------------------------------------------------------
# Malla
# ---------------------------------------------------------------------------

def new_mesh_object(name, verts, faces, uvs=None, material=None, coll=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    if uvs is not None:
        layer = mesh.uv_layers.new(name='UVMap')
        loop_uvs = []
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                vi = mesh.loops[li].vertex_index
                loop_uvs.append(uvs[vi * 2])
                loop_uvs.append(uvs[vi * 2 + 1])
        layer.data.foreach_set('uv', loop_uvs)
    obj = bpy.data.objects.new(name, mesh)
    (coll or bpy.context.scene.collection).objects.link(obj)
    if material is not None:
        obj.data.materials.append(material)
    return obj


def shade_smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True


def join_objects(objects, name=None):
    if not objects:
        raise ValueError('join_objects: lista vacía')
    activate(objects[0])
    for obj in objects[1:]:
        obj.select_set(True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    if name:
        joined.name = name
    return joined


def apply_modifier(obj, modifier):
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


# ---------------------------------------------------------------------------
# Anillos / lofts
# ---------------------------------------------------------------------------

def unit_superellipse_perimeter(k, n, samples=512):
    total = 0.0
    prev = None
    for i in range(samples + 1):
        t = (i / samples) * math.tau
        c, s = math.cos(t), math.sin(t)
        e = 2.0 / n
        p = (math.copysign(abs(c) ** e, c), k * math.copysign(abs(s) ** e, s))
        if prev is not None:
            total += math.hypot(p[0] - prev[0], p[1] - prev[1])
        prev = p
    return total


def radii_from_girth(girth, k=0.74, n=2.4):
    rx = girth / max(unit_superellipse_perimeter(k, n), 1e-9)
    return rx, rx * k


def ring_points(cx, cy, z, rx, ry, n, segments):
    pts = []
    for j in range(segments):
        t = (j / segments) * math.tau
        c, s = math.cos(t), math.sin(t)
        e = 2.0 / n
        x = cx + rx * math.copysign(abs(c) ** e, c)
        y = cy + ry * math.copysign(abs(s) ** e, s)
        pts.append((x, y, z))
    return pts


def loft_rings(rings, segments=96, cap_bottom=False, cap_top=False):
    """rings: list of dict(cx, cy, z, rx, ry, n), de abajo arriba."""
    verts = []
    faces = []
    for ring in rings:
        verts.extend(ring_points(ring['cx'], ring['cy'], ring['z'],
                                 ring['rx'], ring['ry'], ring['n'], segments))
    for i in range(len(rings) - 1):
        for j in range(segments):
            j2 = (j + 1) % segments
            a = i * segments + j
            b = i * segments + j2
            c = (i + 1) * segments + j2
            d = (i + 1) * segments + j
            faces.append((a, b, c))
            faces.append((a, c, d))
    if cap_bottom:
        center = len(verts)
        r0 = rings[0]
        verts.append((r0['cx'], r0['cy'], r0['z']))
        for j in range(segments):
            faces.append((center, (j + 1) % segments, j))
    if cap_top:
        center = len(verts)
        rN = rings[-1]
        verts.append((rN['cx'], rN['cy'], rN['z']))
        base = (len(rings) - 1) * segments
        for j in range(segments):
            faces.append((center, base + j, base + (j + 1) % segments))
    return verts, faces


def ellipsoid(name, center, scale, segments=40, rings=24, material=None, coll=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.location = center
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    shade_smooth(obj)
    if material:
        obj.data.materials.append(material)
    if coll:
        link_to(obj, coll)
    return obj


# ---------------------------------------------------------------------------
# Maniquí
# ---------------------------------------------------------------------------

def build_mannequin(body, coll, material, pedestal_material):
    """body en cm (contrato del repo). Devuelve el objeto del cuerpo."""
    H = body['height_cm'] / 100.0
    bust = body['bust_cm'] / 100.0
    waist = body['waist_cm'] / 100.0
    hips = body['hips_cm'] / 100.0
    shoulder = body['shoulder_cm'] / 100.0
    inseam = body['inseam_cm'] / 100.0

    # Anclajes antropométricos (mismos ratios que garment.ts / defaultAnchors)
    hipY = max(inseam * 1.1, 0.47 * H)
    hipY = min(hipY, 0.56 * H)
    waistY = 0.615 * H
    chestY = 0.72 * H
    armpitY = 0.755 * H
    shoulderY = 0.82 * H
    neckY = 0.855 * H

    torso_specs = [
        (hipY - 0.10, hips * 0.88, 0.76, 2.45),
        (hipY - 0.04, hips * 0.96, 0.78, 2.45),
        (hipY, hips * 1.00, 0.79, 2.45),
        (hipY + 0.06, hips * 0.975, 0.78, 2.45),
        (waistY - 0.06, waist + (hips - waist) * 0.55, 0.75, 2.40),
        (waistY - 0.02, waist + (hips - waist) * 0.22, 0.74, 2.38),
        (waistY, waist, 0.73, 2.36),
        (waistY + 0.05, waist + (bust - waist) * 0.35, 0.72, 2.34),
        (waistY + 0.10, waist + (bust - waist) * 0.68, 0.72, 2.32),
        (chestY - 0.02, bust * 0.99, 0.72, 2.30),
        (chestY + 0.02, bust, 0.72, 2.30),
        (armpitY - 0.02, bust * 0.995, 0.71, 2.30),
        (armpitY, bust * 0.97, 0.70, 2.32),
        (armpitY + 0.03, bust * 0.88, 0.68, 2.36),
        (shoulderY - 0.04, bust * 0.70, 0.64, 2.45),
        (shoulderY - 0.02, bust * 0.50, 0.58, 2.50),
        (shoulderY, bust * 0.34, 0.55, 2.55),
    ]
    rings = []
    for z, C, k, n in torso_specs:
        rx, ry = radii_from_girth(C, k, n)
        rings.append({'cx': 0.0, 'cy': 0.0, 'z': z, 'rx': rx, 'ry': ry, 'n': n})

    verts, faces = loft_rings(rings, segments=96, cap_bottom=True, cap_top=True)
    torso = new_mesh_object('Body.Torso', verts, faces, material=material, coll=coll)
    shade_smooth(torso)

    parts = [torso]

    # Pecho sutil (el maniquí es asexuado, pero el pecho 92 no es un cilindro)
    for side in (-1, 1):
        parts.append(ellipsoid(
            f'Body.Chest.{side}',
            (side * bust * 0.075, -0.055, chestY - 0.005),
            (0.065, 0.052, 0.058),
            material=material, coll=coll))

    # Cuello
    neck_specs = [
        (shoulderY - 0.04, 0.068),
        (shoulderY + 0.02, 0.061),
        (neckY + 0.01, 0.056),
        (neckY + 0.06, 0.058),
    ]
    neck_rings = [{'cx': 0.0, 'cy': -0.005, 'z': z, 'rx': r, 'ry': r * 0.92, 'n': 2.0}
                  for z, r in neck_specs]
    v, f = loft_rings(neck_rings, segments=64, cap_bottom=True, cap_top=True)
    neck = new_mesh_object('Body.Neck', v, f, material=material, coll=coll)
    shade_smooth(neck)
    parts.append(neck)

    # Cabeza abstracta (sin cara)
    head_z = neckY + 0.105
    parts.append(ellipsoid('Body.Head', (0.0, 0.005, head_z),
                           (0.078, 0.092, 0.108), material=material, coll=coll))
    parts.append(ellipsoid('Body.Jaw', (0.0, -0.020, head_z - 0.070),
                           (0.056, 0.064, 0.050), material=material, coll=coll))

    # Brazos
    for side in (-1, 1):
        arm_rings = []
        arm_specs = [
            (shoulderY + 0.005, 0.072),
            (shoulderY - 0.035, 0.068),
            (shoulderY - 0.075, 0.056),
            (shoulderY - 0.16, 0.048),
            (shoulderY - 0.26, 0.042),
            (shoulderY - 0.31, 0.039),
            (shoulderY - 0.40, 0.043),
            (shoulderY - 0.49, 0.035),
            (shoulderY - 0.55, 0.030),
        ]
        for z, r in arm_specs:
            t = max(0.0, (shoulderY - z) / max(0.55, 1e-6))
            # El brazo cuelga FUERA del torso. Si el centro cae dentro del
            # torso, el cloth de la camiseta colisiona con el brazo y se
            # infla como una esfera alrededor del maniquí.
            cx = side * (0.198 + 0.042 * t)
            arm_rings.append({'cx': cx, 'cy': -0.005, 'z': z, 'rx': r, 'ry': r * 0.95, 'n': 2.0})
        v, f = loft_rings(arm_rings, segments=48, cap_bottom=True, cap_top=True)
        arm = new_mesh_object(f'Body.Arm.{side}', v, f, material=material, coll=coll)
        shade_smooth(arm)
        parts.append(arm)
        # Mano sencilla, tipo maniquí de sastrería
        wrist_z = shoulderY - 0.55
        parts.append(ellipsoid(
            f'Body.Hand.{side}',
            (side * 0.240, -0.005, wrist_z - 0.055),
            (0.034, 0.043, 0.072), material=material, coll=coll))

    # Piernas
    for side in (-1, 1):
        leg_rings = []
        leg_specs = [
            (max(0.05, inseam - 0.75), 0.032),
            (max(0.06, inseam - 0.62), 0.043),
            (max(0.08, inseam - 0.46), 0.058),
            (max(0.10, inseam - 0.30), 0.063),
            (max(0.12, inseam - 0.20), 0.055),
            (max(0.14, inseam - 0.10), 0.070),
            (max(0.16, inseam - 0.02), 0.086),
            (max(0.18, inseam + 0.04), 0.094),
        ]
        # Ordenar de abajo arriba (por si la altura es pequeña)
        leg_specs.sort(key=lambda item: item[0])
        for z, r in leg_specs:
            # Cadera un poco más ancha que el tobillo, pie hacia dentro.
            cx = side * (0.082 + 0.018 * max(0.0, (z - 0.1) / 0.8))
            leg_rings.append({'cx': cx, 'cy': 0.0, 'z': z, 'rx': r, 'ry': r * 0.94, 'n': 2.0})
        v, f = loft_rings(leg_rings, segments=48, cap_bottom=True, cap_top=True)
        leg = new_mesh_object(f'Body.Leg.{side}', v, f, material=material, coll=coll)
        shade_smooth(leg)
        parts.append(leg)
        # Pie
        parts.append(ellipsoid(
            f'Body.Foot.{side}',
            (side * 0.100, -0.065, 0.035),
            (0.046, 0.112, 0.036), material=material, coll=coll))

    # Unir cuerpo
    body_obj = join_objects(parts, 'Mannequin')
    shade_smooth(body_obj)

    # Remesh: convierte las piezas (torso, brazos, piernas, cabeza) en una
    # superficie continua. Sin esto el maniquí parece un muñeco de bolas.
    activate(body_obj)
    body_obj.data.remesh_voxel_size = 0.005
    body_obj.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    shade_smooth(body_obj)
    activate(body_obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')

    smooth = body_obj.modifiers.new('Smooth', 'SMOOTH')
    smooth.factor = 0.6
    smooth.iterations = 16
    apply_modifier(body_obj, smooth)

    decimate = body_obj.modifiers.new('Decimate', 'DECIMATE')
    decimate.decimate_type = 'COLLAPSE'
    decimate.ratio = 0.55
    apply_modifier(body_obj, decimate)

    # Suavizado final sin perder silueta
    subd = body_obj.modifiers.new('BodySmooth', 'SUBSURF')
    subd.subdivision_type = 'CATMULL_CLARK'
    subd.levels = 1
    subd.render_levels = 1
    apply_modifier(body_obj, subd)
    shade_smooth(body_obj)
    body_obj.data.materials.clear()
    body_obj.data.materials.append(material)

    # Peana de estudio
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.40, depth=0.025, location=(0, 0, -0.0125))
    pedestal = bpy.context.object
    pedestal.name = 'Pedestal'
    bev = pedestal.modifiers.new('Bevel', 'BEVEL')
    bev.width = 0.006
    bev.segments = 3
    apply_modifier(pedestal, bev)
    shade_smooth(pedestal)
    pedestal.data.materials.append(pedestal_material)
    link_to(pedestal, coll)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.405, minor_radius=0.004,
                                     major_segments=128, minor_segments=12,
                                     location=(0, 0, 0.001))
    ring = bpy.context.object
    ring.name = 'Pedestal.Ring'
    shade_smooth(ring)
    ring.data.materials.append(pedestal_material)
    link_to(ring, coll)

    return body_obj, pedestal, ring


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_glb(objects, filepath, draco=False):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    activate(objects[0])
    for obj in objects[1:]:
        obj.select_set(True)
    kwargs = dict(
        filepath=filepath,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    if draco:
        kwargs.update(
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
        )
    bpy.ops.export_scene.gltf(**kwargs)
    print(f'GLB: {filepath} ({os.path.getsize(filepath) / 1024:.1f} KB)')
