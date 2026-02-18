const fs = require('fs');
const path = require('path');

const required = [
  'main.js',
  'preload.js',
  'services/videoPipeline.js',
  'src/index.html',
  'src/styles.css',
  'src/renderer.js',
  'python_service/app.py'
];

const missing = required.filter((entry) => !fs.existsSync(path.join(process.cwd(), entry)));
if (missing.length) {
  console.error('Missing required files:', missing.join(', '));
  process.exit(1);
}

console.log('Lint check passed: required app files are present.');
