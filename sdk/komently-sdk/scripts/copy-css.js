/*
  Copy CSS assets to dist so CSS modules resolve at runtime.
*/
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyCssFiles(srcDir, distDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(distDir, entry.name);

    if (entry.isDirectory()) {
      copyCssFiles(srcPath, destPath);
    } else if (/\.css(\.d\.ts)?$/.test(entry.name)) {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

ensureDir(DIST_DIR);
copyCssFiles(SRC_DIR, DIST_DIR);
console.log('[komently-sdk] Copied CSS assets to dist');



