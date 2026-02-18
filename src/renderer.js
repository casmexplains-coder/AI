const state = {
  analysis: null,
  selectedClip: null,
  settings: null
};

function $(id) {
  return document.getElementById(id);
}

function setStatus(text, progress = null) {
  $('statusText').textContent = text;
  if (progress !== null) {
    $('analysisProgress').value = progress;
  }
}

function formatSeconds(total) {
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function renderTimeline(clips) {
  const timeline = $('timeline');
  timeline.innerHTML = '';

  clips.forEach((clip, index) => {
    const row = document.createElement('div');
    row.className = 'timeline-row';
    row.innerHTML = `
      <strong>Clip ${index + 1}: ${formatSeconds(clip.start)} - ${formatSeconds(clip.end)}</strong>
      <p>Score: ${clip.score.toFixed(2)} | Retention: ${clip.retention.toFixed(2)} | Emotion: ${clip.emotion.toFixed(2)}</p>
      <p>Hook: ${clip.hook_text}</p>
    `;

    row.onclick = () => {
      state.selectedClip = clip;
      $('captionPreview').textContent = clip.title_suggestions.join(' • ');
      if (clip.preview_path) {
        $('clipPreview').src = clip.preview_path;
      }
    };

    timeline.appendChild(row);
  });
}

async function loadProjects() {
  const list = await window.casmAPI.listProjects();
  const container = $('projectList');
  container.innerHTML = '';

  list.forEach((project) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `<strong>${project.name}</strong><p>${project.createdAt}</p><p>${project.clipCount} clips</p>`;
    card.onclick = async () => {
      const loaded = await window.casmAPI.loadProject(project.path);
      state.analysis = loaded;
      $('videoTitle').textContent = loaded.metadata.title;
      $('videoDuration').textContent = loaded.metadata.duration_text;
      $('videoThumb').src = loaded.metadata.thumbnail || '';
      renderTimeline(loaded.clips || []);
      $('renderButton').disabled = false;
    };
    container.appendChild(card);
  });
}

function bindNavigation() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.view').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.view).classList.add('active');

      if (btn.dataset.view === 'projects') {
        loadProjects();
      }
    });
  });
}

function bindSettings() {
  $('saveSettings').onclick = async () => {
    const settings = {
      outputDir: $('outputDir').value,
      captionStyle: $('captionStyle').value,
      fontFamily: $('fontFamily').value,
      clipsPerVideo: Number($('clipsPerVideo').value),
      minClipSeconds: Number($('minClipSeconds').value),
      maxClipSeconds: Number($('maxClipSeconds').value),
      gpuAcceleration: $('gpuAcceleration').checked,
      autoMusic: $('autoMusic').checked,
      language: $('language').value || 'auto'
    };

    state.settings = await window.casmAPI.saveSettings(settings);
    setStatus('Settings saved', 100);
  };
}

async function loadSettings() {
  const settings = await window.casmAPI.getSettings();
  state.settings = settings;

  Object.entries({
    outputDir: settings.outputDir,
    captionStyle: settings.captionStyle,
    fontFamily: settings.fontFamily,
    clipsPerVideo: settings.clipsPerVideo,
    minClipSeconds: settings.minClipSeconds,
    maxClipSeconds: settings.maxClipSeconds,
    language: settings.language
  }).forEach(([key, value]) => {
    $(key).value = value;
  });

  $('gpuAcceleration').checked = settings.gpuAcceleration;
  $('autoMusic').checked = settings.autoMusic;
}

async function loadCapabilities() {
  const capabilities = await window.casmAPI.getSystemCapabilities();
  const list = $('systemCapabilities');
  list.innerHTML = '';

  Object.entries(capabilities).forEach(([key, value]) => {
    const item = document.createElement('li');
    item.textContent = `${key}: ${value ? 'available' : 'missing'}`;
    list.appendChild(item);
  });
}

function bindActions() {
  $('browseButton').onclick = async () => {
    const filePath = await window.casmAPI.selectVideoFile();
    if (filePath) {
      $('inputSource').value = filePath;
    }
  };

  $('analyzeButton').onclick = async () => {
    const source = $('inputSource').value.trim();
    if (!source) {
      setStatus('Please enter a source.', 0);
      return;
    }

    setStatus('Analyzing input...', 15);

    try {
      const payload = {
        source,
        manualAdjustmentSeconds: 0,
        batchMode: false
      };
      const analysis = await window.casmAPI.analyzeVideo(payload);
      state.analysis = analysis.project;

      $('videoTitle').textContent = analysis.project.metadata.title;
      $('videoDuration').textContent = analysis.project.metadata.duration_text;
      $('videoThumb').src = analysis.project.metadata.thumbnail || '';
      renderTimeline(analysis.project.clips);
      setStatus('Analysis complete', 75);
      $('renderButton').disabled = false;
    } catch (error) {
      setStatus(`Analysis failed: ${error.message}`, 0);
    }
  };

  $('renderButton').onclick = async () => {
    if (!state.analysis) {
      return;
    }

    setStatus('Rendering clips...', 85);
    try {
      const rendered = await window.casmAPI.renderClips({ project: state.analysis });
      state.analysis = rendered.project;

      const firstClip = rendered.project.clips.find((clip) => clip.output_path);
      if (firstClip) {
        $('clipPreview').src = firstClip.output_path;
      }

      setStatus(`Export complete (${rendered.renderedCount} clips)`, 100);
    } catch (error) {
      setStatus(`Render failed: ${error.message}`, 0);
    }
  };
}

bindNavigation();
bindSettings();
bindActions();
loadSettings();
loadCapabilities();
