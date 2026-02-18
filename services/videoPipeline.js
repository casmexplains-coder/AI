const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isYouTubeUrl(value) {
  return /(?:youtube\.com|youtu\.be)/i.test(value);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

function probeVideo(videoPath) {
  const out = runCommand('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    videoPath
  ]);

  const parsed = JSON.parse(out);
  const duration = Number(parsed.format.duration || 0);

  return {
    title: path.basename(videoPath),
    duration,
    duration_text: `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`,
    thumbnail: null,
    source_path: videoPath
  };
}

function prepareWorkspace(outputDir) {
  const runId = crypto.randomBytes(8).toString('hex');
  const workspace = path.join(outputDir, `project-${runId}`);
  fs.mkdirSync(workspace, { recursive: true });
  return workspace;
}

function fetchSource(source, workspace) {
  if (!isUrl(source)) {
    return { localPath: source, metadata: probeVideo(source) };
  }

  if (isYouTubeUrl(source)) {
    const target = path.join(workspace, 'source.mp4');
    runCommand('yt-dlp', ['-f', 'mp4', '-o', target, source]);
    const rawMeta = runCommand('yt-dlp', ['--dump-single-json', source]);
    const meta = JSON.parse(rawMeta);

    return {
      localPath: target,
      metadata: {
        title: meta.title,
        duration: meta.duration,
        duration_text: `${Math.floor(meta.duration / 60)}:${Math.floor(meta.duration % 60).toString().padStart(2, '0')}`,
        thumbnail: meta.thumbnail,
        source_path: target
      }
    };
  }

  const target = path.join(workspace, 'source.mp4');
  runCommand('curl', ['-L', source, '-o', target]);
  return { localPath: target, metadata: probeVideo(target) };
}

function runPython(scriptArgs, cwd = process.cwd()) {
  const py = spawnSync('python3', scriptArgs, {
    cwd,
    encoding: 'utf-8'
  });

  if (py.status !== 0) {
    throw new Error(py.stderr || py.stdout || 'Python pipeline failed');
  }

  return JSON.parse(py.stdout);
}

async function runAnalysis(payload, settings) {
  const outputDir = settings.outputDir || path.join(os.homedir(), 'Videos', 'CasmClips');
  fs.mkdirSync(outputDir, { recursive: true });
  const workspace = prepareWorkspace(outputDir);
  const { localPath, metadata } = fetchSource(payload.source, workspace);

  const analysis = runPython([
    path.join(process.cwd(), 'python_service', 'app.py'),
    'analyze',
    '--input',
    localPath,
    '--workspace',
    workspace,
    '--clips-per-video',
    String(settings.clipsPerVideo || 5),
    '--min-seconds',
    String(settings.minClipSeconds || 15),
    '--max-seconds',
    String(settings.maxClipSeconds || 60),
    '--language',
    settings.language || 'auto'
  ]);

  const project = {
    id: path.basename(workspace),
    created_at: new Date().toISOString(),
    workspace,
    metadata,
    transcript_path: analysis.transcript_path,
    clips: analysis.clips,
    recommendations: analysis.recommendations,
    settings_snapshot: settings
  };

  const projectFile = path.join(workspace, 'project.json');

  return {
    project,
    projectFile
  };
}

async function renderClips(payload, settings) {
  const project = payload.project;
  const rendered = runPython([
    path.join(process.cwd(), 'python_service', 'app.py'),
    'render',
    '--project',
    path.join(project.workspace, 'project.json'),
    '--caption-style',
    settings.captionStyle || 'neon',
    '--font-family',
    settings.fontFamily || 'Inter',
    ...(settings.gpuAcceleration ? ['--gpu'] : [])
  ]);

  const mergedProject = {
    ...project,
    clips: rendered.clips,
    export_path: rendered.export_path,
    updated_at: new Date().toISOString()
  };

  return {
    renderedCount: rendered.rendered_count,
    project: mergedProject,
    projectFile: path.join(project.workspace, 'project.json')
  };
}

async function saveProject(projectFile, project) {
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
}

function listProjects(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const dirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('project-'));

  return dirs
    .map((entry) => {
      const fullPath = path.join(rootDir, entry.name, 'project.json');
      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      return {
        path: fullPath,
        name: parsed.metadata?.title || entry.name,
        createdAt: parsed.created_at || 'unknown',
        clipCount: parsed.clips?.length || 0
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function loadProject(projectPath) {
  return JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
}

function getSystemCapabilities() {
  const checks = {
    ffmpeg: true,
    ffprobe: true,
    python3: true,
    ytDlp: true
  };

  try { runCommand('ffmpeg', ['-version']); } catch (_e) { checks.ffmpeg = false; }
  try { runCommand('ffprobe', ['-version']); } catch (_e) { checks.ffprobe = false; }
  try { runCommand('python3', ['--version']); } catch (_e) { checks.python3 = false; }
  try { runCommand('yt-dlp', ['--version']); } catch (_e) { checks.ytDlp = false; }

  return checks;
}

module.exports = {
  runAnalysis,
  renderClips,
  listProjects,
  loadProject,
  saveProject,
  getSystemCapabilities
};
