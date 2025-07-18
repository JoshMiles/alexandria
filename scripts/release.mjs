#!/usr/bin/env node
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

const bump = process.argv[2] || 'patch';

function run(cmd, args, label) {
  const spinner = ora(label).start();
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    spinner.fail(chalk.red(`Failed: ${cmd} ${args.join(' ')}`));
    process.exit(result.status);
  }
  spinner.succeed(chalk.green(`Success: ${cmd} ${args.join(' ')}`));
}

console.log(chalk.bold.blue('Starting release process...'));

run('git', ['add', '.'], 'Staging all changes');
run('npm', ['version', bump, '-m', 'chore(release): %s'], `Bumping version with '${bump}'`);
run('git', ['push'], 'Pushing commit');
run('git', ['push', '--tags'], 'Pushing tags');

console.log(chalk.bold.green('Release script complete. Electron Forge and GitHub Actions will handle packaging and release.')); 