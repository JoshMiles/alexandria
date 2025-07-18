#!/usr/bin/env node
import { spawnSync } from 'child_process';

console.log('Cleaning the project...');

function rimraf(target, label) {
  console.log(label);
  const result = spawnSync('npx', ['rimraf', target], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`Failed to remove: ${target}`);
  } else {
    console.log(`Removed: ${target}`);
  }
}

rimraf('node_modules', 'Removing node_modules');
rimraf('dist', 'Removing dist');
rimraf('out', 'Removing out');
rimraf('node_modules/.cache/webpack', 'Removing webpack cache');

console.log('Clean complete.'); 