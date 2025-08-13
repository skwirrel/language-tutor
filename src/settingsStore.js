// settingsStore.js - Centralised settings management with localStorage persistence
import { writable } from 'svelte/store';

// Default settings
const defaultSettings = {
  // Language Configuration
  nativeLanguage: 'English',
  learningLanguage: 'Italian',
  
  // Display Options
  showExpectedOutput: 'always', // 'always', 'never', 'struggling'
  showCategory: true,
  showFeedback: true,
  showUpcomingQueue: false,
  enableAudioHints: false,
  
  // Audio & Timing Controls
  translationThreshold: 7,
  pauseBetweenTests: 3,
  pauseWhenStruggling: 5,
  
  // Binary Algorithm Controls
  passThreshold: 7,
  repetitivenessFactor: 5,
  
  // Developer Settings
  loggingVerbosity: 5,
  showDeveloperSettings: false,
  
  // Category Preferences
  enabledCategories: {}
};

function createSettingsStore() {
  const { subscribe, set, update } = writable(defaultSettings);
  
  return {
    subscribe,
    
    // Load settings from localStorage
    load: () => {
      if (typeof localStorage === 'undefined') return;
      
      const saved = localStorage.getItem('languageTutorSettings');
      if (saved) {
        try {
          const parsedSettings = JSON.parse(saved);
          update(current => ({ ...current, ...parsedSettings }));
          console.log('✅ Settings loaded from localStorage');
        } catch (error) {
          console.error('❌ Failed to parse saved settings:', error);
        }
      }
    },
    
    // Save settings to localStorage
    save: (settings) => {
      if (typeof localStorage === 'undefined') return;
      
      try {
        localStorage.setItem('languageTutorSettings', JSON.stringify(settings));
        console.log('💾 Settings saved to localStorage');
      } catch (error) {
        console.error('❌ Failed to save settings:', error);
      }
    },
    
    // Update specific setting
    updateSetting: (key, value) => {
      update(current => {
        const newSettings = { ...current, [key]: value };
        
        // Auto-save to localStorage
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('languageTutorSettings', JSON.stringify(newSettings));
          } catch (error) {
            console.error('❌ Failed to save setting:', error);
          }
        }
        
        return newSettings;
      });
    },
    
    // Update multiple settings at once
    updateSettings: (updates) => {
      update(current => {
        const newSettings = { ...current, ...updates };
        
        // Auto-save to localStorage
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('languageTutorSettings', JSON.stringify(newSettings));
          } catch (error) {
            console.error('❌ Failed to save settings:', error);
          }
        }
        
        return newSettings;
      });
    },
    
    // Reset to defaults
    reset: () => {
      set(defaultSettings);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('languageTutorSettings');
      }
    }
  };
}

export const settings = createSettingsStore();
