<!-- AlgorithmSettings.svelte -->
<script>
  export let passThreshold;
  export let repetitivenessFactor;
</script>

<div class="algorithm-settings">
  <h3 class="section-header">Learning Algorithm</h3>
  <div class="threshold-setting">
    <label class="form-label">
      Pass Threshold: {passThreshold}
      <span class="threshold-description">
        Scores {passThreshold} and above are considered a pass
      </span>
    </label>
    <input 
      type="range" 
      min="1" 
      max="10" 
      step="1"
      bind:value={passThreshold}
      class="threshold-slider"
    />
    <div class="threshold-labels">
      <span>Easy (1)</span>
      <span>Default (7)</span>
      <span>Hard (10)</span>
    </div>
  </div>
  
  <div class="threshold-setting">
    <label class="form-label">
      Test Repetitiveness: {repetitivenessFactor}
      <span class="threshold-description">
        {repetitivenessFactor <= 3 ? 'Less repetitive - tests advance quickly' :
         repetitivenessFactor >= 8 ? 'Very repetitive - tests stay at front longer' :
         'Balanced repetition'}
      </span>
    </label>
    <input 
      type="range" 
      min="1" 
      max="10" 
      step="1"
      bind:value={repetitivenessFactor}
      class="threshold-slider"
    />
    <div class="threshold-labels">
      <span>Less (1)</span>
      <span>Default (5)</span>
      <span>More (10)</span>
    </div>
  </div>
</div>

<style>
  /* Component-specific styles for AlgorithmSettings */
  .algorithm-settings {
    margin-top: 1rem;
  }
</style>
