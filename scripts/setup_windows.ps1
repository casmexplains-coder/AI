Write-Host "=== Casm Clips Windows Setup ==="

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js not found. Install Node.js 20+ from https://nodejs.org/"
  exit 1
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "Python not found. Install Python 3.10+ from https://www.python.org/downloads/windows/"
  exit 1
}

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Warning "FFmpeg not found in PATH. Install FFmpeg and add it to PATH."
}

if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
  Write-Warning "FFprobe not found in PATH. It is usually bundled with FFmpeg."
}

if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) {
  Write-Warning "yt-dlp not found in PATH. Install via: python -m pip install yt-dlp"
}

Write-Host "Installing Node dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Installing Python dependencies..."
python -m pip install --upgrade pip
python -m pip install -r python_service/requirements.txt

Write-Host "Setup complete. Run: npm start"
