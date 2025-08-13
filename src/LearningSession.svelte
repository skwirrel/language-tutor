<!-- LearningSession.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  
  export let currentPhrase;
  export let status;
  export let isLearning;
  export let canStart;
  export let showCategory;
  export let showFeedback;
  export let showExpectedOutput;
  export let enableAudioHints;
  export let nativeLanguage;
  export let learningLanguage;
  
  const dispatch = createEventDispatcher();
  
  function shouldShowExpectedOutput(phrase) {
    if (showExpectedOutput === 'always') return true;
    if (showExpectedOutput === 'never') return false;
    if (showExpectedOutput === 'struggling') {
      if (!phrase.recentResults || phrase.recentResults.length === 0) {
        return true; // Show for new phrases with no history
      }
      const successCount = phrase.recentResults.filter(r => r === 1).length;
      const successRate = successCount / phrase.recentResults.length;
      return successRate < 0.25;
    }
    return true; // Default fallback
  }
  
  function shouldShowAudioHint(phrase) {
    if (!enableAudioHints || !phrase.recentResults || phrase.recentResults.length === 0) {
      return false;
    }
    
    const successCount = phrase.recentResults.filter(r => r === 1).length;
    const successRate = successCount / phrase.recentResults.length;
    
    // Show hint if: has some correct attempts (> 0) but success rate is less than 50%
    return successCount > 0 && successRate < 0.5;
  }
  
  function handleStartStop() {
    dispatch('startStop');
  }
</script>

<!-- Current Phrase Display -->
<div class="phrase-display">
  {#if currentPhrase}
    <div class="phrase-content">
      {#if showCategory}
        <p class="phrase-category">Category: {currentPhrase.category}</p>
      {/if}
      <p class="phrase-label">Translate this:</p>
      <p class="phrase-text">{currentPhrase.source}</p>
      {#if shouldShowExpectedOutput(currentPhrase)}
        <p class="expected-text">Expected: {currentPhrase.target}</p>
      {/if}
    </div>
  {:else}
    <p class="placeholder-text">Ready to start learning</p>
  {/if}
</div>

<!-- Status Area -->
<div class="status-area">
  {#if showFeedback}
    <p class="status-text">{status}</p>
  {:else if currentPhrase && shouldShowAudioHint(currentPhrase)}
    <p class="status-text">🎯 Here is a hint for you</p>
  {:else if isLearning}
    <p class="status-text">Listening...</p>
  {:else}
    <p class="status-text">Ready to start learning!</p>
  {/if}
</div>

<!-- Start/Stop Button -->
<div class="button-container">
  <button 
    class="start-stop-btn {isLearning ? 'stop-btn' : 'start-btn'}"
    disabled={!canStart && !isLearning}
    on:click={handleStartStop}
  >
    <span class="btn-icon">{isLearning ? '⏹️' : '▶️'}</span>
    {isLearning ? 'Stop Learning' : 'Start Learning'}
  </button>
</div>
