<!-- LanguageSettings.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { autoSave } from './autoSave.js';
  
  export let nativeLanguage;
  export let learningLanguage;
  export let nativeLanguages;
  export let learningLanguages;
  export let loggingVerbosity = 5;
  
  const dispatch = createEventDispatcher();
  
  function log(level, ...args) {
    if (loggingVerbosity >= level) {
      console.log(...args);
    }
  }
  
</script>

<h3 class="section-header">Language Selection</h3>
<div class="language-grid">
  <div class="form-group">
    <label class="form-label">Native Language</label>
    <select 
      class="form-select" 
      bind:value={nativeLanguage}
      use:autoSave={"nativeLanguage"}
    >
      {#each nativeLanguages as lang}
        <option value={lang}>
          {lang}
        </option>
      {/each}
    </select>
  </div>

  <div class="form-group">
    <label class="form-label">Learning Language</label>
    <select 
      class="form-select" 
      bind:value={learningLanguage}
      use:autoSave={"learningLanguage"}
    >
      {#each learningLanguages as lang}
        <option value={lang}>
          {lang}
        </option>
      {/each}
    </select>
  </div>
</div>

