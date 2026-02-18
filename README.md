# Casm Clips

Casm Clips is a fully local desktop application (Electron + Node.js + Python) for turning long-form videos into AI-selected short vertical clips for YouTube Shorts, TikTok, and Instagram Reels.

## What it does

- Accepts **YouTube URL**, **direct video URL**, or **local file** input.
- Analyzes full video locally and proposes 15–60 second engaging moments.
- Exports vertical **1080x1920 MP4 clips** with subtitle overlays and hook/title suggestions.
- Stores projects locally for reopen/export workflows.

---

## Requirements (Windows)

Install these first:

1. **Node.js 20+**  
   https://nodejs.org/
2. **Python 3.10+**  
   https://www.python.org/downloads/windows/
3. **FFmpeg + FFprobe** in `PATH`  
   https://ffmpeg.org/download.html
4. **yt-dlp** in `PATH` (for YouTube downloads)  
   `python -m pip install yt-dlp`

> Casm Clips runs locally. No cloud APIs are required for core flow.

---

## Install locally

### Option A (recommended): one-command Windows setup

From PowerShell in the repo root:

```powershell
npm run setup:windows
```

This script:
- validates Node/Python presence
- warns if ffmpeg/ffprobe/yt-dlp are missing
- installs Node dependencies
- installs Python dependencies from `python_service/requirements.txt`

### Option B: manual install

```powershell
npm install
python -m pip install --upgrade pip
python -m pip install -r python_service/requirements.txt
```

---

## Run locally

```powershell
npm start
```

The app opens as an Electron desktop window.

---

## How to use

1. Open **Home**.
2. Paste a YouTube URL / direct URL / local path, or click **Browse**.
3. Click **Analyze** to generate candidate moments.
4. Review timeline clip cards and metadata.
5. Click **Export MP4 (1080x1920)**.
6. Open **Projects** to reload previously analyzed/exported sessions.

---

## Verify dependencies

```powershell
npm run check:deps
```

This prints local capability checks for:
- ffmpeg
- ffprobe
- python3
- yt-dlp

---

## Project structure

- `main.js` — Electron main process + IPC handlers.
- `preload.js` — secure renderer API bridge.
- `src/` — UI (HTML/CSS/renderer logic).
- `services/videoPipeline.js` — source ingestion, metadata probing, Python orchestration, project save/load.
- `python_service/app.py` — local analyze/render pipeline.
- `python_service/requirements.txt` — Python packages.
- `scripts/setup_windows.ps1` — Windows setup helper.

---

## Notes

- If Whisper/OpenCV/Torch are not available, current pipeline can still run using its built-in local fallback logic.
- For full production-quality AI detection, keep `openai-whisper`, `opencv-python`, and `torch` installed.
- Rendering currently uses a CPU-safe ffmpeg path (including Windows) for maximum stability; GPU toggle is reserved for a future hardened implementation.
