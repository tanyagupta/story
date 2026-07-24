import math
import os
from pathlib import Path

import bpy


FRAME_DIR = Path(os.environ["BLENDER_PROOF_FRAME_DIR"])
FPS = int(os.environ.get("BLENDER_PROOF_FPS", "30"))
DURATION_SECONDS = float(os.environ.get("BLENDER_PROOF_SECONDS", "7"))
FRAME_COUNT = int(FPS * DURATION_SECONDS)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    return mat


def toon_material(name, color):
    mat = material(name, color)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.85
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.15
    return mat


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.18
    obj.location = location
    if parent:
        obj.parent = parent
    return obj


def parent_local(obj, parent, location):
    obj.parent = parent
    obj.matrix_parent_inverse.identity()
    obj.location = location
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


def limb(name, length, radius, mat, parent):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=radius, depth=length, location=(0, 0, -length / 2))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def capsule(name, radius, mat, parent, location):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def block(name, dimensions, mat, parent, location):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.data.materials.append(mat)
    obj.parent = parent
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def local_block(name, dimensions, mat, parent, location, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    parent_local(obj, parent, location)
    return obj


def local_sphere(name, radius, mat, parent, location, scale=(1, 1, 1), segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    parent_local(obj, parent, location)
    return obj


def mouth_curve(name, points, mat, parent):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = 0.018
    curve.bevel_resolution = 2
    polyline = curve.splines.new("POLY")
    polyline.points.add(len(points) - 1)
    for point, coords in zip(polyline.points, points):
        point.co = (coords[0], coords[1], coords[2], 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_text(name, text, location, size, mat, rotation=(math.radians(90), 0, 0)):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.materials.append(mat)
    return obj


def scale_visibility(obj, frame, visible, scale=(1, 1, 1)):
    keyframe(obj, frame, scale=scale if visible else (0.01, 0.01, 0.01))


def set_mouth_expression(face, frame, expression):
    for name in ("mouth_neutral", "mouth_smile", "mouth_frown", "mouth_open", "mouth_surprised"):
        scale_visibility(face[name], frame, False)
    scale_visibility(face[f"mouth_{expression}"], frame, True)


def animate_face(face, prefix):
    for frame, x_offset, z_offset in [
        (1, -0.025, 0),
        (45, 0.035, 0.005),
        (90, 0.06, -0.005),
        (125, 0.0, 0.025),
        (155, -0.02, 0),
        (FRAME_COUNT, 0.0, 0),
    ]:
        keyframe(face["pupil_L"], frame, location=(-0.105 + x_offset, -0.328, 0.25 + z_offset))
        keyframe(face["pupil_R"], frame, location=(0.105 + x_offset, -0.328, 0.25 + z_offset))

    for frame in (34, 35, 36, 126, 127, 128, 176, 177, 178):
        closed = frame % 3 == 1
        keyframe(face["eye_L"], frame, scale=(1, 1, 0.08) if closed else (1, 1, 1))
        keyframe(face["eye_R"], frame, scale=(1, 1, 0.08) if closed else (1, 1, 1))
        keyframe(face["pupil_L"], frame, scale=(1, 1, 0.05) if closed else (1, 1, 1))
        keyframe(face["pupil_R"], frame, scale=(1, 1, 0.05) if closed else (1, 1, 1))

    for frame, left_z, right_z, left_rot, right_rot in [
        (1, 0.42, 0.42, 8, -8),
        (70, 0.44, 0.44, 0, 0),
        (120, 0.49, 0.49, -12, 12),
        (150, 0.37, 0.45, 16, -20),
        (FRAME_COUNT, 0.43, 0.43, 6, -6),
    ]:
        keyframe(face["brow_L"], frame, location=(-0.105, -0.34, left_z), rotation=(0, 0, math.radians(left_rot)))
        keyframe(face["brow_R"], frame, location=(0.105, -0.34, right_z), rotation=(0, 0, math.radians(right_rot)))

    for frame, expression in [
        (1, "neutral"),
        (55, "smile"),
        (105, "neutral"),
        (125, "surprised"),
        (142, "open"),
        (162, "frown"),
        (FRAME_COUNT, "smile" if prefix == "walker" else "neutral"),
    ]:
        set_mouth_expression(face, frame, expression)

    for obj in face.values():
        ease_animation(obj)


def animate_pair(left, right, frames, left_angles, right_angles):
    for frame, left_angle, right_angle in zip(frames, left_angles, right_angles):
        keyframe(left, frame, rotation=(0, math.radians(left_angle), 0))
        keyframe(right, frame, rotation=(0, math.radians(right_angle), 0))
    ease_animation(left)
    ease_animation(right)


def create_cutout_human(name, skin, shirt, pants, shoes, x, z=0, seated=False):
    root = empty(f"{name}_root_hips", (x, 0, z))

    torso = block(f"{name}_torso", (0.72, 0.22, 1.05), shirt, root, (0, 0, 1.35))
    block(f"{name}_neck", (0.2, 0.18, 0.18), skin, root, (0, 0, 1.95))
    head = empty(f"{name}_head_control", (0, 0, 2.12), root)
    local_sphere(f"{name}_head", 0.33, skin, head, (0, 0, 0.2), scale=(0.92, 0.78, 1.05))
    local_block(f"{name}_hair", (0.5, 0.12, 0.16), shoes, head, (0, -0.2, 0.48))

    left_shoulder = empty(f"{name}_upper_arm_L", (-0.48, 0, 1.82), root)
    right_shoulder = empty(f"{name}_upper_arm_R", (0.48, 0, 1.82), root)
    left_forearm = empty(f"{name}_lower_arm_L", (0, 0, -0.58), left_shoulder)
    right_forearm = empty(f"{name}_lower_arm_R", (0, 0, -0.58), right_shoulder)
    limb(f"{name}_upper_arm_L_mesh", 0.58, 0.09, skin, left_shoulder)
    limb(f"{name}_upper_arm_R_mesh", 0.58, 0.09, skin, right_shoulder)
    limb(f"{name}_lower_arm_L_mesh", 0.54, 0.08, skin, left_forearm)
    limb(f"{name}_lower_arm_R_mesh", 0.54, 0.08, skin, right_forearm)

    left_hip = empty(f"{name}_upper_leg_L", (-0.22, 0, 0.82), root)
    right_hip = empty(f"{name}_upper_leg_R", (0.22, 0, 0.82), root)
    left_shin = empty(f"{name}_lower_leg_L", (0, 0, -0.72), left_hip)
    right_shin = empty(f"{name}_lower_leg_R", (0, 0, -0.72), right_hip)
    limb(f"{name}_upper_leg_L_mesh", 0.72, 0.11, pants, left_hip)
    limb(f"{name}_upper_leg_R_mesh", 0.72, 0.11, pants, right_hip)
    limb(f"{name}_lower_leg_L_mesh", 0.66, 0.1, pants, left_shin)
    limb(f"{name}_lower_leg_R_mesh", 0.66, 0.1, pants, right_shin)
    block(f"{name}_foot_L", (0.36, 0.2, 0.12), shoes, left_shin, (-0.08, -0.02, -0.67))
    block(f"{name}_foot_R", (0.36, 0.2, 0.12), shoes, right_shin, (0.08, -0.02, -0.67))

    white_face = bpy.data.materials.get("face white") or toon_material("face white", (0.98, 0.98, 0.92, 1))
    black_face = bpy.data.materials.get("face black") or toon_material("face black", (0.02, 0.018, 0.016, 1))
    blush = bpy.data.materials.get("face blush") or toon_material("face blush", (1.0, 0.38, 0.42, 1))

    face = {
        "eye_L": local_sphere(f"{name}_eye_L", 0.075, white_face, head, (-0.105, -0.325, 0.26), scale=(1, 0.12, 0.72)),
        "eye_R": local_sphere(f"{name}_eye_R", 0.075, white_face, head, (0.105, -0.325, 0.26), scale=(1, 0.12, 0.72)),
        "pupil_L": local_sphere(f"{name}_pupil_L", 0.028, black_face, head, (-0.105, -0.328, 0.25), scale=(1, 0.08, 1)),
        "pupil_R": local_sphere(f"{name}_pupil_R", 0.028, black_face, head, (0.105, -0.328, 0.25), scale=(1, 0.08, 1)),
        "brow_L": local_block(f"{name}_brow_L", (0.15, 0.025, 0.025), black_face, head, (-0.105, -0.34, 0.42), rotation=(0, 0, math.radians(8))),
        "brow_R": local_block(f"{name}_brow_R", (0.15, 0.025, 0.025), black_face, head, (0.105, -0.34, 0.42), rotation=(0, 0, math.radians(-8))),
        "nose": local_sphere(f"{name}_nose", 0.032, blush, head, (0, -0.345, 0.12), scale=(0.55, 0.24, 1.0)),
        "mouth_open": local_sphere(f"{name}_mouth_open", 0.055, black_face, head, (0, -0.352, -0.055), scale=(0.75, 0.1, 1.15)),
        "mouth_surprised": local_sphere(f"{name}_mouth_surprised", 0.06, black_face, head, (0, -0.352, -0.05), scale=(0.7, 0.1, 1.45)),
    }
    face["mouth_neutral"] = mouth_curve(f"{name}_mouth_neutral", [(-0.09, -0.352, -0.04), (0.09, -0.352, -0.04)], black_face, head)
    face["mouth_smile"] = mouth_curve(f"{name}_mouth_smile", [(-0.105, -0.352, -0.05), (-0.04, -0.352, -0.095), (0.04, -0.352, -0.095), (0.105, -0.352, -0.05)], black_face, head)
    face["mouth_frown"] = mouth_curve(f"{name}_mouth_frown", [(-0.105, -0.352, -0.09), (-0.04, -0.352, -0.045), (0.04, -0.352, -0.045), (0.105, -0.352, -0.09)], black_face, head)

    parts = {
        "root": root,
        "torso": torso,
        "head": head,
        "left_shoulder": left_shoulder,
        "right_shoulder": right_shoulder,
        "left_forearm": left_forearm,
        "right_forearm": right_forearm,
        "left_hip": left_hip,
        "right_hip": right_hip,
        "left_shin": left_shin,
        "right_shin": right_shin,
        "face": face,
    }

    if seated:
        root.location.z = -0.15
        root.rotation_euler = (0, 0, math.radians(-4))
        left_hip.rotation_euler = (0, math.radians(-72), 0)
        right_hip.rotation_euler = (0, math.radians(-72), 0)
        left_shin.rotation_euler = (0, math.radians(78), 0)
        right_shin.rotation_euler = (0, math.radians(78), 0)
        left_shoulder.rotation_euler = (0, math.radians(48), 0)
        right_shoulder.rotation_euler = (0, math.radians(-48), 0)
        left_forearm.rotation_euler = (0, math.radians(-52), 0)
        right_forearm.rotation_euler = (0, math.radians(52), 0)

    return parts


def update_frame_counter(scene):
    counter = bpy.data.objects.get("FrameCounter")
    if counter:
        counter.data.body = f"FRAME {scene.frame_current:03d}"


def build_scene():
    clear_scene()
    FRAME_DIR.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = FRAME_COUNT
    scene.frame_set(1)
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
    scene.render.use_freestyle = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.color = (0.13, 0.14, 0.15)
    if hasattr(scene, "eevee"):
        for attr in ("taa_render_samples", "taa_samples"):
            if hasattr(scene.eevee, attr):
                setattr(scene.eevee, attr, 16)

    skin = toon_material("warm skin", (0.96, 0.64, 0.43, 1))
    skin_alt = toon_material("deep skin", (0.64, 0.36, 0.24, 1))
    coral = toon_material("coral shirt", (0.95, 0.22, 0.18, 1))
    teal = toon_material("teal shirt", (0.04, 0.58, 0.62, 1))
    navy = toon_material("navy pants", (0.04, 0.1, 0.25, 1))
    violet = toon_material("violet pants", (0.26, 0.18, 0.56, 1))
    charcoal = toon_material("charcoal", (0.035, 0.035, 0.04, 1))
    white = toon_material("soft white", (0.9, 0.92, 0.9, 1))
    floor_mat = toon_material("warm gray floor", (0.24, 0.25, 0.26, 1))
    screen_mat = toon_material("alert blue screen", (0.05, 0.28, 0.95, 1))
    alert_mat = toon_material("alert yellow", (1.0, 0.82, 0.05, 1))

    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.02))
    floor = bpy.context.object
    floor.name = "simple studio floor"
    floor.data.materials.append(floor_mat)

    block("desk_top", (2.6, 0.55, 0.16), charcoal, None, (2.1, 0, 0.98))
    block("desk_leg_left", (0.12, 0.16, 1.0), charcoal, None, (1.05, 0, 0.48))
    block("desk_leg_right", (0.12, 0.16, 1.0), charcoal, None, (3.15, 0, 0.48))
    block("laptop_base", (0.95, 0.48, 0.08), screen_mat, None, (2.1, -0.16, 1.12))
    screen = block("notification_screen", (1.05, 0.08, 0.68), screen_mat, None, (2.55, -0.42, 1.55))
    alert = add_text("AlertText", "!", (2.55, -0.51, 1.57), 0.55, alert_mat, rotation=(math.radians(90), 0, 0))
    keyframe(alert, 1, scale=(0.1, 0.1, 0.1))
    keyframe(alert, 112, scale=(0.1, 0.1, 0.1))
    keyframe(alert, 125, scale=(1.1, 1.1, 1.1))
    keyframe(alert, 210, scale=(1.1, 1.1, 1.1))
    ease_animation(alert)

    walker = create_cutout_human("walker", skin, coral, navy, charcoal, -3.75)
    coworker = create_cutout_human("coworker", skin_alt, teal, violet, charcoal, 2.15, seated=True)

    keyframe(walker["root"], 1, location=(-3.75, 0, 0), rotation=(0, 0, math.radians(2)))
    keyframe(walker["root"], 105, location=(-0.65, 0, 0), rotation=(0, 0, math.radians(2)))
    keyframe(walker["root"], 130, location=(-0.65, 0, 0), rotation=(0, 0, math.radians(-8)))
    keyframe(walker["root"], FRAME_COUNT, location=(-0.65, 0, 0), rotation=(0, 0, math.radians(-8)))
    ease_animation(walker["root"])
    for frame, angle in [(1, -10), (72, -4), (105, 0), (126, 10), (150, 8), (FRAME_COUNT, 4)]:
        keyframe(walker["head"], frame, rotation=(0, 0, math.radians(angle)))
    ease_animation(walker["head"])
    animate_face(walker["face"], "walker")

    walk_frames = [1, 16, 31, 46, 61, 76, 91, 105]
    animate_pair(walker["left_hip"], walker["right_hip"], walk_frames, [32, -32, 30, -30, 32, -32, 24, 0], [-32, 32, -30, 30, -32, 32, -24, 0])
    animate_pair(walker["left_shin"], walker["right_shin"], walk_frames, [-24, 30, -20, 28, -24, 30, -12, 0], [30, -24, 28, -20, 30, -24, 12, 0])
    animate_pair(walker["left_shoulder"], walker["right_shoulder"], walk_frames, [-28, 28, -26, 26, -28, 28, -12, 0], [28, -28, 26, -26, 28, -28, 12, 0])

    point_frames = [105, 130, 155, FRAME_COUNT]
    for frame, shoulder_angle, forearm_angle in [(105, 0, 0), (130, -78, -18), (155, -78, -18), (FRAME_COUNT, -35, -10)]:
        keyframe(walker["right_shoulder"], frame, rotation=(0, math.radians(shoulder_angle), 0))
        keyframe(walker["right_forearm"], frame, rotation=(0, math.radians(forearm_angle), 0))
    ease_animation(walker["right_shoulder"])
    ease_animation(walker["right_forearm"])

    for frame, angle in [(1, -52), (20, -34), (40, -52), (60, -34), (80, -52), (100, -34), (120, -52), (140, -34), (FRAME_COUNT, -46)]:
        keyframe(coworker["left_forearm"], frame, rotation=(0, math.radians(angle), 0))
        keyframe(coworker["right_forearm"], frame, rotation=(0, math.radians(-angle), 0))
    ease_animation(coworker["left_forearm"])
    ease_animation(coworker["right_forearm"])
    keyframe(coworker["root"], 1, rotation=(0, 0, math.radians(-4)))
    keyframe(coworker["root"], 125, rotation=(0, 0, math.radians(-4)))
    keyframe(coworker["root"], 150, rotation=(0, 0, math.radians(8)))
    keyframe(coworker["root"], FRAME_COUNT, rotation=(0, 0, math.radians(8)))
    ease_animation(coworker["root"])
    for frame, angle in [(1, -6), (80, -4), (125, -14), (145, -20), (FRAME_COUNT, -8)]:
        keyframe(coworker["head"], frame, rotation=(0, 0, math.radians(angle)))
    ease_animation(coworker["head"])
    animate_face(coworker["face"], "coworker")

    add_text("TitleText", "FACIAL CHARACTER\nBLENDER PROOF", (-1.65, -2.9, 3.45), 0.18, white)
    add_text("FrameCounter", "FRAME 001", (1.65, -2.9, 3.45), 0.18, white)

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.0, 5.8))
    light = bpy.context.object
    light.name = "ChangingStudioLight"
    light.data.size = 5.5
    light.data.energy = 450
    light.data.keyframe_insert(data_path="energy", frame=1)
    scene.frame_set(FRAME_COUNT)
    light.data.energy = 1200
    light.data.keyframe_insert(data_path="energy", frame=FRAME_COUNT)

    bpy.ops.object.camera_add(location=(-0.25, -10.0, 1.85), rotation=(math.radians(90), 0, 0))
    camera = bpy.context.object
    scene.camera = camera
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 6.15
    camera.data.keyframe_insert(data_path="ortho_scale", frame=1)
    scene.frame_set(125)
    camera.data.ortho_scale = 4.45
    camera.data.keyframe_insert(data_path="ortho_scale", frame=125)
    scene.frame_set(FRAME_COUNT)
    camera.data.ortho_scale = 4.8
    camera.data.keyframe_insert(data_path="ortho_scale", frame=FRAME_COUNT)
    for frame, loc in [(1, (-0.45, -10.0, 1.85)), (110, (0.15, -9.8, 1.95)), (145, (0.45, -9.65, 2.02)), (FRAME_COUNT, (0.25, -9.6, 2.0))]:
        camera.location = loc
        camera.rotation_euler = (math.radians(90), 0, 0)
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
    ease_animation(camera)

    bpy.app.handlers.frame_change_pre.clear()
    bpy.app.handlers.frame_change_pre.append(update_frame_counter)


build_scene()
bpy.ops.render.render(animation=True)
