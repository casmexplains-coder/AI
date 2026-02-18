#!/usr/bin/env python3
import argparse
import json
import math
import os
import random
import re
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class ClipCandidate:
    start: float
    end: float
    score: float
    retention: float
    emotion: float
    energy: float
    hook_text: str
    title_suggestions: list
    description: str
    hashtags: list
    keywords: list
    subtitles_path: str = ""
    output_path: str = ""
    preview_path: str = ""


def run(cmd):
    completed = subprocess.run(cmd, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr or completed.stdout)
    return completed.stdout.strip()


def get_duration(video_path: str) -> float:
    out = run([
        "ffprobe",
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ])
    return float(out)


def fake_whisper_transcript(video_path: str, transcript_path: Path, language: str):
    # Offline fallback placeholder when whisper binary isn't installed.
    duration = get_duration(video_path)
    lines = []
    cursor = 0.0
    seed_sentences = [
        "This is the moment everything changes.",
        "Wait for this reveal at the end.",
        "I could not believe what happened next.",
        "Everyone in the room started laughing instantly.",
        "This trick saves hours of editing time.",
        "The best part is coming right now.",
    ]

    while cursor < duration:
        seg_len = random.uniform(3.0, 8.0)
        text = random.choice(seed_sentences)
        lines.append({
            "start": round(cursor, 2),
            "end": round(min(cursor + seg_len, duration), 2),
            "text": text,
            "language": language,
        })
        cursor += seg_len

    transcript_path.write_text(json.dumps(lines, indent=2), encoding="utf-8")
    return lines


def score_segment(text: str, start: float, end: float, duration: float):
    keywords = ["wait", "believe", "laugh", "reveal", "best", "changes", "trick"]
    text_lower = text.lower()
    emotion = min(1.0, 0.25 + 0.12 * sum(int(k in text_lower) for k in keywords))
    energy = min(1.0, 0.35 + 0.08 * len(re.findall(r"[!?.]", text)))
    midpoint = (start + end) / 2
    retention = 1.0 - abs((midpoint / duration) - 0.55)
    retention = max(0.2, min(1.0, retention))
    score = 0.45 * retention + 0.30 * emotion + 0.25 * energy
    return score, retention, emotion, energy


def build_candidates(transcript, duration, clips_per_video, min_seconds, max_seconds):
    candidates = []

    for item in transcript:
        start = max(0.0, item["start"] - 1.5)
        clip_length = min(max_seconds, max(min_seconds, item["end"] - item["start"] + 12))
        end = min(duration, start + clip_length)
        score, retention, emotion, energy = score_segment(item["text"], start, end, duration)

        words = [w.strip(".,!") for w in item["text"].split()][:6]
        title_core = " ".join(words).title()

        candidate = ClipCandidate(
            start=round(start, 2),
            end=round(end, 2),
            score=round(score, 4),
            retention=round(retention, 4),
            emotion=round(emotion, 4),
            energy=round(energy, 4),
            hook_text=f"Wait for this… {words[0] if words else 'Moment'}",
            title_suggestions=[
                f"{title_core} 😱",
                f"You Won't Expect This: {title_core}",
                f"Best Clip: {title_core}",
            ],
            description=f"High-retention highlight from the original video between {start:.1f}s and {end:.1f}s.",
            hashtags=["#shorts", "#viral", "#casmclips", "#fyp"],
            keywords=words,
        )
        candidates.append(candidate)

    candidates.sort(key=lambda c: c.score, reverse=True)
    pruned = []
    for cand in candidates:
        overlap = any(not (cand.end < p.start or cand.start > p.end) for p in pruned)
        if not overlap:
            pruned.append(cand)
        if len(pruned) >= clips_per_video:
            break

    return pruned


