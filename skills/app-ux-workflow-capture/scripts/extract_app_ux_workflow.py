#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("Missing dependency: Pillow. Install it with `python -m pip install pillow`.") from exc


DEFAULT_SAMPLE_RATE = 4.0
DEFAULT_SECOND_PASS_RATE = 12.0
MIN_STATE_SECONDS = 0.70
SECOND_PASS_MIN_STATE_SECONDS = 0.45
VISUAL_SPLIT_THRESHOLD = 4.5
VISUAL_DUPLICATE_THRESHOLD = 2.5
BILINEAR = getattr(getattr(Image, "Resampling", Image), "BILINEAR")
LANCZOS = getattr(getattr(Image, "Resampling", Image), "LANCZOS")


@dataclass
class VideoInfo:
    duration: float
    width: int
    height: int
    backend: str


@dataclass
class FrameInfo:
    time: float
    path: Path
    fp: list[int]
    text_lines: list[str] = field(default_factory=list)
    key: str = ""


@dataclass
class Segment:
    start_time: float
    end_time: float
    frames: list[FrameInfo]
    source: str = "first-pass"

    @property
    def duration(self) -> float:
        return max(0.0, self.end_time - self.start_time)

    @property
    def representative(self) -> FrameInfo:
        return self.frames[len(self.frames) // 2]


@dataclass
class ReviewState:
    start_time: float
    end_time: float
    state: str
    reason: str
    first_pass: str
    second_pass: str = ""
    output_action: str = ""
    review: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract chronological app UX screens from walkthrough videos.")
    parser.add_argument("videos", nargs="+", type=Path, help="Video file(s) to process.")
    parser.add_argument("--output", type=Path, help="Output directory. Defaults to ./outputs/app-ux-workflow-capture when appropriate.")
    parser.add_argument("--context", default="", help="User-provided context to include in Markdown.")
    parser.add_argument("--sample-rate", type=float, default=DEFAULT_SAMPLE_RATE, help="Initial sampling rate in frames per second.")
    parser.add_argument("--second-pass-rate", type=float, default=DEFAULT_SECOND_PASS_RATE, help="Sampling rate for flagged ranges.")
    parser.add_argument("--debug", action="store_true", help="Keep sampled frames and intermediate artifacts for troubleshooting.")
    return parser.parse_args()


def slugify(value: str, fallback: str = "screen") -> str:
    value = value.lower().replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return (value[:64].strip("-") or fallback)


def format_time(seconds: float) -> str:
    minutes = int(seconds // 60)
    secs = seconds - minutes * 60
    return f"{minutes}:{secs:04.1f}"


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)


def find_tool(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    for candidate in (Path("/opt/homebrew/bin") / name, Path("/usr/local/bin") / name):
        if candidate.is_file():
            return str(candidate)
    return None


def require_video(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"Video not found: {path}")
    try:
        with resolved.open("rb") as file:
            file.read(1)
    except PermissionError as exc:
        raise PermissionError(
            f"Video is not readable from this session: {resolved}. "
            "Move it into the current project/workspace or grant file access, then rerun."
        ) from exc
    return resolved


def default_output_root() -> Path:
    cwd = Path.cwd()
    if (cwd / "outputs").exists() or cwd != Path.home():
        return cwd / "outputs" / "app-ux-workflow-capture"
    return cwd / "app-ux-workflow-capture"


def unique_dir(root: Path, base_name: str) -> Path:
    candidate = root / slugify(base_name, "video")
    if not candidate.exists():
        return candidate
    for idx in range(2, 1000):
        suffixed = root / f"{candidate.name}-{idx}"
        if not suffixed.exists():
            return suffixed
    raise RuntimeError(f"Unable to choose unique output folder under {root}")


def probe_with_ffprobe(video: Path) -> VideoInfo | None:
    ffprobe = find_tool("ffprobe")
    if not ffprobe:
        return None
    result = run(
        [
            ffprobe,
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_entries",
            "format=duration:stream=width,height,codec_type",
            str(video),
        ]
    )
    if result.returncode != 0:
        if "Operation not permitted" in result.stdout:
            raise PermissionError(
                f"ffprobe cannot read {video}: Operation not permitted. "
                "Move the video into the current project/workspace or grant file access, then rerun."
            )
        return None
    data = json.loads(result.stdout)
    duration = float(data.get("format", {}).get("duration") or 0)
    stream = next((item for item in data.get("streams", []) if item.get("codec_type") == "video"), {})
    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)
    if duration <= 0 or width <= 0 or height <= 0:
        return None
    return VideoInfo(duration=duration, width=width, height=height, backend="ffmpeg")


def probe_with_avfoundation(video: Path) -> VideoInfo | None:
    if platform.system() != "Darwin":
        return None
    try:
        from AVFoundation import AVURLAsset
        from CoreMedia import CMTimeGetSeconds
        from Foundation import NSURL
    except Exception:
        return None
    asset = AVURLAsset.URLAssetWithURL_options_(NSURL.fileURLWithPath_(str(video)), None)
    duration = float(CMTimeGetSeconds(asset.duration()))
    tracks = list(asset.tracks() or [])
    width = height = 0
    for track in tracks:
        try:
            media_type = str(track.mediaType())
        except Exception:
            media_type = ""
        if media_type and media_type != "vide":
            continue
        try:
            size = track.naturalSize()
            width = int(abs(size.width))
            height = int(abs(size.height))
        except Exception:
            width = height = 0
        if width and height:
            break
    if duration <= 0:
        return None
    return VideoInfo(duration=duration, width=width, height=height, backend="avfoundation")


def probe_video(video: Path) -> VideoInfo:
    info = probe_with_ffprobe(video) or probe_with_avfoundation(video)
    if not info:
        raise RuntimeError("Could not probe video. Install ffmpeg/ffprobe or run on macOS with AVFoundation available.")
    return info


def frame_fingerprint(path: Path) -> list[int]:
    with Image.open(path) as image:
        image = image.convert("L")
        width, height = image.size
        crop_top = int(height * 0.08)
        image = image.crop((0, crop_top, width, height))
        image = image.resize((48, 96), BILINEAR)
        if hasattr(image, "get_flattened_data"):
            return list(image.get_flattened_data())
        return list(image.getdata())


def fp_diff(left: list[int], right: list[int]) -> float:
    return sum(abs(a - b) for a, b in zip(left, right)) / len(left)


def extract_frames_ffmpeg(video: Path, target_dir: Path, sample_rate: float, start: float, end: float | None) -> list[Path]:
    ffmpeg = find_tool("ffmpeg")
    if not ffmpeg:
        return []
    target_dir.mkdir(parents=True, exist_ok=True)
    pattern = target_dir / "frame-%06d.png"
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(video)]
    if end is not None:
        command.extend(["-t", f"{max(0.0, end - start):.3f}"])
    command.extend(["-vf", f"fps={sample_rate}", "-vsync", "0", str(pattern)])
    result = run(command)
    if result.returncode != 0:
        return []
    return sorted(target_dir.glob("frame-*.png"))


