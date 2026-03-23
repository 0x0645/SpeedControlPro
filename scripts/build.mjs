import esbuild from 'esbuild';
import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

const isWatch = process.argv.includes('--watch');
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'dist');

const entryPoints = {
  content: 'src/entries/content-entry.ts',
  inject: 'src/entries/inject-entry.ts',
  background: 'src/background.ts',
  'ui/popup/popup': 'src/ui/popup/popup.ts',
  'ui/options/options': 'src/ui/options/options.ts',
};

const staticCopyTargets = [
  { from: 'manifest.json', to: 'manifest.json' },
  { from: 'src/assets', to: 'assets' },
  {
    from: 'src/ui',
    to: 'ui',
    filter: (sourcePath) => {
      const basename = path.basename(sourcePath);
      return !basename.endsWith('.js') && !basename.endsWith('.ts');
    },
  },
  { from: 'src/styles', to: 'styles' },
  { from: 'LICENSE', to: 'LICENSE' },
  { from: 'CONTRIBUTING.md', to: 'CONTRIBUTING.md' },
  { from: 'PRIVACY.md', to: 'PRIVACY.md' },
  { from: 'README.md', to: 'README.md' },
];

const common = {
  bundle: true,
  sourcemap: isWatch ? 'inline' : false,
  minify: !isWatch,
  target: 'chrome114',
  platform: 'browser',
  legalComments: 'none',
  format: 'iife',
  define: { 'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production') },
};

const tailwindInputs = [
  {
    input: path.join(rootDir, 'src/ui/popup/popup.css'),
    output: path.join(outDir, 'ui/popup/popup.css'),
  },
  {
    input: path.join(rootDir, 'src/ui/options/options.css'),
    output: path.join(outDir, 'ui/options/options.css'),
  },
];

async function resetOutputDirectory() {
  await fs.emptyDir(outDir);
}

async function copyStaticFiles() {
  try {
    for (const target of staticCopyTargets) {
      await fs.copy(path.join(rootDir, target.from), path.join(outDir, target.to), {
        filter: target.filter,
      });
    }

    console.log('✅ Static files copied');
  } catch (error) {
    console.error('❌ Error copying static files:', error);
    process.exit(1);
  }
}

async function buildTailwindStyles() {
  try {
    await Promise.all(
      tailwindInputs.map(({ input, output }) =>
        execFileAsync('pnpm', ['exec', 'tailwindcss', '-i', input, '-o', output, '--minify'], {
          cwd: rootDir,
        })
      )
    );

    console.log('✅ Tailwind UI styles built');
  } catch (error) {
    console.error('❌ Tailwind build failed:', error);
    process.exit(1);
  }
}

function watchTailwindStyles() {
  tailwindInputs.forEach(({ input, output }) => {
    const watcher = spawn('pnpm', ['exec', 'tailwindcss', '-i', input, '-o', output, '--watch'], {
      cwd: rootDir,
      stdio: 'inherit',
    });

    watcher.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ Tailwind watcher exited with code ${code} for ${path.basename(input)}`);
      }
    });
  });
}

async function build() {
  try {
    await resetOutputDirectory();
    await copyStaticFiles();
    await buildTailwindStyles();

    const esbuildConfig = {
      ...common,
      entryPoints,
      outdir: outDir,
    };

    if (isWatch) {
      watchTailwindStyles();
      const ctx = await esbuild.context(esbuildConfig);
      await ctx.watch();
      console.log('🔧 Watching for changes...');
    } else {
      await esbuild.build(esbuildConfig);
      console.log('✅ Build complete');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
