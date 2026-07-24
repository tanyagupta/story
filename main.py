#!/usr/bin/env python3

import argparse
import subprocess
import sys


def run(command):
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, check=True)


def main():
    parser = argparse.ArgumentParser(description="Storyboard video render entrypoint")
    parser.add_argument("--diagnostic", action="store_true", help="render and verify diagnostic animation/audio MP4")
    parser.add_argument("--preview", action="store_true", help="render and verify storyboard preview MP4")
    args = parser.parse_args()

    if args.diagnostic:
        run(["node", "scripts/render-diagnostic.js"])
        run(["node", "scripts/verify-media.js", "output/diagnostic_animation_audio.mp4", "--diagnostic", "--prefix", "diagnostic"])
        return

    if args.preview:
        run(["npm", "run", "demo:preview"])
        run(["node", "scripts/verify-media.js", "output/storyboard_preview.mp4", "--prefix", "preview"])
        return

    run(["npm", "run", "demo:render"])
    run(["node", "scripts/verify-media.js", "output/storyboard_video.mp4", "--prefix", "storyboard"])


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode)
