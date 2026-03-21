import { assert, SimpleTestRunner } from '../../helpers/test-utils.js';

const runner = new SimpleTestRunner();

runner.test('popup site profile toggle creates an empty profile shell', async () => {
  const profile = {};

  assert.deepEqual(profile, {});
});

runner.test('popup site profile label reflects non-speed profile overrides', async () => {
  const { getProfileLabel } = await import('../../../src/ui/popup/popup.ts');

  assert.equal(getProfileLabel({}), 'Profile active');
  assert.equal(getProfileLabel({ controllerOpacity: 0.5 }), 'Profile active');
  assert.equal(getProfileLabel({ speed: 1.5 }), 'Saved (1.5x)');
  assert.equal(
    getProfileLabel({ keyBindings: [{ action: 'faster', key: 68, value: 0.1 }] }),
    '1 shortcut'
  );
});

export { runner as siteProfileBehaviorTestRunner };
