import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


FRAME_DIR = Path(os.environ["BLENDER_PROOF_FRAME_DIR"])
FPS = int(os.environ.get("BLENDER_PROOF_FPS", "30"))
DURATION_SECONDS = float(os.environ.get("BLENDER_PROOF_SECONDS", "5"))
FRAME_COUNT = int(FPS * DURATION_SECONDS)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    return mat


def add_text(name, text, location, size, mat, rotation=(0, 0, 0), parent=None):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    if "\n" in text and hasattr(obj.data, "space_line"):
        obj.data.space_line = 0.78
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def set_keyframe(obj, frame, location=None, rotation=None, scale=None):
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


def linear_interpolation(obj):
    if not obj.animation_data or not obj.animation_data.action:
        return
    for curve in obj.animation_data.action.fcurves:
        for keyframe in curve.keyframe_points:
            keyframe.interpolation = "LINEAR"


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

    red = material("large red cube", (1, 0.02, 0.02, 1))
    blue = material("bouncing blue sphere", (0.02, 0.2, 1, 1))
    white = material("white text", (1, 1, 1, 1))
    gray = material("matte floor", (0.18, 0.18, 0.2, 1))

    bpy.ops.mesh.primitive_plane_add(size=16, location=(0, 0, -1.2))
    floor = bpy.context.object
    floor.name = "matte floor"
    floor.data.materials.append(gray)

    bpy.ops.mesh.primitive_cube_add(size=1.8, location=(-5.2, 0, 0))
    cube = bpy.context.object
    cube.name = "RedCubeFarLeftToRight"
    cube.data.materials.append(red)
    set_keyframe(cube, 1, location=(-5.2, 0, 0), rotation=(0, 0, 0), scale=(0.5, 0.5, 0.5))
    set_keyframe(cube, FRAME_COUNT, location=(5.2, 0, 0), rotation=(0, 0, math.radians(720)), scale=(2, 2, 2))
    linear_interpolation(cube)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.65, location=(-2.8, -2.2, 0.1))
    sphere = bpy.context.object
    sphere.name = "BlueBouncingSphere"
    sphere.data.materials.append(blue)
    for frame, x, z in [
        (1, -3.2, 0.1),
        (38, -1.6, 2.4),
        (75, 0, 0.1),
        (113, 1.6, 2.2),
        (FRAME_COUNT, 3.2, 0.1),
    ]:
        set_keyframe(sphere, frame, location=(x, -2.2, z))
    linear_interpolation(sphere)

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.5, 5.5))
    light = bpy.context.object
    light.name = "ChangingAreaLight"
    light.data.energy = 350
    light.data.size = 5
    light.data.keyframe_insert(data_path="energy", frame=1)
    scene.frame_set(FRAME_COUNT)
    light.data.energy = 1100
    light.data.keyframe_insert(data_path="energy", frame=FRAME_COUNT)
    linear_interpolation(light)

    bpy.ops.object.camera_add(location=(0, -8.5, 4.1), rotation=(math.radians(62), 0, 0))
    camera = bpy.context.object
    scene.camera = camera
    target = Vector((0, 0, 0.35))
    radius = 8.5
    for frame, degrees in [(1, -25), (FRAME_COUNT, 25)]:
        radians = math.radians(degrees)
        camera.location = (math.sin(radians) * radius, -math.cos(radians) * radius, 4.1)
        direction = target - camera.location
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
    linear_interpolation(camera)

    add_text(
        "TitleText",
        "BLENDER VERSION\nACTIVE",
        (0, -2.85, 2.55),
        0.35,
        white,
        rotation=(math.radians(90), 0, 0),
    )
    add_text(
        "FrameCounter",
        "FRAME 001",
        (0, -2.85, 1.92),
        0.24,
        white,
        rotation=(math.radians(90), 0, 0),
    )

    bpy.app.handlers.frame_change_pre.clear()
    bpy.app.handlers.frame_change_pre.append(update_frame_counter)


build_scene()
bpy.ops.render.render(animation=True)
