// Copy the Handsfree.js library + model assets out of node_modules
// into ./public/ so the page is fully self-hosted (no CDN at runtime).
// Cross-platform — runs on Windows, macOS, Linux.

import fs from 'node:fs';
import path from 'node:path';

const src = path.join('node_modules', 'handsfree', 'build', 'lib');
const dst = 'public';

if (!fs.existsSync(src)) {
  console.error(`error: ${src} not found. Run 'npm install' first.`);
  process.exit(1);
}

fs.mkdirSync(path.join(dst, 'assets'), { recursive: true });
fs.copyFileSync(path.join(src, 'handsfree.js'), path.join(dst, 'handsfree.js'));
fs.cpSync(path.join(src, 'assets'), path.join(dst, 'assets'), { recursive: true });
console.log(`Ejected handsfree.js and assets to ${dst}/`);
