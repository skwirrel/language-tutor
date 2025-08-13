<!-- DisplaySettings.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { autoSave } from './autoSave.js';
  
  export let showExpectedOutput;
  export let showCategory;
  export let showFeedback;
  export let showUpcomingQueue;
  export let enableAudioHints;
  export let translationThreshold;
  export let pauseBetweenTests;
  export let pauseWhenStruggling;
  
  const dispatch = createEventDispatcher();
  
  function updateQueue() {
    dispatch('updateQueue');
  }
  
</script>

<h3 class="section-header">Display Options</h3>
<div class="display-options-section">
  <div class="display-options-list">
    <label class="category-item">
      <input 
        type="checkbox" 
        class="category-checkbox"
        bind:checked={showCategory}
        use:autoSave={"showCategory"}
      />
      <span class="category-label">Display Category</span>
    </label>
    <label class="category-item">
      <input 
        type="checkbox" 
        class="category-checkbox"
        bind:checked={showFeedback}
        use:autoSave={"showFeedback"}
      />
      <span class="category-label">Display Feedback</span>
    </label>
    <label class="category-item">
      <input 
        type="checkbox" 
        class="category-checkbox"
        bind:checked={showUpcomingQueue}
        on:change={updateQueue}
        use:autoSave={"showUpcomingQueue"}
      />
      <span class="category-label">Show Upcoming Queue</span>
    </label>
    <label class="category-item">
      <input 
        type="checkbox" 
        class="category-checkbox"
        bind:checked={enableAudioHints}
        use:autoSave={"enableAudioHints"}
      />
      <span class="category-label">Enable Audio Hints</span>
    </label>
  </div>
  
  <!-- Expected Output Display Options -->
  <div class="form-group expected-translation-section">
    <label class="form-label" for="expected-output-select">Show Expected Translation</label>
    <select 
      id="expected-output-select"
      class="form-select" 
      bind:value={showExpectedOutput}
      use:autoSave={"showExpectedOutput"}
    >
      <option value="always">Always</option>
      <option value="struggling">Only when struggling</option>
      <option value="never">Never</option>
    </select>
    <p class="setting-description">
      {#if showExpectedOutput === 'always'}
        Expected translation is always shown
      {:else if showExpectedOutput === 'never'}
        Expected translation is never shown - test your memory!
      {:else if showExpectedOutput === 'struggling'}
        Expected translation shown only for phrases with success rate below 25%
      {/if}
    </p>
  </div>
  
  <!-- Translation Threshold Setting -->
  <div class="threshold-setting">
    <label class="form-label">
      Translation Repetition Threshold: {translationThreshold}
      <span class="threshold-description">
        {translationThreshold === 0 ? 'Never repeat translation' : 
         translationThreshold === 10 ? 'Always repeat translation' : 
         `Repeat translation for scores below ${translationThreshold}`}
      </span>
    </label>
    <input 
      type="range" 
      min="0" 
      max="10" 
      step="1"
      bind:value={translationThreshold}
      class="threshold-slider"
      use:autoSave={"translationThreshold"}
    />
    <div class="threshold-labels">
      <span>Never (0)</span>
      <span>Default (7)</span>
      <span>Always (10)</span>
    </div>
  </div>
  
  <!-- Pause Between Tests Setting -->
  <div class="threshold-setting">
    <label class="form-label">
      Pause Between Tests: {pauseBetweenTests}s
      <span class="threshold-description">
        {pauseBetweenTests <= 1 ? 'Quick - brief pause for score review' :
         pauseBetweenTests >= 5 ? 'Slow - plenty of time to read feedback' :
         'Balanced - comfortable time to review your score'}
      </span>
    </label>
    <input 
      type="range" 
      min="0.5" 
      max="10" 
      step="0.5"
      bind:value={pauseBetweenTests}
      class="threshold-slider"
      use:autoSave={"pauseBetweenTests"}
    />
    <div class="threshold-labels">
      <span>Quick (0.5s)</span>
      <span>Default (3s)</span>
      <span>Slow (10s)</span>
    </div>
  </div>
  
  <!-- Pause When Struggling Setting -->
  {#if showExpectedOutput === 'struggling'}
    <div class="threshold-setting">
    <label class="form-label">
      Pause When Struggling: {pauseWhenStruggling}s
      <span class="threshold-description">
        Extra pause time for phrases with low success rate (&lt;25%) or poor scores (&lt;4)
      </span>
    </label>
    <input 
      type="range" 
      min="0.5" 
      max="15" 
      step="0.5"
      bind:value={pauseWhenStruggling}
      class="threshold-slider"
      use:autoSave={"pauseWhenStruggling"}
    />
    <div class="threshold-labels">
      <span>Quick (0.5s)</span>
      <span>Default (5s)</span>
      <span>Extended (15s)</span>
    </div>
    </div>
  {/if}
</div>

<style>
  /* Component-specific styles for DisplaySettings */
  .display-options-list {
    margin-top: 0.5rem;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  @media (min-width: 640px) {
    .display-options-list {
      grid-template-columns: 1fr 1fr;
    }
  }
  
  /* Fieldset and legend styling */
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }
  
  legend {
    padding: 0;
    margin-bottom: 0.5rem;
  }
  
  .expected-translation-section {
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
  }
</style>
