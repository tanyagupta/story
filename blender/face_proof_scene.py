import math
import os
from pathlib import Path

import bpy


FRAME_DIR = Path(os.environ["BLENDER_PROOF_FRAME_DIR"])
FPS = int(os.environ.get("BLENDER_PROOF_FPS", "30"))
DURATION_SECONDS = float(os.environ.get("BLENDER_PROOF_SECONDS", "8"))
FRAME_COUNT = int(FPS * DURATION_SECONDS)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def toon_material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.9
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.05
    return mat


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.16
    obj.location = location
    if parent:
        obj.parent = parent
    return obj


def keyframe(obj, frame, location=None, rotation=None, scale=None):
    bpy.context.scene.frame_set(frame)
    if location is not None:
        obj.location = location
        obj.keyframe_insert(data_path="location", frame=frame)
    if rotation is not None:
        obj.rotation_euler = rotation
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert(data_path="scale", frame=frame)


def ease_animation(obj):
    if not obj.animation_data or not obj.animation_data.action:
        return
    for curve in obj.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"


def apply_ease_to_shape_keys(obj):
    if not obj.data.shape_keys or not obj.data.shape_keys.animation_data:
        return
    action = obj.data.shape_keys.animation_data.action
    if not action:
        return
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"


def block(name, dimensions, mat, parent, location, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if parent:
        obj.parent = parent
    return obj


def sphere(name, radius, mat, parent, location, scale=(1, 1, 1), segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def cylinder(name, radius, depth, mat, parent, location, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def face_plate(name, mat, parent):
    verts = []
    count = 40
    for i in range(count):
        angle = 2 * math.pi * i / count
        verts.append((0.33 * math.cos(angle), -0.355, 0.06 + 0.42 * math.sin(angle)))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], [tuple(range(count))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def set_shape_coords(shape_key, coords):
    for point, coord in zip(shape_key.data, coords):
        point.co = coord


def create_mouth_mesh(name, mat, parent):
    basis = [
        (-0.16, -0.39, -0.13),
        (-0.07, -0.39, -0.145),
        (0.0, -0.39, -0.15),
        (0.07, -0.39, -0.145),
        (0.16, -0.39, -0.13),
        (0.07, -0.39, -0.17),
        (0.0, -0.39, -0.176),
        (-0.07, -0.39, -0.17),
    ]
    shapes = {
        "smile": [
            (-0.19, -0.39, -0.13),
            (-0.09, -0.39, -0.18),
            (0.0, -0.39, -0.195),
            (0.09, -0.39, -0.18),
            (0.19, -0.39, -0.13),
            (0.09, -0.39, -0.22),
            (0.0, -0.39, -0.23),
            (-0.09, -0.39, -0.22),
        ],
        "frown": [
            (-0.18, -0.39, -0.21),
            (-0.09, -0.39, -0.16),
            (0.0, -0.39, -0.145),
            (0.09, -0.39, -0.16),
            (0.18, -0.39, -0.21),
            (0.09, -0.39, -0.195),
            (0.0, -0.39, -0.185),
            (-0.09, -0.39, -0.195),
        ],
        "open": [
            (-0.12, -0.392, -0.11),
            (-0.06, -0.392, -0.07),
            (0.0, -0.392, -0.055),
            (0.06, -0.392, -0.07),
            (0.12, -0.392, -0.11),
            (0.105, -0.392, -0.28),
            (0.0, -0.392, -0.32),
            (-0.105, -0.392, -0.28),
        ],
        "round": [
            (-0.09, -0.392, -0.13),
            (-0.065, -0.392, -0.07),
            (0.0, -0.392, -0.045),
            (0.065, -0.392, -0.07),
            (0.09, -0.392, -0.13),
            (0.075, -0.392, -0.25),
            (0.0, -0.392, -0.29),
            (-0.075, -0.392, -0.25),
        ],
    }
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(basis, [], [(0, 1, 2, 3, 4, 5, 6, 7)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    obj.shape_key_add(name="neutral")
    for shape_name, coords in shapes.items():
        set_shape_coords(obj.shape_key_add(name=shape_name), coords)
    return obj


def set_mouth(obj, frame, shape_name):
    for key in obj.data.shape_keys.key_blocks:
        if key.name == "neutral":
            continue
        key.value = 1.0 if key.name == shape_name else 0.0
        key.keyframe_insert("value", frame=frame)


def add_text(name, text, location, size, mat):
    bpy.ops.object.text_add(location=location, rotation=(math.radians(90), 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.materials.append(mat)
    return obj


def create_character(mats):
    root = empty("character_root", (-2.1, 0, 0))
    hips = block("hips", (0.65, 0.24, 0.35), mats["pants"], root, (0, 0, 0.95))
    torso = block("torso", (0.78, 0.24, 1.0), mats["shirt"], root, (0, 0, 1.52))
    neck = block("neck", (0.2, 0.16, 0.22), mats["skin"], root, (0, 0, 2.12))
    head = empty("head_control", (0, 0, 2.45), root)
    sphere("head_back", 0.46, mats["skin"], head, (0, 0, 0), scale=(0.86, 0.72, 1.05), segments=32, rings=16)
    face_plate("separate_face_mesh", mats["face"], head)
    block("hair_cap", (0.72, 0.13, 0.18), mats["hair"], head, (0, -0.34, 0.42))
    block("hair_side_L", (0.12, 0.12, 0.34), mats["hair"], head, (-0.35, -0.32, 0.22))
    block("hair_side_R", (0.12, 0.12, 0.34), mats["hair"], head, (0.35, -0.32, 0.22))

    eye_l = sphere("eye_L", 0.095, mats["eye"], head, (-0.15, -0.405, 0.13), scale=(1.0, 0.16, 0.78), segments=24, rings=12)
    eye_r = sphere("eye_R", 0.095, mats["eye"], head, (0.15, -0.405, 0.13), scale=(1.0, 0.16, 0.78), segments=24, rings=12)
    pupil_l = sphere("pupil_L", 0.036, mats["pupil"], head, (-0.15, -0.43, 0.12), scale=(1.0, 0.08, 1.0), segments=16, rings=8)
    pupil_r = sphere("pupil_R", 0.036, mats["pupil"], head, (0.15, -0.43, 0.12), scale=(1.0, 0.08, 1.0), segments=16, rings=8)
    lid_l = block("upper_lid_L", (0.2, 0.03, 0.035), mats["skin"], head, (-0.15, -0.445, 0.23))
    lid_r = block("upper_lid_R", (0.2, 0.03, 0.035), mats["skin"], head, (0.15, -0.445, 0.23))
    brow_l = block("brow_L", (0.22, 0.035, 0.035), mats["pupil"], head, (-0.15, -0.45, 0.32), rotation=(0, 0, math.radians(8)))
    brow_r = block("brow_R", (0.22, 0.035, 0.035), mats["pupil"], head, (0.15, -0.45, 0.32), rotation=(0, 0, math.radians(-8)))
    sphere("nose", 0.04, mats["nose"], head, (0, -0.44, -0.02), scale=(0.65, 0.25, 1.0), segments=16, rings=8)
    mouth = create_mouth_mesh("mouth_shape_key_mesh", mats["pupil"], head)

    joints = {
        "root": root,
        "head": head,
        "mouth": mouth,
        "pupil_l": pupil_l,
        "pupil_r": pupil_r,
        "lid_l": lid_l,
        "lid_r": lid_r,
        "brow_l": brow_l,
        "brow_r": brow_r,
    }
    for side, sx in [("L", -1), ("R", 1)]:
        upper_arm = empty(f"upper_arm_{side}", (0.52 * sx, 0, 1.92), root)
        forearm = empty(f"forearm_{side}", (0, 0, -0.58), upper_arm)
        cylinder(f"upper_arm_{side}_mesh", 0.075, 0.58, mats["skin"], upper_arm, (0, 0, -0.29))
        cylinder(f"forearm_{side}_mesh", 0.068, 0.55, mats["skin"], forearm, (0, 0, -0.275))
        joints[f"upper_arm_{side}"] = upper_arm
        joints[f"forearm_{side}"] = forearm

    for side, sx in [("L", -1), ("R", 1)]:
        thigh = empty(f"upper_leg_{side}", (0.23 * sx, 0, 0.82), root)
        shin = empty(f"lower_leg_{side}", (0, 0, -0.68), thigh)
        cylinder(f"upper_leg_{side}_mesh", 0.095, 0.68, mats["pants"], thigh, (0, 0, -0.34))
        cylinder(f"lower_leg_{side}_mesh", 0.085, 0.62, mats["pants"], shin, (0, 0, -0.31))
        block(f"foot_{side}", (0.34, 0.18, 0.1), mats["hair"], shin, (0.06 * sx, -0.04, -0.66))
        joints[f"upper_leg_{side}"] = thigh
        joints[f"lower_leg_{side}"] = shin
    return joints


def animate_face(character):
    mouth = character["mouth"]
    for frame, shape in [(1, "neutral"), (74, "neutral"), (88, "smile"), (108, "open"), (126, "round"), (146, "frown"), (168, "open"), (190, "smile"), (FRAME_COUNT, "smile")]:
        set_mouth(mouth, frame, shape)
    apply_ease_to_shape_keys(mouth)

    for frame, x, z in [(1, 0, 0), (70, 0.03, 0), (100, -0.045, 0.02), (126, 0.02, 0.02), (150, 0.055, -0.015), (185, 0, 0), (FRAME_COUNT, 0, 0)]:
        keyframe(character["pupil_l"], frame, location=(-0.15 + x, -0.43, 0.12 + z))
        keyframe(character["pupil_r"], frame, location=(0.15 + x, -0.43, 0.12 + z))

    for frame in (82, 85, 88, 138, 141, 144):
        closed = frame in (85, 141)
        z = 0.12 if closed else 0.23
        scale = (1, 1, 3.2) if closed else (1, 1, 1)
        keyframe(character["lid_l"], frame, location=(-0.15, -0.445, z), scale=scale)
        keyframe(character["lid_r"], frame, location=(0.15, -0.445, z), scale=scale)

    for frame, lz, rz, lr, rr in [(1, 0.32, 0.32, 8, -8), (92, 0.42, 0.42, -12, 12), (126, 0.43, 0.35, -20, 8), (148, 0.27, 0.36, 18, -14), (190, 0.35, 0.35, 0, 0), (FRAME_COUNT, 0.35, 0.35, 0, 0)]:
        keyframe(character["brow_l"], frame, location=(-0.15, -0.45, lz), rotation=(0, 0, math.radians(lr)))
        keyframe(character["brow_r"], frame, location=(0.15, -0.45, rz), rotation=(0, 0, math.radians(rr)))

    for frame, angle in [(1, -10), (60, -4), (90, 0), (118, 8), (150, -6), (190, 3), (FRAME_COUNT, 0)]:
        keyframe(character["head"], frame, rotation=(0, 0, math.radians(angle)))

    for obj in character.values():
        if hasattr(obj, "animation_data"):
            ease_animation(obj)


def animate_body(character):
    keyframe(character["root"], 1, location=(-2.1, 0, 0))
    keyframe(character["root"], 60, location=(-0.6, 0, 0))
    keyframe(character["root"], 180, location=(-0.45, 0, 0))
    keyframe(character["root"], FRAME_COUNT, location=(-0.45, 0, 0))
    ease_animation(character["root"])

    walk_frames = [1, 16, 31, 46, 60]
    for frame, lh, rh, la, ra in zip(walk_frames, [32, -30, 30, -24, 0], [-32, 30, -30, 24, 0], [-28, 28, -26, 16, 0], [28, -28, 26, -16, 0]):
        keyframe(character["upper_leg_L"], frame, rotation=(0, math.radians(lh), 0))
        keyframe(character["upper_leg_R"], frame, rotation=(0, math.radians(rh), 0))
        keyframe(character["upper_arm_L"], frame, rotation=(0, math.radians(la), 0))
        keyframe(character["upper_arm_R"], frame, rotation=(0, math.radians(ra), 0))
    for frame, angle in [(170, 0), (195, -72), (FRAME_COUNT, -50)]:
        keyframe(character["upper_arm_R"], frame, rotation=(0, math.radians(angle), 0))
        keyframe(character["forearm_R"], frame, rotation=(0, math.radians(-18), 0))
    for obj in character.values():
        if hasattr(obj, "animation_data"):
            ease_animation(obj)


def build_scene():
    clear_scene()
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = FRAME_COUNT
    scene.render.fps = FPS
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(FRAME_DIR / "frame_")
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.color = (0.16, 0.17, 0.18)
    if hasattr(scene, "eevee"):
        for attr in ("taa_render_samples", "taa_samples"):
            if hasattr(scene.eevee, attr):
                setattr(scene.eevee, attr, 16)

    mats = {
        "skin": toon_material("cel skin", (0.95, 0.66, 0.45, 1)),
        "face": toon_material("separate face plane", (1.0, 0.72, 0.52, 1)),
        "shirt": toon_material("clear coral shirt", (0.95, 0.2, 0.16, 1)),
        "pants": toon_material("blue pants", (0.05, 0.12, 0.34, 1)),
        "hair": toon_material("ink hair", (0.025, 0.023, 0.025, 1)),
        "eye": toon_material("warm eye white", (0.98, 0.98, 0.9, 1)),
        "pupil": toon_material("ink face detail", (0.01, 0.01, 0.012, 1)),
        "nose": toon_material("pink nose", (1.0, 0.38, 0.5, 1)),
        "floor": toon_material("studio floor", (0.23, 0.24, 0.25, 1)),
        "screen": toon_material("screen blue", (0.05, 0.26, 0.95, 1)),
        "alert": toon_material("alert yellow", (1.0, 0.82, 0.04, 1)),
        "text": toon_material("soft white", (0.92, 0.94, 0.9, 1)),
    }

    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.02))
    floor = bpy.context.object
    floor.name = "clean toon stage"
    floor.data.materials.append(mats["floor"])
    block("desk", (2.5, 0.48, 0.16), mats["hair"], None, (1.95, 0, 0.92))
    block("screen", (1.1, 0.08, 0.72), mats["screen"], None, (2.35, -0.4, 1.52))
    add_text("alert", "!", (2.35, -0.48, 1.52), 0.5, mats["alert"])
    add_text("title", "FACE RIG SHAPE KEY PROOF", (0, -2.7, 3.55), 0.16, mats["text"])

    character = create_character(mats)
    animate_body(character)
    animate_face(character)

    bpy.ops.object.light_add(type="AREA", location=(-2.4, -4, 5.8))
    key_light = bpy.context.object
    key_light.name = "soft toon key"
    key_light.data.size = 5
    key_light.data.energy = 950
    bpy.ops.object.light_add(type="POINT", location=(1.6, -3.2, 3.0))
    fill = bpy.context.object
    fill.name = "eye catchlight"
    fill.data.energy = 140

    bpy.ops.object.camera_add(location=(-0.7, -8.5, 2.0), rotation=(math.radians(90), 0, 0))
    camera = bpy.context.object
    scene.camera = camera
    camera.data.type = "ORTHO"
    for frame, loc, scale in [
        (1, (-0.95, -8.5, 2.0), 4.8),
        (60, (-0.3, -8.2, 2.05), 4.25),
        (75, (-0.42, -8.0, 2.45), 2.0),
        (180, (-0.42, -8.0, 2.45), 2.0),
        (FRAME_COUNT, (0.0, -8.2, 2.15), 4.15),
    ]:
        scene.frame_set(frame)
        camera.location = loc
        camera.rotation_euler = (math.radians(90), 0, 0)
        camera.data.ortho_scale = scale
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
        camera.data.keyframe_insert(data_path="ortho_scale", frame=frame)
    ease_animation(camera)


build_scene()
bpy.ops.render.render(animation=True)
