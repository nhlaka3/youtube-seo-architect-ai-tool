"""WSL-native Remotion render for youtube-title-examples-2026 (long-running).

Streams progress to render.log so frame counts can be tailed live. No short
subprocess cap — the harness background task is the lifecycle.
"""
import json
import os
import subprocess
import sys

BASE = os.path.join(os.path.expanduser("~"), "OpenMontage")
sys.path.insert(0, BASE)

from tools.video.video_compose import VideoCompose  # noqa: E402

PROJ = os.path.join(BASE, "projects", "youtube-title-examples-2026")
COMPOSER = os.path.join(BASE, "remotion-composer")
OUT = os.path.join(PROJ, "renders", "remotion_base.mp4")
PROPS = os.path.join(PROJ, ".remotion_props.json")
LOG = os.path.join(PROJ, "render.log")

storyboard = json.load(open(os.path.join(PROJ, "storyboard.json"), encoding="utf-8"))

vc = VideoCompose()
props = json.loads(json.dumps(storyboard))
theme = vc._build_theme_from_playbook(
    props.get("playbook") or props.get("theme") or "flat-motion-graphics",
    storyboard,
)
if theme:
    props["themeConfig"] = theme
with open(PROPS, "w", encoding="utf-8") as f:
    json.dump(props, f)

node = os.path.expanduser("~/.nvm/versions/node")
env = dict(os.environ)
if os.path.isdir(node):
    newest = sorted(os.listdir(node))[-1]
    env["PATH"] = os.path.join(node, newest, "bin") + os.pathsep + env.get("PATH", "")

cmd = [
    "npx", "remotion", "render",
    os.path.join(COMPOSER, "src", "index.tsx"),
    "Explainer",
    OUT,
    f"--props={PROPS}",
    "--width=1280", "--height=720",
    "--concurrency=4",
    "--log=info",
]
print("RUNNING:", " ".join(cmd[:5]) + " ...", flush=True)
with open(LOG, "w", encoding="utf-8") as log:
    res = subprocess.run(cmd, cwd=COMPOSER, env=env, stdout=log, stderr=subprocess.STDOUT,
                         text=True, timeout=10800)
print("exit:", res.returncode, flush=True)
if os.path.exists(OUT):
    print("RENDER_OK", OUT, os.path.getsize(OUT), "bytes", flush=True)
else:
    print("OUTPUT MISSING (exit", res.returncode, ")", flush=True)
    sys.exit(2)
