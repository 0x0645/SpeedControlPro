// Message type constants
const MessageTypes = {
  SET_SPEED: 'VSC_SET_SPEED',
  ADJUST_SPEED: 'VSC_ADJUST_SPEED',
  RESET_SPEED: 'VSC_RESET_SPEED',
  TOGGLE_DISPLAY: 'VSC_TOGGLE_DISPLAY',
  GET_SITE_INFO: 'VSC_GET_SITE_INFO'
};

let preferredSpeed = 1.0;

document.addEventListener("DOMContentLoaded", function () {
  loadSettingsAndInitialize();
  initializeSiteSpeed();

  document.querySelector("#config").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });

  document.querySelector("#disable").addEventListener("click", function () {
    const isCurrentlyEnabled = !this.classList.contains("disabled");
    toggleEnabled(!isCurrentlyEnabled, settingsSavedReloadMessage);
  });

  chrome.storage.sync.get({ enabled: true }, function (storage) {
    toggleEnabledUI(storage.enabled);
  });

  function toggleEnabled(enabled, callback) {
    chrome.storage.sync.set({ enabled: enabled }, function () {
      toggleEnabledUI(enabled);
      if (callback) callback(enabled);
    });
  }

  function toggleEnabledUI(enabled) {
    const disableBtn = document.querySelector("#disable");
    disableBtn.classList.toggle("disabled", !enabled);
    disableBtn.title = enabled ? "Disable Extension" : "Enable Extension";

    const suffix = enabled ? "" : "_disabled";
    chrome.action.setIcon({
      path: {
        "19": chrome.runtime.getURL(`assets/icons/icon19${suffix}.png`),
        "38": chrome.runtime.getURL(`assets/icons/icon38${suffix}.png`),
        "48": chrome.runtime.getURL(`assets/icons/icon48${suffix}.png`)
      }
    });

    chrome.runtime.sendMessage({ type: 'EXTENSION_TOGGLE', enabled: enabled });
  }

  function settingsSavedReloadMessage(enabled) {
    setStatusMessage(`${enabled ? "Enabled" : "Disabled"}. Reload page.`);
  }

  function setStatusMessage(str) {
    const el = document.querySelector("#status");
    el.classList.toggle("hide", false);
    el.innerText = str;
  }

  // Update hero speed display and active preset
  function updateSpeedUI(speed) {
    const display = document.getElementById("speed-display");
    if (display) {
      display.textContent = Number(speed).toFixed(2);
    }

    // Highlight matching preset
    document.querySelectorAll(".preset-btn").forEach(btn => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      btn.classList.toggle("active", Math.abs(btnSpeed - speed) < 0.01);
    });
  }

  function loadSettingsAndInitialize() {
    chrome.storage.sync.get(null, function (storage) {
      let slowerStep = 0.1;
      let fasterStep = 0.1;

      if (storage.keyBindings && Array.isArray(storage.keyBindings)) {
        const slowerBinding = storage.keyBindings.find(kb => kb.action === "slower");
        const fasterBinding = storage.keyBindings.find(kb => kb.action === "faster");
        const fastBinding = storage.keyBindings.find(kb => kb.action === "fast");

        if (slowerBinding && typeof slowerBinding.value === 'number') slowerStep = slowerBinding.value;
        if (fasterBinding && typeof fasterBinding.value === 'number') fasterStep = fasterBinding.value;
        if (fastBinding && typeof fastBinding.value === 'number') preferredSpeed = fastBinding.value;
      }

      // Set button delta data
      const decreaseBtn = document.querySelector("#speed-decrease");
      if (decreaseBtn) decreaseBtn.dataset.delta = -slowerStep;
      const increaseBtn = document.querySelector("#speed-increase");
      if (increaseBtn) increaseBtn.dataset.delta = fasterStep;

      initializeSpeedControls();

      // Query actual speed from the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: MessageTypes.GET_SITE_INFO }, function (response) {
            const speed = (response && response.speed) || storage.lastSpeed || 1.0;
            updateSpeedUI(speed);
          });
        } else {
          updateSpeedUI(storage.lastSpeed || 1.0);
        }
      });
    });
  }

  function initializeSpeedControls() {
    document.querySelector("#speed-decrease").addEventListener("click", function () {
      adjustSpeed(parseFloat(this.dataset.delta));
    });

    document.querySelector("#speed-increase").addEventListener("click", function () {
      adjustSpeed(parseFloat(this.dataset.delta));
    });

    document.getElementById("speed-display").addEventListener("click", function () {
      setSpeed(preferredSpeed);
    });

    document.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        setSpeed(parseFloat(this.dataset.speed));
      });
    });
  }

  function setSpeed(speed) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MessageTypes.SET_SPEED,
          payload: { speed: speed }
        });
        updateSpeedUI(speed);
        updateSiteSpeedDisplay(speed);
      }
    });
  }

  function adjustSpeed(delta) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MessageTypes.ADJUST_SPEED,
          payload: { delta: delta }
        });
        setTimeout(function () {
          chrome.tabs.sendMessage(tabs[0].id, { type: MessageTypes.GET_SITE_INFO }, function (response) {
            if (response && response.speed) {
              updateSpeedUI(response.speed);
              updateSiteSpeedDisplay(response.speed);
            }
          });
        }, 100);
      }
    });
  }

  function updateSiteSpeedDisplay(speed) {
    const labelEl = document.getElementById("site-speed-label");
    const toggleBtn = document.getElementById("site-speed-toggle");
    if (!toggleBtn || !toggleBtn.classList.contains("active")) return;
    const hostname = document.getElementById("site-hostname").textContent;
    chrome.storage.sync.get({ siteProfiles: {} }, function (storage) {
      const savedSpeed = (storage.siteProfiles || {})[hostname]?.speed;
      if (savedSpeed !== undefined) {
        labelEl.textContent = `Saved (${savedSpeed}x)`;
      }
    });
  }

  // Per-site profile management
  function initializeSiteSpeed() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0] || !tabs[0].url) return;

      let hostname;
      try { hostname = new URL(tabs[0].url).hostname; } catch (e) { return; }

      const hostnameEl = document.getElementById("site-hostname");
      const toggleBtn = document.getElementById("site-speed-toggle");
      const labelEl = document.getElementById("site-speed-label");

      hostnameEl.textContent = hostname;

      chrome.storage.sync.get({ siteProfiles: {} }, function (storage) {
        const profiles = storage.siteProfiles || {};
        const hasProfile = profiles[hostname] !== undefined;

        if (hasProfile) {
          toggleBtn.classList.add("active");
          const savedSpeed = profiles[hostname].speed;
          labelEl.textContent = savedSpeed !== undefined ? `Saved (${savedSpeed}x)` : 'Profile active';
        } else {
          toggleBtn.classList.remove("active");
          labelEl.textContent = "Save for this site";
        }
      });

      toggleBtn.addEventListener("click", function () {
        chrome.storage.sync.get({ siteProfiles: {} }, function (storage) {
          const profiles = storage.siteProfiles || {};
          const hasProfile = profiles[hostname] !== undefined;

          if (hasProfile) {
            delete profiles[hostname];
            chrome.storage.sync.set({ siteProfiles: profiles }, function () {
              toggleBtn.classList.remove("active");
              labelEl.textContent = "Save for this site";
            });
          } else {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'VSC_GET_SITE_INFO' }, function (response) {
              const currentSpeed = (response && response.speed) || 1.0;
              profiles[hostname] = { speed: currentSpeed };
              chrome.storage.sync.set({ siteProfiles: profiles }, function () {
                toggleBtn.classList.add("active");
                labelEl.textContent = `Saved (${currentSpeed}x)`;
              });
            });
          }
        });
      });
    });
  }
});
