#!/usr/bin/env python3
"""Local Faster-Whisper sidecar for YT Shorts Studio.

Emits a single JSON object on stdout and progress lines on stderr:
  PROGRESS 0.42
  PROGRESS 0.061 Downloading model 42%

No audio is sent anywhere. Models are read from (or downloaded into) the
local model directory passed by the application.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path


def emit_progress(value: float, stage: str | None = None) -> None:
    line = f"PROGRESS {max(0.0, min(1.0, value)):.4f}"
    if stage:
        line = f"{line} {stage}"
    print(line, file=sys.stderr, flush=True)


def normal_path(value: str | Path) -> str:
    """Strip Windows extended-length prefixes ctranslate2 cannot open."""
    text = str(value)
    unc_prefix = "\\\\?\\UNC\\"
    win_prefix = "\\\\?\\"
    if text.startswith(unc_prefix):
        return "\\\\" + text[len(unc_prefix):]
    if text.startswith(win_prefix):
        return text[len(win_prefix):]
    return text


class DownloadProgress:
    """Tqdm-compatible callback that reports Hugging Face download bytes.

    Faster-Whisper's own helper hardcodes a disabled progress bar, so the
    snapshot is created here with this callback instead. Only byte
    reconstruction bars for sizeable files are reported; the transfer bar
    would double count with Xet downloads and tiny config files would make the
    percentage jump to 100% before the real model weights start.
    """

    MIN_REPORT_BYTES = 1024 * 1024
    MAX_FRACTION = 0.12
    total_bytes = 0.0
    done_bytes = 0.0
    last_percent = -1

    def __init__(self, **kwargs):
        desc = str(kwargs.get("desc", ""))
        self._report = desc.startswith("Reconstructing")
        self._counted_total = 0.0
        self._total = 0.0
        self.n = float(kwargs.get("initial") or 0)
        # huggingface_hub's Xet reporter reads this when formatting speeds.
        self.format_dict = {"rate": None}
        if self._report:
            self.total = kwargs.get("total") or 0

    @property
    def total(self) -> float:
        return self._total

    @total.setter
    def total(self, value) -> None:
        new_total = float(value or 0)
        if self._report and new_total >= DownloadProgress.MIN_REPORT_BYTES:
            DownloadProgress.total_bytes += new_total - self._counted_total
            self._counted_total = new_total
            self._emit(0)
        self._total = new_total

    def _emit(self, percent: int) -> None:
        if percent == DownloadProgress.last_percent:
            return
        DownloadProgress.last_percent = percent
        fraction = 0.02 + (DownloadProgress.MAX_FRACTION - 0.02) * (percent / 100.0)
        emit_progress(fraction, f"Downloading model {percent}%")

    def update(self, n: float | None = 1) -> None:
        if not self._report or self._counted_total <= 0:
            return
        increment = float(n or 0)
        DownloadProgress.done_bytes += increment
        if DownloadProgress.total_bytes > 0:
            percent = max(0, min(100, int(DownloadProgress.done_bytes * 100 / DownloadProgress.total_bytes)))
            self._emit(percent)

    def refresh(self) -> None:
        pass

    def set_description(self, *args, **kwargs) -> None:
        pass

    def set_description_str(self, *args, **kwargs) -> None:
        pass

    def set_postfix_str(self, *args, **kwargs) -> None:
        pass

    def close(self) -> None:
        pass

    def __enter__(self) -> "DownloadProgress":
        return self

    def __exit__(self, *args) -> None:
        pass


ALLOWED_MODEL_FILES = [
    "config.json",
    "preprocessor_config.json",
    "model.bin",
    "tokenizer.json",
    "vocabulary.*",
]


def model_repository(model: str) -> str:
    if "/" in model:
        return model
    from faster_whisper.utils import _MODELS

    repository = _MODELS.get(model)
    if repository is None:
        raise ValueError(f"Unknown Whisper model: {model}")
    return repository


def download_model_files(model: str, model_dir: str | None) -> str:
    local = Path(normal_path(model))
    if local.is_dir():
        return str(local.resolve())
    from huggingface_hub import snapshot_download

    snapshot = snapshot_download(
        model_repository(model),
        cache_dir=normal_path(model_dir) if model_dir else None,
        allow_patterns=ALLOWED_MODEL_FILES,
        tqdm_class=DownloadProgress,
    )
    return normal_path(snapshot)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transcribe media with Faster-Whisper")
    parser.add_argument("--audio", help="Path to a local audio/video file")
    parser.add_argument("--model", default="small", help="Faster-Whisper model name or local path")
    parser.add_argument("--model-dir", help="Local directory used for model storage")
    parser.add_argument("--language", default="", help="Optional language code, e.g. en")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda", "auto"])
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--download-only", action="store_true", help="Download the model and exit")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if args.download_only:
        DownloadProgress.MAX_FRACTION = 0.98

    if not args.download_only:
        source = Path(normal_path(args.audio or ""))
        if not source.is_file():
            print(json.dumps({"error": f"Media file not found: {source}"}), file=sys.stderr)
            return 2

    emit_progress(0.01, "Preparing")
    try:
        model_path = download_model_files(args.model, args.model_dir)
    except Exception as error:
        print(json.dumps({"error": "Could not download the Whisper model.", "detail": str(error)}), file=sys.stderr)
        return 4

    if args.download_only:
        emit_progress(1.0, "Download complete")
        print(
            json.dumps({"downloaded": True, "model": args.model, "path": str(model_path)}),
            flush=True,
        )
        return 0

    emit_progress(0.12, "Loading model")
    try:
        from faster_whisper import WhisperModel
    except Exception as error:  # pragma: no cover - depends on local install
        print(
            json.dumps(
                {
                    "error": "Faster-Whisper is not installed in the sidecar environment.",
                    "detail": str(error),
                }
            ),
            file=sys.stderr,
        )
        return 3

    try:
        model = WhisperModel(
            normal_path(model_path), device=args.device, compute_type=args.compute_type
        )
    except Exception as error:
        print(json.dumps({"error": "Could not load the Whisper model.", "detail": str(error)}), file=sys.stderr)
        return 5

    emit_progress(0.14, "Transcribing")
    try:
        segments, info = model.transcribe(
            str(source),
            language=args.language or None,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 250},
        )
    except Exception as error:
        print(json.dumps({"error": "Transcription failed.", "detail": str(error)}), file=sys.stderr)
        return 6

    duration = float(getattr(info, "duration", 0.0) or 0.0)
    words: list[dict[str, object]] = []
    reported = -1
    for segment in segments:
        for word in segment.words or []:
            # Faster-Whisper 1.2 renamed Word.text to Word.word.
            text = (getattr(word, "word", None) or getattr(word, "text", "") or "").strip()
            if not text:
                continue
            words.append(
                {
                    "text": text,
                    "startMs": int(round(float(word.start) * 1000)),
                    "endMs": int(round(float(word.end) * 1000)),
                }
            )
        if duration > 0:
            percent = max(0, min(100, int((0.14 + 0.84 * min(1.0, float(segment.end) / duration)) * 100)))
            if percent != reported:
                reported = percent
                emit_progress(percent / 100.0, "Transcribing")

    emit_progress(1.0, "Complete")
    print(
        json.dumps(
            {
                "language": getattr(info, "language", "") or "",
                "durationMs": int(round(duration * 1000)),
                "words": words,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
