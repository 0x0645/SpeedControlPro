/**
 * Settings management for Video Speed Controller
 */

window.VSC = window.VSC || {};

if (!window.VSC.VideoSpeedConfig) {
  class VideoSpeedConfig {
    constructor() {
      this.settings = { ...window.VSC.Constants.DEFAULT_SETTINGS };
      this.pendingSave = null;
      this.saveTimer = null;
      this.SAVE_DELAY = 1000; // 1 second
    }

    /**
     * Load settings from Chrome storage or pre-injected settings
     * @returns {Promise<Object>} Loaded settings
     */
    async load() {
      try {
        // Use StorageManager which handles both contexts automatically
        const storage = await window.VSC.StorageManager.get(window.VSC.Constants.DEFAULT_SETTINGS);

        // Handle key bindings migration/initialization
        this.settings.keyBindings =
          storage.keyBindings || window.VSC.Constants.DEFAULT_SETTINGS.keyBindings;

        if (!storage.keyBindings || storage.keyBindings.length === 0) {
          window.VSC.logger.info('First initialization - setting up default key bindings');
          this.settings.keyBindings = [...window.VSC.Constants.DEFAULT_SETTINGS.keyBindings];
          await this.save({ keyBindings: this.settings.keyBindings });
        }

        // Apply loaded settings
        this.settings.lastSpeed = Number(storage.lastSpeed);
        this.settings.rememberSpeed = Boolean(storage.rememberSpeed);
        this.settings.forceLastSavedSpeed = Boolean(storage.forceLastSavedSpeed);
        this.settings.audioBoolean = Boolean(storage.audioBoolean);
        this.settings.startHidden = Boolean(storage.startHidden);
        this.settings.controllerOpacity = Number(storage.controllerOpacity);
        this.settings.controllerButtonSize = Number(storage.controllerButtonSize);
        this.settings.logLevel = Number(
          storage.logLevel || window.VSC.Constants.DEFAULT_SETTINGS.logLevel
        );

        this.settings.siteProfiles = storage.siteProfiles || {};

        // Ensure display binding exists (for upgrades)
        this.ensureDisplayBinding();

        // Update logger verbosity
        window.VSC.logger.setVerbosity(this.settings.logLevel);

        window.VSC.logger.info('Settings loaded successfully');
        return this.settings;
      } catch (error) {
        window.VSC.logger.error(`Failed to load settings: ${error.message}`);
        return window.VSC.Constants.DEFAULT_SETTINGS;
      }
    }

    /**
     * Save settings to Chrome storage
     * @param {Object} newSettings - Settings to save
     * @returns {Promise<void>}
     */
    async save(newSettings = {}) {
      try {
        // Update in-memory settings immediately
        this.settings = { ...this.settings, ...newSettings };

        // Check if this is a speed-only update that should be debounced
        const keys = Object.keys(newSettings);
        if (keys.length === 1 && keys[0] === 'lastSpeed') {
          // Debounce speed saves
          this.pendingSave = newSettings.lastSpeed;
          
          if (this.saveTimer) {
            clearTimeout(this.saveTimer);
          }
          
          this.saveTimer = setTimeout(async () => {
            const speedToSave = this.pendingSave;
            this.pendingSave = null;
            this.saveTimer = null;
            
            await window.VSC.StorageManager.set({ ...this.settings, lastSpeed: speedToSave });
            window.VSC.logger.info('Debounced speed setting saved successfully');
          }, this.SAVE_DELAY);
          
          return;
        }

        // Immediate save for all other settings
        await window.VSC.StorageManager.set(this.settings);

        // Update logger verbosity if logLevel was changed
        if (newSettings.logLevel !== undefined) {
          window.VSC.logger.setVerbosity(this.settings.logLevel);
        }

        window.VSC.logger.info('Settings saved successfully');
      } catch (error) {
        window.VSC.logger.error(`Failed to save settings: ${error.message}`);
      }
    }

    /**
     * Get a specific key binding
     * @param {string} action - Action name
     * @param {string} property - Property to get (default: 'value')
     * @returns {*} Key binding property value
     */
    getKeyBinding(action, property = 'value') {
      try {
        const binding = this.settings.keyBindings.find((item) => item.action === action);
        return binding ? binding[property] : false;
      } catch (e) {
        window.VSC.logger.error(`Failed to get key binding for ${action}: ${e.message}`);
        return false;
      }
    }

    /**
     * Set a key binding value with validation
     * @param {string} action - Action name
     * @param {*} value - Value to set
     */
    setKeyBinding(action, value) {
      try {
        const binding = this.settings.keyBindings.find((item) => item.action === action);
        if (!binding) {
          window.VSC.logger.warn(`No key binding found for action: ${action}`);
          return;
        }

        // Validate speed-related values to prevent corruption
        if (['reset', 'fast', 'slower', 'faster'].includes(action)) {
          if (typeof value !== 'number' || isNaN(value)) {
            window.VSC.logger.warn(`Invalid numeric value for ${action}: ${value}`);
            return;
          }
        }

        binding.value = value;
        window.VSC.logger.debug(`Updated key binding ${action} to ${value}`);
      } catch (e) {
        window.VSC.logger.error(`Failed to set key binding for ${action}: ${e.message}`);
      }
    }

    /**
     * Get the effective value for a setting, considering site profile override.
     * @param {string} key - Setting key (e.g., 'speed', 'controllerOpacity')
     * @param {string} hostname - Site hostname
     * @returns {*} The effective value (site override or global default)
     */
    getEffectiveSetting(key, hostname) {
      const profile = this.getSiteProfile(hostname);
      const globalKey = key === 'speed' ? 'lastSpeed' : key;
      if (profile && profile[key] !== undefined && profile[key] !== null) {
        return profile[key];
      }
      return this.settings[globalKey];
    }

    /**
     * Get raw sparse site profile.
     * @param {string} hostname
     * @returns {Object|null}
     */
    getSiteProfile(hostname) {
      const profiles = this.settings.siteProfiles || {};
      return profiles[hostname] || null;
    }

    /**
     * Get the fully resolved profile for a site (all settings filled in).
     * @param {string} hostname
     * @returns {Object} Complete settings with site overrides applied
     */
    getResolvedProfile(hostname) {
      const profile = this.getSiteProfile(hostname) || {};
      return {
        speed: profile.speed ?? this.settings.lastSpeed,
        controllerOpacity: profile.controllerOpacity ?? this.settings.controllerOpacity,
        controllerButtonSize: profile.controllerButtonSize ?? this.settings.controllerButtonSize,
        startHidden: profile.startHidden ?? this.settings.startHidden,
        audioBoolean: profile.audioBoolean ?? this.settings.audioBoolean,
        keyBindings: profile.keyBindings ?? this.settings.keyBindings,
      };
    }

    /**
     * Save a site profile (sparse — only overridden keys).
     * @param {string} hostname
     * @param {Object} profileData - Partial profile to merge
     * @returns {Promise<void>}
     */
    async setSiteProfile(hostname, profileData) {
      if (!this.settings.siteProfiles) {
        this.settings.siteProfiles = {};
      }
      const existing = this.settings.siteProfiles[hostname] || {};
      this.settings.siteProfiles[hostname] = { ...existing, ...profileData };
      // Remove null/undefined keys (revert to global)
      for (const [k, v] of Object.entries(this.settings.siteProfiles[hostname])) {
        if (v === null || v === undefined) {
          delete this.settings.siteProfiles[hostname][k];
        }
      }
      // Remove empty profiles entirely
      if (Object.keys(this.settings.siteProfiles[hostname]).length === 0) {
        delete this.settings.siteProfiles[hostname];
      }
      await this.save({ siteProfiles: this.settings.siteProfiles });
      window.VSC.logger.info(`Saved site profile for ${hostname}`);
    }

    /**
     * Remove entire site profile.
     * @param {string} hostname
     * @returns {Promise<void>}
     */
    async removeSiteProfile(hostname) {
      if (this.settings.siteProfiles?.[hostname]) {
        delete this.settings.siteProfiles[hostname];
        await this.save({ siteProfiles: this.settings.siteProfiles });
        window.VSC.logger.info(`Removed site profile for ${hostname}`);
      }
    }

    /**
     * Ensure display binding exists in key bindings
     * @private
     */
    ensureDisplayBinding() {
      if (this.settings.keyBindings.filter((x) => x.action === 'display').length === 0) {
        this.settings.keyBindings.push({
          action: 'display',
          key: 86, // V
          value: 0,
          force: false,
          predefined: true,
        });
      }
    }
  }

  // Create singleton instance
  window.VSC.videoSpeedConfig = new VideoSpeedConfig();

  // Export constructor for testing
  window.VSC.VideoSpeedConfig = VideoSpeedConfig;
}
