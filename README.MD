# Storyboard to Video

A Node.js CLI that turns JSON storyboards into H.264/AAC MP4 videos with FFmpeg. It supports the original simple shape-based storyboard format plus animated layered scenes, transitions, narration, music, ambience, and sound effects.

The renderer creates cinematic motion from still assets: pans, zooms, slides, fades, typewriter captions, parallax, independent layer movement, and audio mixing. It does not claim to create true character articulation from a single flat image; use separate transparent PNG layers when you need independently moving subjects or foreground objects.

## Install

```bash
npm install
```

## Quick Start

Run the Blender human-figure proof. This uses Node.js as the orchestrator,
Blender Python with `bpy` for articulated 2.5D cut-out human animation, and
FFmpeg for muxing the rendered PNG sequence with locally generated audio:

```bash
npm run blender:proof
```

The same render can also be started with:

```bash
npm run human:proof
```

The runner uses `blender` from `PATH` when available, otherwise it uses:

```text
/Applications/Blender.app/Contents/MacOS/Blender
```

It writes:

```text
output/human-figure-proof.mp4
output/human-figure-proof_frame_start.png
output/human-figure-proof_frame_middle.png
output/human-figure-proof_frame_end.png
```

Run the diagnostic animation/audio proof first:

```bash
python3 main.py --diagnostic
```

That writes and verifies:

```text
output/diagnostic_animation_audio.mp4
output/diagnostic_frame_start.png
output/diagnostic_frame_middle.png
output/diagnostic_frame_end.png
```

Render the original simple storyboard:

```bash
npm run sample:render
```

Render the animated three-scene Prometheus demo:

```bash
python3 main.py --preview
python3 main.py
```

The animated demo writes:

```text
output/storyboard_preview.mp4
output/storyboard_video.mp4
```

The demo assets in `assets/demo` are programmatically generated placeholders. Regenerate them at any time with:

```bash
npm run demo:assets
```

## Render Your Own Storyboard

```bash
npm run render -- path/to/storyboard.json
npm run render -- path/to/storyboard.json --preview
npm run render -- path/to/storyboard.json --out output/custom.mp4
```

Default output paths are deterministic:

```text
output/storyboard_preview.mp4
output/storyboard_video.mp4
```

## Layered Storyboards

Layered scenes use independently positioned PNG assets, z-index ordering, optional parallax/depth, and animation settings:

```json
{
  "title": "Animated storyboard example",
  "resolution": [1920, 1080],
  "fps": 30,
  "background_music": {
    "file": "assets/audio/music.wav",
    "volume": 0.18,
    "loop": true,
    "fade_in": 1.5,
    "fade_out": 2,
    "duck_under_narration": true,
    "duck_volume": 0.06
  },
  "scenes": [
    {
      "duration": 6,
      "transition": {
        "type": "crossfade",
        "duration": 0.6
      },
      "layers": [
        {
          "file": "assets/scenes/background.png",
          "z_index": 0,
          "position": [0, 0],
          "animation": {
            "type": "slow_zoom_in",
            "start_scale": 1,
            "end_scale": 1.08,
            "easing": "ease_in_out"
          }
        },
        {
          "file": "assets/scenes/person.png",
          "z_index": 10,
          "position": [900, 300],
          "animation": {
            "type": "slide_in",
            "from": "right",
            "start": 0.2,
            "duration": 1
          }
        }
      ],
      "caption": {
        "text": "Something has gone wrong.",
        "start": 1,
        "duration": 3.5,
        "animation": "progressive"
      },
      "narration": {
        "file": "assets/audio/scene1-narration.wav",
        "start": 0.4,
        "volume": 1
      },
      "sound_effects": [
        {
          "file": "assets/audio/error.wav",
          "start": 1.2,
          "volume": 0.7
        }
      ]
    }
  ]
}
```

Supported scene transitions are `cut`, `fade`, `crossfade`, `slide`, and `dip_to_black`.

Supported animation presets are `none`, `slow_zoom_in`, `slow_zoom_out`, `pan_left`, `pan_right`, `pan_up`, `pan_down`, `fade_in`, `fade_out`, `slide_in`, `slide_out`, and `custom`. Animations use keyframe-style interpolation with `linear`, `ease_in`, `ease_out`, and `ease_in_out` easing. You can configure start/end position, scale, and opacity.

Audio items support WAV, MP3, M4A, and AAC through FFmpeg. Each item can define `file`, `start` or `offset`, `volume`, `fade_in`, `fade_out`, `loop`, `trim_start`, `trim_duration`, and `delay`. Background music can duck under narration with `duck_under_narration` and `duck_volume`; the final mix uses normalization and limiting to reduce clipping risk.

## Optional Local TTS

The project never calls cloud text-to-speech services. TTS is disabled by default. A local provider interface exists for `macos_say`:

```json
{
  "tts": {
    "enabled": true,
    "provider": "macos_say",
    "voice": "Samantha",
    "rate": 170,
    "cache_dir": ".cache/tts"
  }
}
```

Locally available voices differ by operating system. If TTS is disabled, provide narration audio files instead.

## Legacy Format

The earlier shape-based format still works:

```json
{
  "settings": {
    "width": 1280,
    "height": 720,
    "fps": 30,
    "defaultDuration": 3
  },
  "scenes": [
    {
      "title": "Open on dashboard",
      "duration": 3,
      "background": "#16324f",
      "narration": "A calm overview of the dashboard.",
      "shapes": [
        {
          "type": "rect",
          "x": 96,
          "y": 110,
          "width": 420,
          "height": 280,
          "color": "#f6f7f9"
        },
        {
          "type": "text",
          "x": 128,
          "y": 160,
          "text": "Launch metrics",
          "size": 44,
          "color": "#102033"
        }
      ]
    }
  ]
}
```

## Commands

```bash
npm test
npm run blender:proof
npm run diagnostic
npm run sample:render
npm run demo:preview
npm run demo:render
python3 main.py --diagnostic
python3 main.py --preview
python3 main.py
npm run render -- examples/animated-prometheus.storyboard.json --out output/custom.mp4
```
