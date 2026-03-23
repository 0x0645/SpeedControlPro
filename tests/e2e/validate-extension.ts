#!/usr/bin/env node

/**
 * Extension validation script - checks extension files and structure
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionRoot = join(__dirname, '../../');

function validateExtension(): boolean {
  console.log('🔍 Validating Video Speed Controller Extension Structure\n');

  let passed = 0;
  let failed = 0;

  const test = (name: string, condition: boolean, details = ''): void => {
    if (condition) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}${details ? `: ${details}` : ''}`);
      failed++;
    }
  };

  test('manifest.json exists', existsSync(join(extensionRoot, 'manifest.json')));
  test('inject.css exists', existsSync(join(extensionRoot, 'src/styles/inject.css')));
  test('shadow.css exists', existsSync(join(extensionRoot, 'src/styles/shadow.css')));

  test('dist/content.js exists', existsSync(join(extensionRoot, 'dist/content.js')));
  test('dist/inject.js exists', existsSync(join(extensionRoot, 'dist/inject.js')));
  test('dist/background.js exists', existsSync(join(extensionRoot, 'dist/background.js')));
  test('dist/popup.js exists', existsSync(join(extensionRoot, 'dist/popup.js')));
  test('dist/options.js exists', existsSync(join(extensionRoot, 'dist/options.js')));

  test('src/content/inject.ts exists', existsSync(join(extensionRoot, 'src/content/inject.ts')));
  test('src/core/ directory exists', existsSync(join(extensionRoot, 'src/core')));
  test('src/utils/ directory exists', existsSync(join(extensionRoot, 'src/utils')));
  test('src/ui/ directory exists', existsSync(join(extensionRoot, 'src/ui')));

  test('VideoController exists', existsSync(join(extensionRoot, 'src/core/video-controller.ts')));
  test('Settings module exists', existsSync(join(extensionRoot, 'src/core/settings.ts')));
  test('ActionHandler exists', existsSync(join(extensionRoot, 'src/core/action-handler.ts')));
  test('ShadowDOM manager exists', existsSync(join(extensionRoot, 'src/ui/shadow-dom.ts')));

  try {
    const manifest = JSON.parse(readFileSync(join(extensionRoot, 'manifest.json'), 'utf8'));

    test('Manifest version is 3', manifest.manifest_version === 3);
    test(
      'Content scripts defined',
      manifest.content_scripts && manifest.content_scripts.length > 0
    );
    test(
      'Content script uses bundled file',
      manifest.content_scripts[0].js && manifest.content_scripts[0].js[0] === 'dist/content.js'
    );
    test(
      'Required permissions present',
      manifest.permissions && manifest.permissions.includes('storage')
    );
    test(
      'Content script matches all sites',
      manifest.content_scripts[0].matches &&
        manifest.content_scripts[0].matches.includes('https://*/*')
    );
  } catch (error) {
    test('Manifest.json is valid JSON', false, (error as Error).message);
  }

  try {
    const injectScript = readFileSync(join(extensionRoot, 'src/content/inject.ts'), 'utf8');

    test('Inject script exports VSC_controller', injectScript.includes('window.VSC_controller'));
    test('Inject script initializes extension', injectScript.includes('initialize'));
  } catch (error) {
    test('Inject script readable', false, (error as Error).message);
  }

  try {
    const manifest = JSON.parse(readFileSync(join(extensionRoot, 'manifest.json'), 'utf8'));
    const manifestStr = JSON.stringify(manifest);
    test('No reference to injector.js', !manifestStr.includes('injector.js'));
    test('No reference to module-loader.js', !manifestStr.includes('module-loader.js'));
  } catch {
    test('Manifest clean of old files', false);
  }

  test('Unit tests exist', existsSync(join(extensionRoot, 'tests/unit')));
  test('Integration tests exist', existsSync(join(extensionRoot, 'tests/integration')));
  test('E2E tests exist', existsSync(join(extensionRoot, 'tests/e2e')));

  try {
    const packageJson = JSON.parse(readFileSync(join(extensionRoot, 'package.json'), 'utf8'));

    test('Test scripts defined', packageJson.scripts && packageJson.scripts.test);
    test('E2E test script defined', packageJson.scripts && packageJson.scripts['test:e2e']);
    test('Type is module', packageJson.type === 'module');
  } catch {
    test('Package.json is valid', false);
  }

  console.log('\n📊 Validation Summary');
  console.log('=====================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 Extension structure is valid and ready for testing!');
    console.log('\n📋 Next Steps:');
    console.log('1. Load extension in Chrome (chrome://extensions/ → Load unpacked)');
    console.log('2. Navigate to: https://www.youtube.com/watch?v=gGCJOTvECVQ');
    console.log('3. Verify speed controller appears on video');
    console.log('4. Test speed controls and keyboard shortcuts');
    console.log('\nSee tests/e2e/manual-test-guide.md for detailed testing instructions.');
  } else {
    console.log('\n⚠️ Please fix the failed validation items before testing.');
  }

  return failed === 0;
}

const isValid = validateExtension();
process.exit(isValid ? 0 : 1);
