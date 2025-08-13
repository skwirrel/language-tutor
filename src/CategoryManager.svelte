<!-- CategoryManager.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { settings } from './settingsStore.js';
  
  export let categories;
  export let enabledCategories;
  export let loggingVerbosity = 5;
  
  const dispatch = createEventDispatcher();
  
  function log(level, ...args) {
    if (loggingVerbosity >= level) {
      console.log(...args);
    }
  }
  
  function handleCategoryToggle(category, enabled) {
    log(6, `🔘 Category toggle: ${category} → ${enabled}`);
    
    // Update the bound enabledCategories object directly
    enabledCategories[category] = enabled;
    // Force reactivity by creating new object reference
    enabledCategories = { ...enabledCategories };
    
    // Save to localStorage (matching the autoSave pattern)
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('languageTutorSettings');
        const settings = saved ? JSON.parse(saved) : {};
        if (!settings.enabledCategories) settings.enabledCategories = {};
        settings.enabledCategories[category] = enabled;
        localStorage.setItem('languageTutorSettings', JSON.stringify(settings));
        console.log(`💾 Saved category ${category}:`, enabled);
      } catch (error) {
        console.error(`Failed to save category ${category}:`, error);
      }
    }
    
    // Dispatch change for LearningQueue updates only
    dispatch('categoryChange', { category, enabled });
  }
</script>

{#if categories.length > 0}
  <h3 class="section-header">Learning Categories</h3>
  <div class="categories-section">
    <div class="categories-list">
      {#each categories as category}
        <label class="category-item">
          <input 
            type="checkbox" 
            class="category-checkbox"
            checked={enabledCategories[category] || false}
            on:change={(e) => handleCategoryToggle(category, e.target.checked)}
          />
          <span class="category-label">{category}</span>
        </label>
      {/each}
    </div>
    
    <!-- Validation Message -->
    {#if !Object.values(enabledCategories).some(enabled => enabled)}
      <div class="error-text">
        At least one category must be enabled to start learning!
      </div>
    {/if}

<style>
  /* Component-specific styles for CategoryManager */
  .categories-section {
    margin-top: 1rem;
  }
  
  .categories-list {
    margin-top: 0.5rem;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  @media (min-width: 640px) {
    .categories-list {
      grid-template-columns: 1fr 1fr;
    }
  }
  
  /* Fieldset styling for categories */
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }
  
  legend {
    padding: 0;
    margin-bottom: 0.5rem;
  }
</style>
  </div>
{/if}
