#!/usr/bin/env node
import { spawnSync } from 'child_process';

console.log('Packaging the application...');

console.log('Running npm run make');
const result = spawnSync('npm', ['run', 'make'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) {
  console.error('Failed to package application.');
  process.exit(result.status);
}
console.log('Application packaged successfully.');

console.log('Package script complete.'); 