def extract_frames_avfoundation(video: Path, target_dir: Path, sample_rate: float, start: float, end: float | None, duration: float) -> list[Path]:
    if platform.system() != "Darwin":
        return []
    try:
        from AppKit import NSBitmapImageRep, NSPNGFileType
        from AVFoundation import AVAssetImageGenerator, AVURLAsset
        from CoreMedia import CMTimeMakeWithSeconds
        from Foundation import NSURL
    except Exception:
        return []
    target_dir.mkdir(parents=True, exist_ok=True)
    asset = AVURLAsset.URLAssetWithURL_options_(NSURL.fileURLWithPath_(str(video)), None)
    generator = AVAssetImageGenerator.alloc().initWithAsset_(asset)
    generator.setAppliesPreferredTrackTransform_(True)
    final_time = min(end if end is not None else duration, duration)
    frame_count = int(math.floor(max(0.0, final_time - start) * sample_rate)) + 1
    paths: list[Path] = []
    for idx in range(frame_count):
        timestamp = min(start + idx / sample_rate, max(0.0, final_time - 0.02))
        result = generator.copyCGImageAtTime_actualTime_error_(CMTimeMakeWithSeconds(timestamp, 600), None, None)
        cgimage = result[0] if isinstance(result, tuple) else result
        if cgimage is None:
            continue
        rep = NSBitmapImageRep.alloc().initWithCGImage_(cgimage)
        data = rep.representationUsingType_properties_(NSPNGFileType, {})
        target = target_dir / f"frame-{idx + 1:06d}.png"
        data.writeToFile_atomically_(str(target), True)
        paths.append(target)
    return paths


