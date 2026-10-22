import bpy, inspect
print(inspect.signature(bpy.ops.export_scene.gltf.get_rna_type().functions[0].parameters) if False else '')
props = bpy.ops.export_scene.gltf.get_rna_type().properties
names = [p.identifier for p in props if p.identifier not in ('rna_type',)]
print(names)
