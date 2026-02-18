# Casm Clips

Casm Clips is a fully local desktop application (Electron + Node.js + Python) for turning long-form videos into AI-selected short vertical clips for YouTube Shorts, TikTok, and Instagram Reels.

## Highlights

- **Input Sources**: YouTube URL, direct MP4 URL, or local video file.
- **Offline AI Analysis**: local transcription pipeline + heuristic moment scoring tuned for retention, emotion, and hook density.
- **Auto Clip Generation**: renders 9:16 clips with subtitles, zoom emphasis, and export-ready MP4 outputs.
- **Caption Intelligence**: title suggestions, hook text, descriptions, hashtags, and language setting support.
- **Modern UI**: dark theme with neon green accents, sidebar navigation, timeline preview, clip preview, and processing progress.
- **Privacy-first**: no external API requirement in the processing flow.

## Architecture

- `main.js`: Electron process, IPC handlers, settings persistence.
- `src/`: renderer HTML/CSS/JS desktop UI.
- `services/videoPipeline.js`: ingestion, metadata probing, Python orchestration, project persistence.
- `python_service/app.py`: local analysis and render pipeline with FFmpeg.

## Local Dependencies

Install these tools on Windows:

1. **Node.js 20+**
2. **Python 3.10+**
3. **FFmpeg + FFprobe** (in PATH)
4. **yt-dlp** (in PATH)

Recommended Python packages for future upgrades:

- `openai-whisper` (full local transcription)
- `opencv-python` (face detection for smart crop)
- `torch` (local model acceleration)

> Current MVP includes built-in offline fallback transcript generation to keep the pipeline runnable without heavy model setup.

## Setup

```bash
npm install
npm start
```

## Usage

1. Paste a YouTube URL / direct URL / local file path.
2. Click **Analyze** to generate candidate clips.
3. Review timeline scoring and hook previews.
4. Click **Export MP4 (1080x1920)** to render clips.
5. Open Projects to reload saved analyses.

## Advanced Options

Settings include:

- clips-per-video target (3–5 or custom)
- min/max clip duration
- caption style and font family
- GPU acceleration toggle
- auto music underlay toggle
- output folder configuration
- language mode (`auto` or fixed)

## Notes

- Processing is local and project files are autosaved in the configured output directory.
- Generated clips are stored under each project’s `exports/` folder.
- Model download manager is represented as dependency checks in the MVP and can be extended by adding first-run installers.