def extract_frames(
    video: Path,
    work_dir: Path,
    sample_rate: float,
    start: float,
    end: float | None,
    info: VideoInfo,
) -> list[FrameInfo]:
    shutil.rmtree(work_dir, ignore_errors=True)
    paths = extract_frames_ffmpeg(video, work_dir, sample_rate, start, end)
    if not paths:
        paths = extract_frames_avfoundation(video, work_dir, sample_rate, start, end, info.duration)
    if not paths:
        raise RuntimeError("No frames could be decoded. Install ffmpeg for reliable native-resolution extraction.")
    frames: list[FrameInfo] = []
    for idx, path in enumerate(paths):
        timestamp = start + idx / sample_rate
        frames.append(FrameInfo(time=timestamp, path=path, fp=frame_fingerprint(path)))
    return frames


def ocr_text(path: Path) -> list[str]:
    if platform.system() != "Darwin":
        return []
    try:
        from Foundation import NSURL
        from Vision import VNImageRequestHandler, VNRecognizeTextRequest, VNRequestTextRecognitionLevelAccurate
    except Exception:
        return []
    request = VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(False)
    handler = VNImageRequestHandler.alloc().initWithURL_options_(NSURL.fileURLWithPath_(str(path)), {})
    ok, _ = handler.performRequests_error_([request], None)
    if not ok:
        return []
    lines: list[str] = []
    for obs in request.results() or []:
        candidates = obs.topCandidates_(1)
        if candidates:
            text = str(candidates[0].string()).strip()
            if text:
                lines.append(text)
    return lines


def clean_text_candidates(text_lines: Iterable[str]) -> list[str]:
    ignored_exact = {"skip", "continue", "next", "app store", "get started"}
    candidates: list[str] = []
    for line in text_lines:
        clean = " ".join(line.strip().split())
        if not clean:
            continue
        lowered = clean.lower()
        if lowered in ignored_exact or "app store" in lowered:
            continue
        if re.fullmatch(r"\d{1,2}:\d{2}\s*\d?", clean):
            continue
        if re.fullmatch(r"\d+%?", clean):
            continue
        letters = re.findall(r"[A-Za-z]", clean)
        if len(letters) < 5:
            continue
        candidates.append(clean)
    return candidates


def semantic_key(text_lines: list[str], fallback_index: int) -> str:
    candidates = clean_text_candidates(text_lines)
    if candidates:
        question = next((item for item in candidates if "?" in item), None)
        return slugify(question or candidates[0])
    return ""


def annotate_frames(frames: list[FrameInfo]) -> None:
    for idx, frame in enumerate(frames):
        frame.text_lines = ocr_text(frame.path)
        frame.key = semantic_key(frame.text_lines, idx)


