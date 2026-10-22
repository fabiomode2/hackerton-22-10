import time
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 30

# Grid
bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=40, size=1.6, location=(0, 0, 1.2))
cloth = bpy.context.object
cloth.name = 'Cloth'
vg = cloth.vertex_groups.new(name='pin')
for v in cloth.data.vertices:
    if v.co.z > 1.15:
        vg.add([v.index], 1.0, 'REPLACE')
mod = cloth.modifiers.new('Cloth', 'CLOTH')
s = mod.settings
s.quality = 8
s.mass = 0.25
s.vertex_group_mass = 'pin'
s.pin_stiffness = 10
cs = mod.collision_settings
cs.use_collision = True
cs.collision_quality = 4
cs.distance_min = 0.002
cs.use_self_collision = False

bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.35, location=(0, 0, 0.35))
body = bpy.context.object
body.name = 'Body'
col = body.modifiers.new('Collision', 'COLLISION')
col.settings.thickness_outer = 0.003

scene.frame_set(1)
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
t0 = time.time()
for f in range(1, 31):
    scene.frame_set(f)
    deps.update()
    ev = cloth.evaluated_get(deps)
    me = ev.to_mesh()
    n = len(me.vertices)
    zmin = min(v.co.z for v in me.vertices)
    print(f'frame {f}: {n} verts zmin={zmin:.4f} t={time.time()-t0:.2f}s', flush=True)
    ev.to_mesh_clear()
print('total', time.time() - t0)
