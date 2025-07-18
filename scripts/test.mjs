#!/usr/bin/env node
import { spawnSync } from 'child_process';
import path from 'path';

console.log('Running test script...');

function runNodeScript(script, label) {
  console.log(label);
  const result = spawnSync('node', [path.join(__dirname, script)], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`Failed: ${script}`);
    process.exit(result.status);
  }
  console.log(`Success: ${script}`);
}
function run(cmd, args, label) {
  console.log(label);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`Failed: ${cmd} ${args.join(' ')}`);
    process.exit(result.status);
  }
  console.log(`Success: ${cmd} ${args.join(' ')}`);
}

runNodeScript('clean.mjs', 'Cleaning project');
runNodeScript('build.mjs', 'Building project');
run('npm', ['test'], 'Running tests');

console.log('Test script complete.'); 