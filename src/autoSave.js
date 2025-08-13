// autoSave.js - Reusable Svelte action for auto-saving settings to localStorage

export function autoSave(node, settingName) {
  function handleChange(event) {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    
    if (settingName && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('languageTutorSettings');
        const settings = saved ? JSON.parse(saved) : {};
        settings[settingName] = value;
        localStorage.setItem('languageTutorSettings', JSON.stringify(settings));
        console.log(`💾 Saved ${settingName}:`, value);
      } catch (error) {
        console.error(`Failed to save ${settingName}:`, error);
      }
    }
  }
  
  node.addEventListener('change', handleChange);
  
  return {
    destroy() {
      node.removeEventListener('change', handleChange);
    }
  };
}