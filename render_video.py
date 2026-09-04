"""Render the 5-min tutorial via video_compose -> Remotion (720p, narration embedded)."""
import json
import os
import sys

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))  # project root
assert os.path.isdir(os.path.join(BASE, "tools")), f"BASE resolution wrong: {BASE}"
sys.path.insert(0, BASE)

from tools.tool_registry import registry  # noqa: E402

PROJ = os.path.join(BASE, "projects", "youtube-title-examples-2026")

storyboard = json.load(open(os.path.join(PROJ, "storyboard.json"), encoding="utf-8"))

registry.discover()
tool = registry._tools["video_compose"]
res = tool.execute({
    "operation": "remotion_render",
    "composition_data": storyboard,
    "output_path": os.path.join(PROJ, "renders", "remotion_base.mp4"),
    "profile": "youtube_hd_720",
    "remotion_timeout_ms": 7200000,
})
print(json.dumps({"success": res.success, "data": res.data, "error": res.error}, indent=2))
sys.exit(0 if res.success else 1)