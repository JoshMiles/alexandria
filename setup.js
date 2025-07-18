#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process');
const path = require('path');

function checkCommand(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runInstall(dir) {
  console.log(`\nInstalling dependencies in ${dir}...`);
  const result = spawnSync('npm', ['install'], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`\nFailed to install dependencies in ${dir}.`);
    process.exit(result.status);
  }
}

console.log('Alexandria Project Setup Script');
console.log('--------------------------------');

if (!checkCommand('node')) {
  console.error('Error: Node.js is not installed. Please install Node.js from https://nodejs.org/ and try again.');
  process.exit(1);
}
if (!checkCommand('npm')) {
  console.error('Error: npm is not installed. Please install npm (comes with Node.js) and try again.');
  process.exit(1);
}

console.log('Node.js and npm found.');

// Install root dependencies
runInstall(process.cwd());

// Install gh-pages dependencies
runInstall(path.join(process.cwd(), 'gh-pages'));

console.log('\nSetup complete!');
console.log('You can now start developing.');
console.log('For the main app, use: npm start or npm run ...');
console.log('For the gh-pages frontend, cd gh-pages and use: npm run dev'); 