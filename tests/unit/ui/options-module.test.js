import { describe, it, expect } from 'vitest';

describe('Options Module', () => {
  it('options module loads without throwing', async () => {
    document.body.innerHTML = `
      <div id="customs"></div>
      <input id="rememberSpeed" type="checkbox" />
      <input id="forceLastSavedSpeed" type="checkbox" />
      <input id="audioBoolean" type="checkbox" />
      <input id="startHidden" type="checkbox" />
      <input id="controllerOpacity" value="0.3" />
      <input id="controllerButtonSize" value="14" />
      <select id="logLevel"><option value="3">Warning</option></select>
      <textarea id="blacklist"></textarea>
      <button id="save"></button>
      <button id="add"></button>
      <button id="restore"></button>
      <button id="experimental"></button>
      <button id="site-profile-add-btn"></button>
      <button id="about"></button>
      <button id="feedback"></button>
      <div id="site-profile-list"></div>
      <input id="site-profile-hostname" />
      <div id="status"></div>
    `;

    const mod = await import('../../../src/ui/options/options.ts');

    expect(!!mod).toBe(true);
  });
});
