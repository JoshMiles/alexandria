#!/usr/bin/env node
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

function run(cmd, args, label) {
  const spinner = ora(label).start();
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    spinner.fail(chalk.red(`Failed: ${cmd} ${args.join(' ')}`));
    process.exit(result.status);
  }
  spinner.succeed(chalk.green(`Success: ${cmd} ${args.join(' ')}`));
}

console.log(chalk.bold.blue('Running application setup and start...'));

run('npm', ['install'], 'Installing dependencies');
run('npm', ['run', 'clean'], 'Cleaning project');
run('npm', ['run', 'build'], 'Building project');
run('npm', ['start'], 'Starting application'); 