def segment_frames(frames: list[FrameInfo], sample_rate: float, source: str) -> list[Segment]:
    if not frames:
        return []
    interval = 1.0 / sample_rate
    raw: list[Segment] = []
    current = Segment(frames[0].time, frames[0].time + interval, [frames[0]], source=source)
    current_rep = frames[0].fp
    current_key = frames[0].key
    for frame in frames[1:]:
        delta = fp_diff(current_rep, frame.fp)
        has_useful_keys = bool(current_key and frame.key)
        key_changed = has_useful_keys and frame.key != current_key
        if key_changed or delta > VISUAL_SPLIT_THRESHOLD:
            raw.append(current)
            current = Segment(frame.time, frame.time + interval, [frame], source=source)
            current_rep = frame.fp
            current_key = frame.key
            continue
        current.frames.append(frame)
        current.end_time = frame.time + interval
        current_rep = current.representative.fp
    raw.append(current)
    return raw


def is_duplicate_segment(left: Segment, right: Segment) -> bool:
    left_key = left.representative.key
    right_key = right.representative.key
    if left_key and right_key and left_key != right_key:
        return False
    if left_key and left_key == right_key:
        return fp_diff(left.representative.fp, right.representative.fp) <= VISUAL_SPLIT_THRESHOLD
    return fp_diff(left.representative.fp, right.representative.fp) <= VISUAL_DUPLICATE_THRESHOLD


def compact_segments(segments: list[Segment]) -> list[Segment]:
    final: list[Segment] = []
    for segment in sorted(segments, key=lambda item: item.start_time):
        if final and is_duplicate_segment(final[-1], segment):
            final[-1].frames.extend(segment.frames)
            final[-1].end_time = max(final[-1].end_time, segment.end_time)
            continue
        final.append(segment)
    return final


def first_pass_filter(segments: list[Segment]) -> tuple[list[Segment], list[ReviewState]]:
    kept: list[Segment] = []
    states: list[ReviewState] = []
    for segment in segments:
        if segment.duration < MIN_STATE_SECONDS:
            states.append(
                ReviewState(
                    start_time=segment.start_time,
                    end_time=segment.end_time,
                    state="needs review",
                    reason="Short visual state may be a transition, tap highlight, or missed durable state.",
                    first_pass="Dropped short state and queued a higher-FPS second pass.",
                    review="Scrub this range if it remains unresolved.",
                )
            )
            continue
        kept.append(segment)
    return compact_segments(kept), states


def run_second_pass(
    video: Path,
    info: VideoInfo,
    states: list[ReviewState],
    kept: list[Segment],
    work_root: Path,
    sample_rate: float,
) -> list[Segment]:
    additions: list[Segment] = []
    for idx, state in enumerate(states, start=1):
        start = max(0.0, state.start_time - 0.6)
        end = min(info.duration, state.end_time + 0.6)
        try:
            frames = extract_frames(video, work_root / f"second-pass-{idx:03d}", sample_rate, start, end, info)
            annotate_frames(frames)
            candidates = [
                item
                for item in segment_frames(frames, sample_rate, "second-pass")
                if item.duration >= SECOND_PASS_MIN_STATE_SECONDS
            ]
        except Exception as exc:
            state.state = "needs review second time"
            state.second_pass = f"Second pass could not decode range: {exc}"
            state.output_action = "No additional screen inserted."
            continue
        new_candidates: list[Segment] = []
        for candidate in candidates:
            duplicate = any(is_duplicate_segment(existing, candidate) for existing in kept + additions)
            if not duplicate:
                new_candidates.append(candidate)
        if new_candidates:
            additions.extend(new_candidates)
            state.state = "resolved"
            state.second_pass = "Higher-FPS pass found an additional settled visual state."
            state.output_action = "Inserted the recovered state into chronological output and renumbered final screens."
        elif candidates:
            state.state = "resolved"
            state.second_pass = "Higher-FPS pass found only states already represented by exported screens."
            state.output_action = "No additional screen inserted."
        else:
            state.state = "needs review second time"
            state.second_pass = "Higher-FPS pass still did not find a clean durable state."
            state.output_action = "No additional screen inserted."
    return additions


