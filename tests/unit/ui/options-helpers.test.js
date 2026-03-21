import { assert, SimpleTestRunner } from '../../helpers/test-utils.js';

const runner = new SimpleTestRunner();

runner.test('options key helpers normalize key labels and force flags', async () => {
  const { keyCodeToLabel, normalizeKeyBindingsForce } =
    await import('../../../src/ui/options/options-key-utils.ts');

  assert.equal(keyCodeToLabel(124), 'F13');
  assert.equal(keyCodeToLabel(null), 'null');

  const normalized = normalizeKeyBindingsForce([
    { action: 'faster', key: 68, value: 0.1, force: 'true', predefined: true },
    { action: 'slower', key: 83, value: 0.1, force: false, predefined: true },
  ]);

  assert.equal(normalized[0].force, true);
  assert.equal(normalized[1].force, false);
});

runner.test('options profile helpers build rows and clone bindings', async () => {
  const { buildProfileKeybindingRow, cloneGlobalBindings } =
    await import('../../../src/ui/options/options-profile-utils.ts');

  const html = buildProfileKeybindingRow({ action: 'display', key: 86, value: 0 }, 0, [
    'display',
    'pause',
  ]);

  assert.true(html.includes('profile-kb-row'));
  assert.true(html.includes('display:none'));

  const cloned = cloneGlobalBindings([{ action: 'faster', key: 68, value: 0.1, predefined: true }]);

  assert.equal(cloned[0].predefined, false);
  assert.equal(cloned[0].action, 'faster');
});

export { runner as optionsHelpersTestRunner };
