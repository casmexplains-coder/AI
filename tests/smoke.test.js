const path = require('path');
const fs = require('fs');
const { getSystemCapabilities } = require('../services/videoPipeline');

const capabilities = getSystemCapabilities();
console.log('Capabilities:', capabilities);

const pyPath = path.join(process.cwd(), 'python_service', 'app.py');
if (!fs.existsSync(pyPath)) {
  throw new Error('python_service/app.py missing');
}

console.log('Smoke test passed.');
