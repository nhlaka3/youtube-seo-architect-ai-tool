"""Kokoro local neural text-to-speech provider tool (free, ONNX, CPU).

Provides expressive offline narration via the `kokoro-onnx` package, using
bundled voices such as `am_michael` (English male). No API key; the model +
voices bundle (~330 MB) is cached under `.model-cache/kokoro/` and
auto-downloaded on first use from the kokoro-onnx GitHub release
`model-files-v1.0`.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import numpy as np

from tools.base_tool import (
    BaseTool,
    Determinism,
    ExecutionMode,
    ResourceProfile,
    RetryPolicy,
    ToolResult,
    ToolRuntime,
    ToolStability,
    ToolStatus,
    ToolTier,
)

MODEL_CACHE = Path(__file__).resolve().parent.parent.parent / ".model-cache" / "kokoro"
MODEL_FILE = MODEL_CACHE / "kokoro-v1.0.onnx"
VOICES_FILE = MODEL_CACHE / "voices-v1.0.bin"
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"


class KokoroTTS(BaseTool):
    name = "kokoro_tts"
    version = "0.1.0"
    tier = ToolTier.VOICE
    capability = "tts"
    provider = "kokoro"
    stability = ToolStability.EXPERIMENTAL
    execution_mode = ExecutionMode.SYNC
    determinism = Determinism.DETERMINISTIC
    runtime = ToolRuntime.LOCAL

    dependencies = ["python:kokoro_onnx"]
    install_instructions = (
        "Install Kokoro TTS:\n"
        "  pip install kokoro-onnx\n"
        "The model + voices auto-download on first run to .model-cache/kokoro/ "
        "(kokoro-v1.0.onnx + voices-v1.0.bin) from the kokoro-onnx GitHub release "
        "model-files-v1.0. No API key required."
    )
    agent_skills = ["text-to-speech"]

    capabilities = [
        "text_to_speech",
        "offline_generation",
    ]
    supports = {
        "voice_cloning": False,
        "multilingual": True,
        "offline": True,
        "native_audio": True,
    }
    best_for = [
        "free high-quality offline narration without API keys",
        "expressive default voices (am_michael, af_bella, ...)",
    ]
    not_good_for = [
        "voice cloning / custom timbre matching",
        "multilingual phonemization outside the supported language set",
    ]

    input_schema = {
        "type": "object",
        "required": ["text"],
        "properties": {
            "text": {"type": "string"},
            "voice": {"type": "string", "default": "am_michael"},
            "speed": {"type": "number", "default": 1.0},
            "lang": {"type": "string", "default": "en-us"},
            "output_path": {"type": "string"},
        },
    }

    resource_profile = ResourceProfile(
        cpu_cores=2, ram_mb=1024, vram_mb=0, disk_mb=400, network_required=False
    )
    retry_policy = RetryPolicy(max_retries=1, retryable_errors=[])
    idempotency_key_fields = ["text", "voice", "speed", "lang"]
    side_effects = ["writes audio file to output_path"]
    user_visible_verification = ["Listen to generated audio for intelligibility"]

    def get_status(self) -> ToolStatus:
        try:
            import kokoro_onnx  # noqa: F401
        except ImportError:
            return ToolStatus.UNAVAILABLE
        if not MODEL_FILE.exists() or not VOICES_FILE.exists():
            return ToolStatus.UNAVAILABLE
        return ToolStatus.AVAILABLE

    def estimate_cost(self, inputs: dict[str, Any]) -> float:
        return 0.0

    def execute(self, inputs: dict[str, Any]) -> ToolResult:
        if self.get_status() != ToolStatus.AVAILABLE:
            return ToolResult(
                success=False,
                error="Kokoro TTS not available. " + self.install_instructions,
            )

        start = time.time()
        try:
            result = self._generate(inputs)
        except Exception as exc:
            return ToolResult(success=False, error=f"Kokoro generation failed: {exc}")

        result.duration_seconds = round(time.time() - start, 2)
        return result

    def _generate(self, inputs: dict[str, Any]) -> ToolResult:
        output_path = Path(inputs.get("output_path", "kokoro_output.wav"))
        output_path.parent.mkdir(parents=True, exist_ok=True)

        from kokoro_onnx import Kokoro

        kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))
        samples, sample_rate = kokoro.create(
            text=inputs["text"],
            voice=inputs.get("voice", "am_michael"),
            speed=float(inputs.get("speed", 1.0)),
            lang=inputs.get("lang", "en-us"),
        )

        pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
        self._write_wav(output_path, pcm, int(sample_rate))

        if not output_path.exists():
            return ToolResult(success=False, error=f"Kokoro output file missing: {output_path}")

        return ToolResult(
            success=True,
            data={
                "provider": self.provider,
                "voice": inputs.get("voice", "am_michael"),
                "speed": inputs.get("speed", 1.0),
                "text_length": len(inputs["text"]),
                "output": str(output_path),
                "format": "wav",
                "sample_rate": sample_rate,
            },
            artifacts=[str(output_path)],
            model=inputs.get("voice", "am_michael"),
        )

    @staticmethod
    def _write_wav(path: Path, pcm: np.ndarray, sample_rate: int) -> None:
        import wave

        with wave.open(str(path), "wb") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(sample_rate)
            f.writeframes(pcm.tobytes())