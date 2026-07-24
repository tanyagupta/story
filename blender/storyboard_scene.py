import json
import math
import os
from pathlib import Path

import bpy


STORYBOARD_FILE = Path(os.environ["BLENDER_STORYBOARD_FILE"])
FRAME_DIR = Path(os.environ["BLENDER_STORYBOARD_FRAME_DIR"])
SPEECH_PLAN_FILE = os.environ.get("BLENDER_STORYBOARD_SPEECH_PLAN")


def load_storyboard():
    with STORYBOARD_FILE.open("r", encoding="utf8") as handle:
        return json.load(handle)


def load_speech_plan():
    if not SPEECH_PLAN_FILE:
        return {"entries": []}
    with Path(SPEECH_PLAN_FILE).open("r", encoding="utf8") as handle:
        return json.load(handle)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mat(name, color):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    return material


def key(obj, frame, location=None, rotation=None, scale=None):
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


def ease(obj):
    if not obj.animation_data or not obj.animation_data.action:
        return
    for curve in obj.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    obj.location = location
    if parent:
        obj.parent = parent
    return obj


def cube(name, dims, material, location, parent=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if parent:
        obj.parent = parent
    return obj


def sphere(name, radius, material, location, parent=None, scale=(1, 1, 1), segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(8, segments // 2), radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    return obj


def cylinder(name, radius, depth, material, location, parent=None, rotation=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    return obj


def text_obj(name, body, location, size, material, parent=None):
    bpy.ops.object.text_add(location=location, rotation=(math.radians(90), 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    return obj


def set_visible(obj, frame, visible):
    bpy.context.scene.frame_set(frame)
    obj.hide_viewport = not visible
    obj.hide_render = not visible
    obj.keyframe_insert(data_path="hide_viewport", frame=frame)
    obj.keyframe_insert(data_path="hide_render", frame=frame)


def visible_between(objects, start, end):
    for obj in objects:
        set_visible(obj, max(1, start - 1), False)
        set_visible(obj, start, True)
        set_visible(obj, end, True)
        set_visible(obj, end + 1, False)


def face_plate(name, material, parent):
    verts = []
    for index in range(36):
        angle = 2 * math.pi * index / 36
        verts.append((0.32 * math.cos(angle), -0.355, 0.03 + 0.39 * math.sin(angle)))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], [tuple(range(36))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def mouth_mesh(name, material, parent):
    basis = [(-0.16, -0.395, -0.13), (-0.05, -0.395, -0.15), (0.05, -0.395, -0.15), (0.16, -0.395, -0.13), (0.07, -0.395, -0.18), (-0.07, -0.395, -0.18)]
    shapes = {
        "smile": [(-0.18, -0.395, -0.12), (-0.06, -0.395, -0.19), (0.06, -0.395, -0.19), (0.18, -0.395, -0.12), (0.07, -0.395, -0.22), (-0.07, -0.395, -0.22)],
        "frown": [(-0.18, -0.395, -0.21), (-0.06, -0.395, -0.15), (0.06, -0.395, -0.15), (0.18, -0.395, -0.21), (0.07, -0.395, -0.19), (-0.07, -0.395, -0.19)],
        "open": [(-0.12, -0.397, -0.08), (-0.04, -0.397, -0.04), (0.04, -0.397, -0.04), (0.12, -0.397, -0.08), (0.1, -0.397, -0.29), (-0.1, -0.397, -0.29)],
        "round": [(-0.09, -0.397, -0.1), (-0.045, -0.397, -0.05), (0.045, -0.397, -0.05), (0.09, -0.397, -0.1), (0.075, -0.397, -0.26), (-0.075, -0.397, -0.26)],
    }
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(basis, [], [(0, 1, 2, 3, 4, 5)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    obj.shape_key_add(name="neutral")
    for shape_name, coords in shapes.items():
        shape = obj.shape_key_add(name=shape_name)
        for point, coord in zip(shape.data, coords):
            point.co = coord
    return obj


def set_mouth(obj, frame, shape):
    for key_block in obj.data.shape_keys.key_blocks:
        if key_block.name == "neutral":
            continue
        key_block.value = 1.0 if key_block.name == shape else 0.0
        key_block.keyframe_insert("value", frame=frame)


def create_character(prefix, materials, role, location):
    root = empty(f"{prefix}_root", location)
    skin = materials["skin_zeus"] if role == "zeus" else materials["skin_hermes"]
    robe = materials["zeus_robe"] if role == "zeus" else materials["hermes_tunic"]
    hair = materials["white"] if role == "zeus" else materials["dark"]
    trim = materials["gold"]

    cube(f"{prefix}_hips", (0.58, 0.24, 0.28), robe, (0, 0, 0.9), root)
    cube(f"{prefix}_torso", (0.72, 0.25, 0.92), robe, (0, 0, 1.45), root)
    cube(f"{prefix}_sash", (0.78, 0.28, 0.12), trim, (0, -0.01, 1.79), root, rotation=(0, 0, math.radians(-8)))
    cube(f"{prefix}_neck", (0.18, 0.16, 0.2), skin, (0, 0, 2.03), root)
    head = empty(f"{prefix}_head", (0, 0, 2.34), root)
    sphere(f"{prefix}_head_back", 0.43, skin, (0, 0, 0), head, scale=(0.86, 0.72, 1.03), segments=32)
    face_plate(f"{prefix}_face_mesh", skin, head)
    cube(f"{prefix}_hair_cap", (0.7, 0.12, 0.16), hair, (0, -0.34, 0.4), head)
    cube(f"{prefix}_hair_left", (0.11, 0.12, 0.34), hair, (-0.34, -0.32, 0.16), head)
    cube(f"{prefix}_hair_right", (0.11, 0.12, 0.34), hair, (0.34, -0.32, 0.16), head)
    if role == "zeus":
        sphere(f"{prefix}_beard", 0.22, hair, (0, -0.39, -0.29), head, scale=(1.1, 0.22, 0.75), segments=24)

    sphere(f"{prefix}_eye_l", 0.09, materials["eye"], (-0.14, -0.405, 0.12), head, scale=(1, 0.16, 0.76))
    sphere(f"{prefix}_eye_r", 0.09, materials["eye"], (0.14, -0.405, 0.12), head, scale=(1, 0.16, 0.76))
    pupil_l = sphere(f"{prefix}_pupil_l", 0.033, materials["dark"], (-0.14, -0.43, 0.12), head, scale=(1, 0.08, 1), segments=16)
    pupil_r = sphere(f"{prefix}_pupil_r", 0.033, materials["dark"], (0.14, -0.43, 0.12), head, scale=(1, 0.08, 1), segments=16)
    lid_l = cube(f"{prefix}_lid_l", (0.2, 0.03, 0.035), skin, (-0.14, -0.445, 0.23), head)
    lid_r = cube(f"{prefix}_lid_r", (0.2, 0.03, 0.035), skin, (0.14, -0.445, 0.23), head)
    brow_l = cube(f"{prefix}_brow_l", (0.22, 0.035, 0.035), hair, (-0.14, -0.45, 0.31), head, rotation=(0, 0, math.radians(8)))
    brow_r = cube(f"{prefix}_brow_r", (0.22, 0.035, 0.035), hair, (0.14, -0.45, 0.31), head, rotation=(0, 0, math.radians(-8)))
    sphere(f"{prefix}_nose", 0.038, materials["nose"], (0, -0.44, -0.02), head, scale=(0.65, 0.25, 1), segments=16)
    mouth = mouth_mesh(f"{prefix}_mouth", materials["dark"], head)

    joints = {"root": root, "head": head, "mouth": mouth, "pupil_l": pupil_l, "pupil_r": pupil_r, "lid_l": lid_l, "lid_r": lid_r, "brow_l": brow_l, "brow_r": brow_r}
    for side, sx in (("l", -1), ("r", 1)):
        upper = empty(f"{prefix}_upper_arm_{side}", (0.5 * sx, 0, 1.84), root)
        lower = empty(f"{prefix}_forearm_{side}", (0, 0, -0.54), upper)
        cylinder(f"{prefix}_upper_arm_{side}_mesh", 0.065, 0.54, skin, (0, 0, -0.27), upper)
        cylinder(f"{prefix}_forearm_{side}_mesh", 0.06, 0.52, skin, (0, 0, -0.26), lower)
        joints[f"upper_arm_{side}"] = upper
        joints[f"forearm_{side}"] = lower
    for side, sx in (("l", -1), ("r", 1)):
        upper = empty(f"{prefix}_upper_leg_{side}", (0.21 * sx, 0, 0.78), root)
        lower = empty(f"{prefix}_lower_leg_{side}", (0, 0, -0.61), upper)
        cylinder(f"{prefix}_upper_leg_{side}_mesh", 0.083, 0.61, materials["leg"], (0, 0, -0.31), upper)
        cylinder(f"{prefix}_lower_leg_{side}_mesh", 0.073, 0.58, materials["leg"], (0, 0, -0.29), lower)
        cube(f"{prefix}_foot_{side}", (0.32, 0.17, 0.08), materials["sandals"], (0.05 * sx, -0.05, -0.6), lower)
        if role == "hermes":
            cube(f"{prefix}_wing_{side}", (0.2, 0.03, 0.11), materials["white"], (0.18 * sx, -0.08, -0.54), lower, rotation=(0, 0, math.radians(25 * sx)))
        joints[f"upper_leg_{side}"] = upper
        joints[f"lower_leg_{side}"] = lower
    return joints


def all_character_objects(character):
    items = []
    for root in [character["root"]]:
        items.extend([root] + list(root.children_recursive))
    return items


def animate_expression(character, start, end, expression):
    mouth = character["mouth"]
    shape = "smile" if expression in ("happy", "relieved", "smile", "playful") else "frown" if expression in ("concerned", "worried", "strained") else "round" if expression in ("surprised", "urgent") else "neutral"
    for frame, mouth_shape in [(start, "neutral"), (start + 18, shape), (start + 38, "open"), (start + 58, shape), (end - 20, shape)]:
        set_mouth(mouth, frame, mouth_shape)
    for frame in [start + 26, start + 29, start + 32, start + 96, start + 99, start + 102]:
        closed = frame in (start + 29, start + 99)
        z = 0.12 if closed else 0.23
        scale = (1, 1, 3.2) if closed else (1, 1, 1)
        key(character["lid_l"], frame, location=(-0.14, -0.445, z), scale=scale)
        key(character["lid_r"], frame, location=(0.14, -0.445, z), scale=scale)
    for frame, dx, dz in [(start, 0, 0), (start + 40, 0.045, 0.015), (start + 80, -0.035, 0), (end, 0, 0)]:
        key(character["pupil_l"], frame, location=(-0.14 + dx, -0.43, 0.12 + dz))
        key(character["pupil_r"], frame, location=(0.14 + dx, -0.43, 0.12 + dz))
    brow_down = -0.03 if expression in ("concerned", "worried", "strained") else 0.06 if expression in ("surprised", "urgent") else 0.0
    for frame, offset in [(start, 0), (start + 36, brow_down), (end, 0.02)]:
        key(character["brow_l"], frame, location=(-0.14, -0.45, 0.31 + offset), rotation=(0, 0, math.radians(12 if offset < 0 else -8)))
        key(character["brow_r"], frame, location=(0.14, -0.45, 0.31 + offset), rotation=(0, 0, math.radians(-12 if offset < 0 else 8)))
    for obj in character.values():
        ease(obj)


def animate_speech_mouth(character, scene_start, scene_end, speech_entries, speaker, fps):
    mouth = character["mouth"]
    shapes = ["open", "round", "smile", "open", "neutral"]
    for entry in speech_entries:
        if entry.get("speaker") != speaker:
            continue
        start = max(scene_start + 1, int(entry["absoluteStart"] * fps) + 1)
        end = min(scene_end - 1, int(entry["absoluteEnd"] * fps) + 1)
        set_mouth(mouth, max(scene_start, start - 2), "neutral")
        frame = start
        index = 0
        step = max(2, int(fps * 0.18))
        while frame <= end:
            set_mouth(mouth, frame, shapes[index % len(shapes)])
            frame += step
            index += 1
        set_mouth(mouth, min(scene_end, end + 2), "neutral")
    ease(mouth)


def animate_walk(character, start, end, x0, x1):
    key(character["root"], start, location=(x0, 0, 0))
    key(character["root"], end, location=(x1, 0, 0))
    step = max(8, int((end - start) / 5))
    frame = start
    flip = 1
    while frame <= end:
        key(character["upper_leg_l"], frame, rotation=(0, math.radians(26 * flip), 0))
        key(character["upper_leg_r"], frame, rotation=(0, math.radians(-26 * flip), 0))
        key(character["upper_arm_l"], frame, rotation=(0, math.radians(-20 * flip), 0))
        key(character["upper_arm_r"], frame, rotation=(0, math.radians(20 * flip), 0))
        flip *= -1
        frame += step
    ease(character["root"])


def animate_point(character, start, end):
    key(character["upper_arm_r"], start, rotation=(0, math.radians(0), 0))
    key(character["upper_arm_r"], start + 22, rotation=(0, math.radians(-78), 0))
    key(character["forearm_r"], start + 22, rotation=(0, math.radians(-18), 0))
    key(character["upper_arm_r"], end, rotation=(0, math.radians(-55), 0))
    key(character["forearm_r"], end, rotation=(0, math.radians(-10), 0))


def make_clouds(materials, prefix, start, end):
    objs = []
    for index in range(8):
        x = -4.8 + index * 1.35
        z = 0.45 + (index % 3) * 0.18
        obj = sphere(f"{prefix}_cloud_{index}", 0.38, materials["cloud"], (x, 0.7, z), scale=(1.8, 0.25, 0.45), segments=16)
        key(obj, start, location=(x - 0.15, 0.7, z))
        key(obj, end, location=(x + 0.35, 0.7, z))
        ease(obj)
        objs.append(obj)
    return objs


def make_olympus(materials, prefix, start, end, has_bolt):
    objs = []
    objs.append(cube(f"{prefix}_terrace", (7.8, 1.1, 0.18), materials["marble"], (0, 0.15, 0.52)))
    objs.append(cube(f"{prefix}_throne", (0.9, 0.45, 1.1), materials["gold"], (-1.85, -0.1, 1.22)))
    for index, x in enumerate([-3.2, -2.45, 2.55, 3.3]):
        objs.append(cylinder(f"{prefix}_column_{index}", 0.11, 2.4, materials["marble"], (x, 0.15, 1.55)))
        objs.append(cube(f"{prefix}_cap_{index}", (0.42, 0.32, 0.14), materials["marble"], (x, 0.15, 2.78)))
    objs.extend(make_clouds(materials, prefix, start, end))
    objs.append(cube(f"{prefix}_pedestal", (0.52, 0.38, 0.45), materials["marble"], (1.55, -0.08, 0.92)))
    if has_bolt:
        bolt = create_bolt(f"{prefix}_bolt", materials["lightning"], (1.55, -0.34, 1.35))
        objs.extend(bolt)
    return objs


def make_valley(materials, prefix, start, end, powered=True):
    objs = []
    objs.append(cube(f"{prefix}_ground", (8.2, 1.2, 0.16), materials["rock"], (0, 0.1, 0.42)))
    for index, x in enumerate([-3.2, -2.0, 2.4, 3.4]):
        objs.append(sphere(f"{prefix}_rock_{index}", 0.55, materials["rock"], (x, 0.0, 0.85), scale=(1.4, 0.45, 0.7), segments=16))
    objs.append(cube(f"{prefix}_machine_base", (1.4, 0.55, 0.45), materials["bronze"], (1.2, -0.08, 0.9)))
    objs.append(cylinder(f"{prefix}_machine_ring", 0.55, 0.08, materials["bronze"], (1.2, -0.25, 1.45), rotation=(math.radians(90), 0, 0)))
    if powered:
        bolt = create_bolt(f"{prefix}_stolen_bolt", materials["lightning"], (1.2, -0.36, 1.62))
        objs.extend(bolt)
        for index, angle in enumerate([0, 60, 120, 180, 240, 300]):
            length = 0.7 + 0.12 * (index % 2)
            ray = cube(f"{prefix}_electric_ray_{index}", (0.08, 0.08, length), materials["electric"], (1.2 + math.cos(math.radians(angle)) * 0.45, -0.42, 1.62 + math.sin(math.radians(angle)) * 0.45), rotation=(0, math.radians(90 - angle), 0))
            key(ray, start, scale=(1, 1, 0.5))
            key(ray, start + 24, scale=(1.4, 1, 1.25))
            key(ray, end, scale=(0.8, 1, 0.65))
            objs.append(ray)
    return objs


def create_bolt(prefix, material, location):
    parts = []
    coords = [(0, 0, 0.36), (-0.15, 0, 0.02), (0.07, 0, 0.02), (-0.08, 0, -0.38), (0.25, 0, 0.08), (0.02, 0, 0.08)]
    for index, (x, y, z) in enumerate(coords):
        parts.append(cube(f"{prefix}_{index}", (0.11, 0.08, 0.42), material, (location[0] + x, location[1] + y, location[2] + z), rotation=(0, 0, math.radians(-25 if index % 2 else 25))))
    return parts


def scene_objects(storyboard, materials, start, end, scene_index, scene, speech_entries, fps):
    sid = scene.get("id", f"scene_{scene_index}")
    data = scene.get("blender_scene", {})
    env = data.get("environment", "olympus_terrace")
    objs = []
    if env == "rocky_valley":
        objs.extend(make_valley(materials, sid, start, end, powered=scene_index < 5))
    else:
        objs.extend(make_olympus(materials, sid, start, end, has_bolt=scene_index == 6))

    zeus_x = -2.2 if scene_index in (1, 2, 6) else -1.4
    hermes_x = 1.4 if scene_index != 2 else 2.5
    zeus = create_character(f"{sid}_zeus", materials, "zeus", (zeus_x, -0.08, 0))
    zeus_objs = all_character_objects(zeus)
    objs.extend(zeus_objs)
    animate_expression(zeus, start + 10, end - 6, data.get("characters", [{}])[0].get("expression", "neutral"))
    animate_speech_mouth(zeus, start, end, speech_entries, "zeus", fps)
    if scene_index == 1:
        animate_walk(zeus, start + 8, start + 72, -3.0, -1.7)
    elif scene_index in (4, 5):
        animate_walk(zeus, start + 8, start + 80, -2.1, -0.7)
    else:
        key(zeus["root"], start, location=(zeus_x, -0.08, 0))
        key(zeus["root"], end, location=(zeus_x + 0.1, -0.08, 0))
    if scene_index in (4, 5, 6):
        animate_point(zeus, start + 65, end - 15)
    if scene_index == 5:
        bolt = create_bolt(f"{sid}_zeus_hand_bolt", materials["lightning"], (-0.35, -0.43, 1.75))
        objs.extend(bolt)
        for part in bolt:
            key(part, start + 40, scale=(0.2, 0.2, 0.2))
            key(part, start + 115, scale=(1.25, 1.25, 1.25))

    if scene_index > 1:
        hermes = create_character(f"{sid}_hermes", materials, "hermes", (hermes_x, -0.05, 0))
        hermes_objs = all_character_objects(hermes)
        objs.extend(hermes_objs)
        animate_expression(hermes, start + 12, end - 10, "urgent" if scene_index in (2, 4) else "happy" if scene_index in (5, 6) else "surprised")
        animate_speech_mouth(hermes, start, end, speech_entries, "hermes", fps)
        if scene_index == 2:
            animate_walk(hermes, start + 1, start + 48, 3.5, 1.2)
            animate_point(hermes, start + 72, end - 12)
        elif scene_index == 3:
            animate_walk(hermes, start + 5, start + 50, 2.2, 1.5)
        elif scene_index in (4, 6):
            animate_point(hermes, start + 38, end - 20)
        else:
            key(hermes["root"], start, location=(hermes_x, -0.05, 0))
            key(hermes["root"], end, location=(hermes_x - 0.05, -0.05, 0))

    visible_between(objs, start, end)
    return objs


def animate_camera(scene, camera, start, end, scene_index):
    presets = {
        1: [(-0.3, -8.7, 2.05, 5.2), (-0.6, -8.2, 2.15, 4.2)],
        2: [(0.2, -8.3, 2.0, 4.4), (0.8, -8.1, 2.1, 3.4)],
        3: [(0.2, -9.0, 2.7, 5.4), (0.1, -8.1, 1.95, 4.4)],
        4: [(-0.9, -8.3, 1.95, 3.8), (-0.8, -8.0, 2.35, 2.3)],
        5: [(0.0, -8.2, 2.05, 3.8), (-0.25, -8.0, 2.2, 3.0)],
        6: [(0.0, -8.2, 2.05, 3.5), (0.0, -8.8, 2.05, 5.3)],
    }
    first, last = presets[scene_index]
    for frame, values in [(start, first), (end, last)]:
        bpy.context.scene.frame_set(frame)
        camera.location = values[:3]
        camera.rotation_euler = (math.radians(90), 0, 0)
        camera.data.ortho_scale = values[3]
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
        camera.data.keyframe_insert(data_path="ortho_scale", frame=frame)
    ease(camera)


def build():
    storyboard = load_storyboard()
    speech_plan = load_speech_plan()
    clear_scene()
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    fps = storyboard.get("fps") or storyboard.get("settings", {}).get("fps", 30)
    total_frames = int(sum(scene["duration"] for scene in storyboard["scenes"]) * fps)

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = total_frames
    scene.render.fps = fps
    scene.render.resolution_x = storyboard.get("resolution", [1280, 720])[0]
    scene.render.resolution_y = storyboard.get("resolution", [1280, 720])[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(FRAME_DIR / "frame_")
    scene.render.engine = "BLENDER_WORKBENCH"
    if hasattr(scene, "display"):
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "MATERIAL"
        scene.display.shading.show_object_outline = True
        scene.display.shading.show_shadows = True
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.color = (0.12, 0.15, 0.19)

    materials = {
        "skin_zeus": mat("zeus skin", (0.94, 0.68, 0.48, 1)),
        "skin_hermes": mat("hermes skin", (0.86, 0.55, 0.34, 1)),
        "zeus_robe": mat("zeus white robe", (0.92, 0.9, 0.78, 1)),
        "hermes_tunic": mat("hermes blue tunic", (0.15, 0.38, 0.72, 1)),
        "gold": mat("mythic gold", (1.0, 0.68, 0.12, 1)),
        "white": mat("white hair and wings", (0.96, 0.96, 0.9, 1)),
        "dark": mat("ink dark", (0.02, 0.02, 0.025, 1)),
        "eye": mat("eye white", (1.0, 0.98, 0.88, 1)),
        "nose": mat("rose nose", (1.0, 0.42, 0.52, 1)),
        "leg": mat("leg cloth", (0.38, 0.28, 0.2, 1)),
        "sandals": mat("leather sandals", (0.22, 0.13, 0.08, 1)),
        "marble": mat("warm marble", (0.78, 0.75, 0.65, 1)),
        "cloud": mat("soft cloud", (0.86, 0.88, 0.9, 1)),
        "rock": mat("valley rock", (0.28, 0.27, 0.28, 1)),
        "bronze": mat("ancient bronze", (0.45, 0.28, 0.13, 1)),
        "lightning": mat("glowing lightning", (1.0, 0.86, 0.08, 1)),
        "electric": mat("electric blue", (0.12, 0.64, 1.0, 1)),
        "text": mat("caption white", (0.96, 0.96, 0.9, 1)),
    }

    bpy.ops.object.camera_add(location=(0, -8.5, 2.1), rotation=(math.radians(90), 0, 0))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    scene.camera = camera

    start = 1
    for index, scene_data in enumerate(storyboard["scenes"], start=1):
        frames = int(scene_data["duration"] * fps)
        end = start + frames - 1
        scene_speech = [entry for entry in speech_plan.get("entries", []) if entry.get("sceneIndex") == index]
        scene_objects(storyboard, materials, start, end, index, scene_data, scene_speech, fps)
        animate_camera(scene_data, camera, start, end, index)
        start = end + 1


build()
bpy.ops.render.render(animation=True)
