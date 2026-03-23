import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const zipPath = path.join(distDir, 'videospeed.zip');

async function main() {
  const manifestPath = path.join(distDir, 'manifest.json');

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error('dist/manifest.json not found. Run `npm run build` before `npm run zip`.');
  }

  await fs.remove(zipPath);

  await execFileAsync('zip', ['-r', zipPath, '.'], {
    cwd: distDir,
  });

  console.log(`Extension packaged at ${path.relative(rootDir, zipPath)}`);
}

main().catch((error) => {
  console.error('Failed to create extension zip:', error.message);
  process.exit(1);
});