def write_contact_sheet(screen_paths: list[Path], target: Path) -> None:
    if not screen_paths:
        return
    columns = min(6, max(1, len(screen_paths)))
    thumb_w, thumb_h = 180, 390
    label_h = 34
    margin = 14
    rows = math.ceil(len(screen_paths) / columns)
    sheet = Image.new(
        "RGB",
        (columns * (thumb_w + margin) + margin, rows * (thumb_h + label_h + margin) + margin),
        (246, 246, 246),
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for idx, path in enumerate(screen_paths):
        with Image.open(path) as image:
            image = image.convert("RGB")
            image.thumbnail((thumb_w, thumb_h), LANCZOS)
            tile = Image.new("RGB", (thumb_w, thumb_h), "white")
            tile.paste(image, ((thumb_w - image.width) // 2, (thumb_h - image.height) // 2))
        col = idx % columns
        row = idx // columns
        x = margin + col * (thumb_w + margin)
        y = margin + row * (thumb_h + label_h + margin)
        sheet.paste(tile, (x, y))
        draw.text((x, y + thumb_h + 4), path.name[:32], fill=(20, 20, 20), font=font)
    sheet.save(target, quality=92)


def screen_name(segment: Segment, index: int, used: dict[str, int]) -> str:
    key = segment.representative.key or f"screen-{index:03d}"
    base = slugify(key, f"screen-{index:03d}")
    used[base] = used.get(base, 0) + 1
    suffix = f"-{used[base]}" if used[base] > 1 else ""
    return f"{index:03d}-{base}{suffix}.png"


def export_screens(segments: list[Segment], output_dir: Path) -> list[tuple[Path, Segment]]:
    screens_dir = output_dir / "screens"
    shutil.rmtree(screens_dir, ignore_errors=True)
    screens_dir.mkdir(parents=True, exist_ok=True)
    exported: list[tuple[Path, Segment]] = []
    used: dict[str, int] = {}
    for idx, segment in enumerate(sorted(segments, key=lambda item: item.start_time), start=1):
        target = screens_dir / screen_name(segment, idx, used)
        shutil.copyfile(segment.representative.path, target)
        exported.append((target, segment))
    return exported


def write_review(
    output_dir: Path,
    source_video: Path,
    context: str,
    info: VideoInfo,
    sample_rate: float,
    second_pass_rate: float,
    exported: list[tuple[Path, Segment]],
    states: list[ReviewState],
) -> None:
    lines = [
        "# App UX Workflow Capture",
        "",
        f"- Source video: `{source_video}`",
        f"- Duration: {info.duration:.2f}s",
        f"- Native frame size: {info.width}x{info.height}" if info.width and info.height else "- Native frame size: unknown",
        f"- Decoder backend: {info.backend}",
        f"- Sample rate: {sample_rate:g} fps",
        f"- Second-pass sample rate: {second_pass_rate:g} fps",
        f"- Exported screens: {len(exported)}",
        "",
    ]
    if context:
        lines.extend(["## Context", "", context.strip(), ""])
    lines.extend(
        [
            "## Review Checklist",
            "",
            "- Confirm chronology matches the video from start to finish.",
            "- Check `Review States` for ranges that need comparison against the source video.",
            "- Delete extra transition/tap-highlight screens in Figma if any slipped through.",
            "- Confirm no tray, modal, paywall, selected state, or alternate tap outcome is missing.",
            "",
            "## Review States",
            "",
        ]
    )
    if states:
        for state in states:
            lines.extend(
                [
                    f"- `{format_time(state.start_time)}-{format_time(state.end_time)}` {state.state}",
                    f"  - Reason: {state.reason}",
                    f"  - First pass: {state.first_pass}",
                    f"  - Second pass: {state.second_pass or 'Not run.'}",
                    f"  - Output action: {state.output_action or 'No change.'}",
                    f"  - Review: {state.review}",
                ]
            )
    else:
        lines.append("- No suspicious ranges flagged.")
    lines.extend(["", "## Screens", ""])
    for idx, (path, segment) in enumerate(exported, start=1):
        text_preview = "; ".join(segment.representative.text_lines[:6]) or "Not detected"
        lines.extend(
            [
                f"### {idx:03d}. {path.stem}",
                "",
                f"- Time range: {format_time(segment.start_time)} - {format_time(segment.end_time)}",
                f"- Visible text: {text_preview}",
                f"- Capture note: {segment.source}",
                "",
                f"![{path.stem}](screens/{path.name})",
                "",
            ]
        )
    (output_dir / "SCREEN_REVIEW.md").write_text("\n".join(lines), encoding="utf-8")


def verify_output(output_dir: Path, exported: list[tuple[Path, Segment]]) -> None:
    missing = [path for path, _ in exported if not path.is_file()]
    if missing:
        raise RuntimeError(f"Missing exported screens: {missing}")
    if not (output_dir / "SCREEN_REVIEW.md").is_file():
        raise RuntimeError("SCREEN_REVIEW.md was not written.")
    if not (output_dir / "contact-sheet.jpg").is_file():
        raise RuntimeError("contact-sheet.jpg was not written.")


def process_video(video: Path, output_dir: Path, context: str, args: argparse.Namespace) -> dict[str, object]:
    work_root = Path(tempfile.mkdtemp(prefix="app-ux-workflow-"))
    debug_dir = output_dir / "debug"
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        info = probe_video(video)
        frames = extract_frames(video, work_root / "first-pass", args.sample_rate, 0.0, None, info)
        annotate_frames(frames)
        raw_segments = segment_frames(frames, args.sample_rate, "first-pass")
        kept, states = first_pass_filter(raw_segments)
        additions = run_second_pass(video, info, states, kept, work_root, args.second_pass_rate) if states else []
        final_segments = compact_segments(kept + additions)
        if final_segments:
            final_segments[-1].end_time = min(info.duration, max(final_segments[-1].end_time, info.duration))
        exported = export_screens(final_segments, output_dir)
        write_contact_sheet([path for path, _ in exported], output_dir / "contact-sheet.jpg")
        write_review(output_dir, video, context, info, args.sample_rate, args.second_pass_rate, exported, states)
        verify_output(output_dir, exported)
        if args.debug:
            shutil.rmtree(debug_dir, ignore_errors=True)
            shutil.copytree(work_root, debug_dir)
        return {
            "video": str(video),
            "output": str(output_dir),
            "screens": len(exported),
            "review_states": len(states),
            "needs_review_second_time": sum(1 for state in states if state.state == "needs review second time"),
        }
    finally:
        if not args.debug:
            shutil.rmtree(work_root, ignore_errors=True)


def write_summary(root: Path, results: list[dict[str, object]]) -> None:
    lines = ["# App UX Workflow Capture Summary", ""]
    for result in results:
        output = Path(str(result["output"]))
        rel_review = output.relative_to(root) / "SCREEN_REVIEW.md"
        lines.extend(
            [
                f"## {output.name}",
                "",
                f"- Video: `{result['video']}`",
                f"- Screens: {result['screens']}",
                f"- Review states: {result['review_states']}",
                f"- Needs review second time: {result['needs_review_second_time']}",
                f"- Review: [{rel_review}]({rel_review})",
                "",
            ]
        )
    (root / "SUMMARY.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    args = parse_args()
    videos = [require_video(path) for path in args.videos]
    root = (args.output or default_output_root()).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, object]] = []
    for video in videos:
        video_output = unique_dir(root, video.stem)
        print(f"Processing {video} -> {video_output}")
        results.append(process_video(video, video_output, args.context, args))
    if len(results) > 1:
        write_summary(root, results)
    print(f"Output root: {root}")
    for result in results:
        print(f"- {result['output']}: {result['screens']} screens, {result['review_states']} review states")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
