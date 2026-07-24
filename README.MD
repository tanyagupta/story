# Storyboard to Video

A small Node.js CLI that turns a JSON storyboard into an MP4 video. It uses a bundled FFmpeg binary, so no system FFmpeg install is required.

## Install

```bash
npm install
```

## Render the sample

```bash
npm run sample:render
```

The sample output is written to `renders/sample.mp4`.

## Render your own storyboard

```bash
npm run render -- path/to/storyboard.json --out renders/my-video.mp4
```

Storyboard files contain project settings and an ordered list of scenes:

```json
{
  "title": "Product walkthrough",
  "settings": {
    "width": 1280,
    "height": 720,
    "fps": 30,
    "defaultDuration": 3
  },
  "scenes": [
    {
      "id": "intro",
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

Supported shape types are `rect`, `text`, and `caption`. Captions are text blocks styled with a translucent backing box.

## Commands

```bash
npm test
npm run sample:render
npm run render -- examples/product-launch.storyboard.json --out renders/product-launch.mp4
```
