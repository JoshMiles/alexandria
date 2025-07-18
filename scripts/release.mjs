#!/usr/bin/env node
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

const bump = process.argv[2] || 'patch';

function run(cmd, args, label) {
  console.log(chalk.yellow(`[DEBUG] Running: ${cmd} ${args.map(a => JSON.stringify(a)).join(' ')}`));
  const useShell = process.platform === 'win32';
  let result;
  if (useShell) {
    // Join command and args into a single string for Windows shell
    const fullCmd = [cmd, ...args].map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ');
    result = spawnSync(fullCmd, { stdio: 'inherit', shell: true });
  } else {
    result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  }
  if (result.status !== 0) {
    console.error(result.error);
    process.exit(result.status);
  }
}

console.log(chalk.bold.blue('Starting release process...'));

run('git', ['add', '.'], 'Staging all changes');
run('git', ['commit', '-m', `chore: prepare for release`], 'Committing staged changes');
run('npm', ['version', bump], `Bumping version with '${bump}'`);
run('git', ['push'], 'Pushing commit');
run('git', ['push', '--tags'], 'Pushing tags');

console.log(chalk.bold.green('Release script complete. Electron Forge and GitHub Actions will handle packaging and release.')); 