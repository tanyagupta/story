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


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.18
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
    capsule(f"{name}_head", 0.33, skin, root, (0, 0, 2.32))
    block(f"{name}_hair", (0.48, 0.24, 0.14), shoes, root, (0, -0.02, 2.57))

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

    parts = {
        "root": root,
        "torso": torso,
        "left_shoulder": left_shoulder,
        "right_shoulder": right_shoulder,
        "left_forearm": left_forearm,
        "right_forearm": right_forearm,
        "left_hip": left_hip,
        "right_hip": right_hip,
        "left_shin": left_shin,
        "right_shin": right_shin,
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
    if hasattr(scene, "eevee"):
        for attr in ("taa_render_samples", "taa_samples"):
            if hasattr(scene.eevee, attr):
                setattr(scene.eevee, attr, 16)

    skin = material("warm skin", (0.95, 0.62, 0.42, 1))
    skin_alt = material("deep skin", (0.62, 0.35, 0.24, 1))
    coral = material("coral shirt", (0.95, 0.18, 0.16, 1))
    teal = material("teal shirt", (0.05, 0.55, 0.62, 1))
    navy = material("navy pants", (0.05, 0.1, 0.24, 1))
    violet = material("violet pants", (0.22, 0.15, 0.52, 1))
    charcoal = material("charcoal", (0.05, 0.05, 0.06, 1))
    white = material("soft white", (0.9, 0.92, 0.9, 1))
    floor_mat = material("warm gray floor", (0.24, 0.25, 0.26, 1))
    screen_mat = material("alert blue screen", (0.05, 0.22, 0.95, 1))
    alert_mat = material("alert yellow", (1.0, 0.78, 0.05, 1))

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

    add_text("TitleText", "ARTICULATED HUMAN\nBLENDER PROOF", (-1.65, -2.9, 3.45), 0.18, white)
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
    camera.data.ortho_scale = 6.4
    camera.data.keyframe_insert(data_path="ortho_scale", frame=1)
    scene.frame_set(FRAME_COUNT)
    camera.data.ortho_scale = 5.85
    camera.data.keyframe_insert(data_path="ortho_scale", frame=FRAME_COUNT)
    for frame, loc in [(1, (-0.3, -10.0, 1.85)), (110, (0.0, -9.8, 1.9)), (FRAME_COUNT, (0.3, -9.6, 1.95))]:
        camera.location = loc
        camera.rotation_euler = (math.radians(90), 0, 0)
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
    ease_animation(camera)

    bpy.app.handlers.frame_change_pre.clear()
    bpy.app.handlers.frame_change_pre.append(update_frame_counter)


build_scene()
bpy.ops.render.render(animation=True)
