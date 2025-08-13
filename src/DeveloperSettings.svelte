<!-- DeveloperSettings.svelte -->
<script>
  export let showDeveloperSettings;
  export let loggingVerbosity;
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

{#if showDeveloperSettings}
  <div class="developer-settings">
    <h3 class="section-header">🛠️ Developer Settings</h3>
    <div class="threshold-setting developer-setting">
      <label class="form-label">
        Console Logging Verbosity: {loggingVerbosity}
        <span class="threshold-description">
          {loggingVerbosity === 0 ? 'Silent - no console output' :
           loggingVerbosity <= 3 ? 'Quiet - errors and warnings only' :
           loggingVerbosity <= 6 ? 'Normal - important events' :
           'Verbose - detailed debugging info'}
        </span>
      </label>
      <input 
        type="range" 
        min="0" 
        max="10" 
        step="1"
        bind:value={loggingVerbosity}
        class="threshold-slider"
      />
      <div class="threshold-labels">
        <span>Silent (0)</span>
        <span>Default (5)</span>
        <span>Verbose (10)</span>
      </div>
      
      <!-- Debug Testing Buttons -->
      <div class="debug-buttons">
        <button 
          class="debug-btn pass-btn"
          on:click={() => dispatch('debugTest', { action: 'pass' })}
        >
          ✅ Pass Next Test
        </button>
        <button 
          class="debug-btn fail-btn"
          on:click={() => dispatch('debugTest', { action: 'fail' })}
        >
          ❌ Fail Next Test
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Component-specific styles for DeveloperSettings */
  .developer-settings {
    margin-top: 1.5rem;
  }
  
  .developer-setting {
    border: 2px dashed #8b5cf6;
    background: rgba(139, 92, 246, 0.05);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1rem;
  }
  
  .debug-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  
  .debug-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
  }
  
  .pass-btn {
    background: #10b981;
    color: white;
  }
  
  .pass-btn:hover {
    background: #059669;
  }
  
  .fail-btn {
    background: #ef4444;
    color: white;
  }
  
  .fail-btn:hover {
    background: #dc2626;
  }
</style>