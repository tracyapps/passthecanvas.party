import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('./dist/', import.meta.url);
const manifestPath = new URL('.vite/manifest.json', dist);
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error('Run npm run build before npm run check:perf.');
  process.exit(1);
}

function staticFiles(entries) {
  const files = new Set();
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    if (!entry) throw new Error(`Missing build entry ${key}. Check the manifest and performance budget roots.`);
    files.add(entry.file);
    for (const css of entry.css ?? []) files.add(css);
    for (const dependency of entry.imports ?? []) visit(dependency);
  }
  for (const key of entries) visit(key);
  return files;
}

function gzipBytes(files) {
  return [...files].reduce((total, file) => total + gzipSync(readFileSync(new URL(file, dist))).length, 0);
}

function check(label, bytes, maxKiB) {
  const passed = bytes <= maxKiB * 1024;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}: ${(bytes / 1024).toFixed(1)} KiB (budget ${maxKiB} KiB)`);
  if (!passed) process.exitCode = 1;
}

const entry = 'index.html';
const join = 'src/lib/party/JoinForm.svelte';
const studio = 'src/lib/Studio.svelte';
const room = 'src/lib/room/RoomView.svelte';
const partyFiles = staticFiles([entry, join, studio]);

// Count static JS and CSS once even when more than one entry imports them.
check('App shell JS/CSS, gzipped', gzipBytes(staticFiles([entry])), 95);
check('Join and open painting table JS/CSS, gzipped', gzipBytes(partyFiles), 360);

if (!manifest[room]?.isDynamicEntry || partyFiles.has(manifest[room].file)) {
  console.error('FAIL The 360° room must load separately from joining and opening the painting table.');
  process.exitCode = 1;
} else {
  console.log('PASS The 360° room is loaded separately.');
}

// Source sizes include compact images that Vite inlines into a JS chunk.
const supplies = new URL('./src/lib/canvas/supplies/', import.meta.url);
const thumbnails = readdirSync(supplies).filter((file) => /^compact-.*\.webp$/.test(file));
if (!thumbnails.length) throw new Error('Missing compact tool WebPs. Check the thumbnail budget path.');
const thumbnailBytes = thumbnails.reduce((total, file) => total + statSync(new URL(file, supplies)).size, 0);
check('Compact tool WebPs, combined', thumbnailBytes, 120);