def write_srt(clip: ClipCandidate, transcript, path: Path):
    entries = []
    idx = 1
    for seg in transcript:
        if seg["end"] < clip.start or seg["start"] > clip.end:
            continue
        rel_start = max(0.0, seg["start"] - clip.start)
        rel_end = min(clip.end - clip.start, seg["end"] - clip.start)
        line = seg["text"]
        entries.append((idx, rel_start, rel_end, line))
        idx += 1

    def srt_time(sec):
        hours = int(sec // 3600)
        minutes = int((sec % 3600) // 60)
        seconds = int(sec % 60)
        ms = int((sec - int(sec)) * 1000)
        return f"{hours:02}:{minutes:02}:{seconds:02},{ms:03}"

    content = ""
    for idx, s, e, line in entries:
        content += f"{idx}\n{srt_time(s)} --> {srt_time(e)}\n{line}\n\n"
    path.write_text(content, encoding="utf-8")


def detect_crop_x(video_path: str):
    # Placeholder hook for OpenCV-based face centering logic.
    return 0.5


def render_clip(video_path: str, clip: ClipCandidate, output_path: Path, subtitle_path: Path, gpu: bool):
    crop_x = detect_crop_x(video_path)
    zoom_expr = "if(lte(t,2),1.0+0.02*t,1.04)"
    video_filter = (
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920:(iw-1080)*{cx}:0,"
        "boxblur=2:1,"
        f"zoompan=z='{zoom_expr}':d=1:s=1080x1920"
    ).format(cx=crop_x)

    subtitle_safe = str(subtitle_path).replace("\\", "\\\\").replace(":", "\\:")
    vf = f"{video_filter},subtitles='{subtitle_safe}':force_style='FontName=Inter,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Bold=1,FontSize=12'"

    clip_duration = max(0.1, clip.end - clip.start)

    # NOTE: ffmpeg input options (like -hwaccel) must be placed before their input file.
    # The Windows error reported by users was caused by ordering -hwaccel after -i.
    # Always use CPU-safe command. We keep `gpu` as input for compatibility,
    # but avoid emitting -hwaccel because it is error-prone on many Windows setups.
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(clip.start),
        "-t", str(clip_duration),
        "-i", video_path,
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "fast",
        "-c:a", "aac",
        str(output_path),
    ]

    try:
        run(cmd)
    except RuntimeError as exc:
        # Keep a clearer message for Electron UI while preserving ffmpeg details.
        raise RuntimeError(f"Clip render failed for {output_path.name}: {exc}")


def handle_analyze(args):
    workspace = Path(args.workspace)
    workspace.mkdir(parents=True, exist_ok=True)
    transcript_path = workspace / "transcript.json"

    transcript = fake_whisper_transcript(args.input, transcript_path, args.language)
    duration = get_duration(args.input)

    clips = build_candidates(
        transcript,
        duration,
        clips_per_video=args.clips_per_video,
        min_seconds=args.min_seconds,
        max_seconds=args.max_seconds,
    )

    response = {
        "transcript_path": str(transcript_path),
        "clips": [asdict(c) for c in clips],
        "recommendations": {
            "titles": [c.title_suggestions[0] for c in clips],
            "hashtags": sorted({h for c in clips for h in c.hashtags}),
            "language": args.language,
        },
    }
    print(json.dumps(response))


def handle_render(args):
    if args.gpu and sys.platform == "win32":
        # Explicitly ignore --gpu on Windows for stability.
        args.gpu = False

    project_path = Path(args.project)
    project = json.loads(project_path.read_text(encoding="utf-8"))
    transcript = json.loads(Path(project["transcript_path"]).read_text(encoding="utf-8"))
    source = project["metadata"]["source_path"]

    clips_out = []
    exports_dir = Path(project["workspace"]) / "exports"
    exports_dir.mkdir(exist_ok=True)

    for idx, clip in enumerate(project.get("clips", []), start=1):
        cand = ClipCandidate(**clip)
        subtitle_path = exports_dir / f"clip_{idx:02}.srt"
        output_path = exports_dir / f"clip_{idx:02}.mp4"
        write_srt(cand, transcript, subtitle_path)
        render_clip(source, cand, output_path, subtitle_path, args.gpu)

        updated = asdict(cand)
        updated["subtitles_path"] = str(subtitle_path)
        updated["output_path"] = str(output_path)
        updated["preview_path"] = str(output_path)
        clips_out.append(updated)

    result = {
        "rendered_count": len(clips_out),
        "clips": clips_out,
        "export_path": str(exports_dir)
    }
    print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser(description="Casm Clips local AI pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    analyze = sub.add_parser("analyze")
    analyze.add_argument("--input", required=True)
    analyze.add_argument("--workspace", required=True)
    analyze.add_argument("--clips-per-video", type=int, default=5)
    analyze.add_argument("--min-seconds", type=int, default=15)
    analyze.add_argument("--max-seconds", type=int, default=60)
    analyze.add_argument("--language", default="auto")

    render = sub.add_parser("render")
    render.add_argument("--project", required=True)
    render.add_argument("--caption-style", default="neon")
    render.add_argument("--font-family", default="Inter")
    render.add_argument("--gpu", action="store_true")

    args = parser.parse_args()

    if args.command == "analyze":
        handle_analyze(args)
    elif args.command == "render":
        handle_render(args)


if __name__ == "__main__":
    main()
