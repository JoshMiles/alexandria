#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Building the application...');

function run(cmd, args, label) {
  console.log(label);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`Failed: ${cmd} ${args.join(' ')}`);
    process.exit(result.status);
  }
  console.log(`Success: ${cmd} ${args.join(' ')}`);
}

run('npm', ['install'], 'Installing dependencies');
run('npx', ['webpack'], 'Building with webpack');

// Copy preload.js to dist/preload.js
const src = path.resolve('preload.js');
const dest = path.resolve('dist', 'preload.js');
fs.copyFileSync(src, dest);
console.log('Copied preload.js to dist/preload.js');

console.log('Build complete.'); 