#!/usr/bin/env node
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runNodeScript(script, label) {
  const spinner = ora(label).start();
  const result = spawnSync('node', [path.join(__dirname, script)], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    spinner.fail(chalk.red(`Failed: ${script}`));
    process.exit(result.status);
  }
  spinner.succeed(chalk.green(`Success: ${script}`));
}
function run(cmd, args, label) {
  const spinner = ora(label).start();
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    spinner.fail(chalk.red(`Failed: ${cmd} ${args.join(' ')}`));
    process.exit(result.status);
  }
  spinner.succeed(chalk.green(`Success: ${cmd} ${args.join(' ')}`));
}

console.log(chalk.bold.blue('Quick dev run...'));

run('npm', ['run', 'start'], 'Starting application in development mode'); 