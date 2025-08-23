<!-- App-Refactored.svelte - Complete and Untruncated! -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { LearningQueue } from './LearningQueue.js';
  import { LanguageTutor } from './LanguageTutor.js';
  import { settings } from './settingsStore.js';
  
  // Import our lovely new components
  import LanguageSettings from './LanguageSettings.svelte';
  import DisplaySettings from './DisplaySettings.svelte';
  import AlgorithmSettings from './AlgorithmSettings.svelte';
  import CategoryManager from './CategoryManager.svelte';
  import DeveloperSettings from './DeveloperSettings.svelte';
  import LearningSession from './LearningSession.svelte';
  import QueueDisplay from './QueueDisplay.svelte';
  
  // Core application state
  let showSettings = false;
  let isLearning = false;
  let currentPhrase = null;
  let status = "Ready to start learning!";
  let learningQueue = null;
  let tutor = null;
  let categories = [];
  let upcomingQueue = [];
  let isInitialized = false;
  let heardPronunciation = '';
  
  // Settings from store
  let currentSettings = {};
  
  // Subscribe to settings store
  let previousNativeLanguage = '';
  let previousLearningLanguage = '';
  
  settings.subscribe(value => {
    const oldSettings = currentSettings;
    currentSettings = value;
    
    // Update systems only when language settings change (not other settings)
    if (isInitialized && (
      oldSettings.nativeLanguage !== value.nativeLanguage ||
      oldSettings.learningLanguage !== value.learningLanguage
    )) {
      updateSystems();
    }
  });
  
  const languageOptions = {
    'English': ['Italian', 'Spanish']
    // Future: 'Spanish': ['English'], 'French': ['English', 'German'], etc.
  };
  
  // Derive arrays from the hash
  const nativeLanguages = Object.keys(languageOptions);
  $: learningLanguages = languageOptions[currentSettings.nativeLanguage] || [];
  
  // Reactive computed values
  $: canStart = Object.values(currentSettings.enabledCategories).some(enabled => enabled) &&
                categories.length > 0;
  
  // Reactive updates for tutor and queue options (but not during language changes)
  // LanguageTutor now uses passed-in log function, no need to update loggingVerbosity
  
  // LearningQueue now uses passed-in log function, no need to update loggingVerbosity
  
  $: if (learningQueue && currentSettings.repetitivenessFactor !== undefined && learningQueue.options) {
    learningQueue.updateOptions({ repetitivenessFactor: currentSettings.repetitivenessFactor });
  }
  
  $: if (learningQueue && currentSettings.passThreshold !== undefined && learningQueue.options) {
    learningQueue.updateOptions({ passThreshold: currentSettings.passThreshold });
  }
  
  
  // ========== LOGGING SYSTEM ==========
  function log(level, ...args) {
    if (currentSettings.loggingVerbosity >= level) {
      console.log(...args);
    }
  }
  
  function logError(level, ...args) {
    if (currentSettings.loggingVerbosity >= level) {
      console.error(...args);
    }
  }
  
  function logWarn(level, ...args) {
    if (currentSettings.loggingVerbosity >= level) {
      console.warn(...args);
    }
  }
  
  // ========== LIFECYCLE ==========
  onMount(async () => {
    log(4, '🚀 App mounted, loading settings...');
    
    // Load settings from localStorage
    settings.load();
    
    // Wait a tick for settings to propagate
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Initialize systems
    await initializeSystems();
    
    isInitialized = true;
    log(4, '🎉 App initialization complete');
  });
  
  // Clean up when component is destroyed
  onDestroy(() => {
    log(4, '🧹 App being destroyed, cleaning up...');
    
    // Stop any active learning session to release microphone
    if (isLearning) {
      stopLearningSession();
    }
    
    // Clean up tutor and queue instances
    if (tutor) {
      tutor.destroy();
    }
  });
  
  // ========== SYSTEM INITIALIZATION ==========
  async function initializeSystems() {
    await initializeLearningQueue();
    initializeTutor();
  }
  
  async function updateSystems() {
    // Reinitialize when core settings change
    if (learningQueue || tutor) {
      await initializeLearningQueue();
      initializeTutor();
    }
  }
  
  async function initializeLearningQueue() {
    log(5, '🏗️ Initializing LearningQueue for:', currentSettings.nativeLanguage, '→', currentSettings.learningLanguage);
    
    categories = [];
    
    learningQueue = new LearningQueue(
      currentSettings.nativeLanguage, 
      currentSettings.learningLanguage, 
      'basic', 
      'learning/', 
      {
        passThreshold: currentSettings.passThreshold,
        memoryLength: 20,
        repetitivenessFactor: currentSettings.repetitivenessFactor
      },
      log // Pass the log function to LearningQueue
    );
    
    await learningQueue.init();
    
    const availableCategories = learningQueue.getCategories();
    categories = availableCategories;
    
    // Restore or initialize category preferences
    const newEnabledCategories = {};
    availableCategories.forEach(category => {
      newEnabledCategories[category] = currentSettings.enabledCategories[category] ?? true;
      learningQueue.setCategory(category, newEnabledCategories[category]);
    });
    
    settings.updateSetting('enabledCategories', newEnabledCategories);
    updateUpcomingQueue();
    
    log(5, '✅ LearningQueue initialization complete');
  }
  
  function initializeTutor() {
    tutor = new LanguageTutor(null, currentSettings.nativeLanguage, currentSettings.learningLanguage, {
      apiKeyEndpoint: 'openai.php',
      feedbackThreshold: currentSettings.translationThreshold,
      passThreshold: currentSettings.passThreshold,
      audioPath: 'audio/',
      enableAudioHints: currentSettings.enableAudioHints,
      statusCallback: (message) => {
        if (!currentSettings.showFeedback && isLearning) {
          if (message.includes('Listen to this')) {
            status = `Listen to the ${currentSettings.nativeLanguage} phrase...`;
          } else if (message.includes('Now say it in')) {
            status = `Now say it in ${currentSettings.learningLanguage}...`;
          }
        } else {
          status = message;
        }
      }
    }, log); // Pass the log function to LanguageTutor
  }
  
  // ========== EVENT HANDLERS ==========
  
  function handleCategoryChange(event) {
    const { category, enabled } = event.detail;
    
    // No need to update settings here - binding handles that automatically
    // Just update the LearningQueue
    if (learningQueue) {
      learningQueue.setCategory(category, enabled);
      updateUpcomingQueue();
    }
  }
  
  function handleDebugTest(event) {
    const { action } = event.detail;
    
    if (!learningQueue) {
      log(3, '❌ Debug test failed: no learning queue');
      return;
    }
    
    const phrase = learningQueue.getNextTest();
    if (!phrase) {
      log(3, '❌ Debug test failed: no phrases available');
      return;
    }
    
    // Simulate pass (score 10) or fail (score 0)
    const score = action === 'pass' ? 10 : 0;
    
    log(5, `🐛 Debug ${action}: "${phrase.source}" → "${phrase.target}" (score: ${score})`);
    
    // Score the test directly through the learning queue
    learningQueue.scoreCurrentTest(score);
    updateUpcomingQueue();
    
    status = `Debug ${action}: "${phrase.source}" scored ${score}/10`;
  }
  
  
  function updateUpcomingQueue() {
    if (learningQueue && currentSettings.showUpcomingQueue) {
      upcomingQueue = learningQueue.getTopQueueItems();
      log(7, '📋 Updated upcoming queue:', upcomingQueue.length, 'items');
    }
  }
  
  // ========== LEARNING SESSION ==========
  async function startLearningSession() {
    if (!learningQueue || !tutor) {
      status = "Blimey! Something's gone wrong with the initialisation.";
      return;
    }

    try {
      // Start persistent microphone session to avoid repeated connections
      log(5, '🎓 Starting persistent microphone session for learning');
      await tutor.startLearningSession();
      
      isLearning = true;
      status = "Right then, let's get cracking!";
      
      await runLearningLoop();
    } catch (error) {
      log(2, '❌ Failed to start learning session:', error);
      status = "Couldn't access your microphone. Please check your permissions and try again.";
      isLearning = false;
    }
  }
  
  async function runLearningLoop() {
    while (isLearning) {
      const phrase = learningQueue.getNextTest();
      if (!phrase) {
        status = "No more phrases available! Check your category settings.";
        stopLearningSession();
        break;
      }
      
      log(8, '📋 Got phrase from queue:', phrase);
      log(8, '📊 Phrase recentResults:', phrase.recentResults, 'length:', phrase.recentResults?.length);
      
      currentPhrase = phrase;
      heardPronunciation = ''; // Clear previous heard pronunciation
      status = `Ready to listen to ${currentSettings.nativeLanguage} phrase...`;
      
      if (!isLearning) break;
      
      try {
        const result = await tutor.test(phrase.source, phrase.target, phrase.pronunciation || '', phrase.recentResults || []);
        
        // Capture heard pronunciation from result
        heardPronunciation = result.heardPronunciation || '';
        
        if (result.stop || !isLearning) {
          stopLearningSession();
          break;
        } else if (result.score === 0) {
          status = `No response detected - ${result.commentary}`;
          log(6, `⏳ Pausing ${currentSettings.pauseBetweenTests} seconds before repeating phrase`);
          await new Promise(resolve => setTimeout(resolve, currentSettings.pauseBetweenTests * 1000));
        } else {
          learningQueue.scoreCurrentTest(result.score);
          updateUpcomingQueue();
          
          status = `Score: ${result.score}/10 - ${result.commentary}`;
          
          // Use dynamic pause duration based on performance
          const pauseDuration = getPauseDuration(phrase, result.score);
          log(6, `⏳ Pausing ${pauseDuration} seconds before next phrase`);
          await new Promise(resolve => setTimeout(resolve, pauseDuration * 1000));
        }
      } catch (error) {
        status = "Smeg! Something went wrong with the AI. Try again.";
        stopLearningSession();
        break;
      }
    }
  }
  
  function getPauseDuration(phrase, score) {
    if (!phrase || !phrase.recentResults || phrase.recentResults.length === 0) {
      return currentSettings.pauseBetweenTests;
    }
    
    const successCount = phrase.recentResults.filter(r => r === 1).length;
    const successRate = successCount / phrase.recentResults.length;
    const isStruggling = successRate < 0.25 || score < 4;
    
    return isStruggling ? currentSettings.pauseWhenStruggling : currentSettings.pauseBetweenTests;
  }
  
  
  function stopLearningSession() {
    isLearning = false;
    
    // Stop persistent microphone session
    if (tutor && tutor.isSessionActive()) {
      log(5, '🎓 Stopping persistent microphone session');
      tutor.stopLearningSession();
    }
    
    if (!status.includes('Score:') && !status.includes('commentary')) {
      status = "Learning session stopped. Ready when you are!";
    }
    currentPhrase = null;
  }
  
  function handleStartStop() {
    if (isLearning) {
      stopLearningSession();
    } else {
      startLearningSession();
    }
  }
  
  // ========== SETTINGS UI ==========
  function toggleSettings() {
    showSettings = !showSettings;
  }
  
  // Easter egg: Long press on settings cog for developer settings
  let settingsLongPressTimer = null;
  
  function handleSettingsMouseDown() {
    settingsLongPressTimer = setTimeout(() => {
      settings.updateSetting('showDeveloperSettings', !currentSettings.showDeveloperSettings);
      log(3, '🥚 Developer settings easter egg triggered!', currentSettings.showDeveloperSettings ? 'Enabled' : 'Disabled');
      
      const settingsButton = document.querySelector('.settings-toggle');
      if (settingsButton) {
        settingsButton.style.transform = 'scale(0.95)';
        setTimeout(() => settingsButton.style.transform = '', 150);
      }
    }, 2000);
  }
  
  function handleSettingsMouseUp() {
    if (settingsLongPressTimer) {
      clearTimeout(settingsLongPressTimer);
      settingsLongPressTimer = null;
    }
  }
  
  function handleSettingsMouseLeave() {
    if (settingsLongPressTimer) {
      clearTimeout(settingsLongPressTimer);
      settingsLongPressTimer = null;
    }
  }
  
  // ========== MANAGEMENT ACTIONS ==========
  function resetLearningQueue() {
    if (learningQueue && confirm('Are you sure you want to reset the learning queue? This will clear all progress and start fresh.')) {
      learningQueue.reset();
      
      const availableCategories = learningQueue.getCategories();
      categories = availableCategories;
      
      const newEnabledCategories = {};
      availableCategories.forEach(category => {
        newEnabledCategories[category] = true;
        learningQueue.setCategory(category, true);
      });
      
      settings.updateSetting('enabledCategories', newEnabledCategories);
      updateUpcomingQueue();
      
      status = 'Learning queue reset successfully!';
      setTimeout(() => {
        if (!isLearning) status = "Ready to start learning!";
      }, 3000);
    }
  }
</script>

<main class="app-container">
  <!-- Title -->
  <div class="title">
    <h1>Language Tutor</h1>
    <p>Your personal AI language learning companion</p>
  </div>

  <!-- Learning Session Component -->
  <LearningSession
    {currentPhrase}
    {status}
    {isLearning}
    {canStart}
    showCategory={currentSettings.showCategory}
    showFeedback={currentSettings.showFeedback}
    showExpectedOutput={currentSettings.showExpectedOutput}
    enableAudioHints={currentSettings.enableAudioHints}
    {heardPronunciation}
    {log}
    on:startStop={handleStartStop}
  />

  <!-- Settings Section -->
  <div class="settings-section">
    <button 
      class="settings-toggle" 
      on:click={toggleSettings}
      on:mousedown={handleSettingsMouseDown}
      on:mouseup={handleSettingsMouseUp}
      on:mouseleave={handleSettingsMouseLeave}
      on:touchstart={handleSettingsMouseDown}
      on:touchend={handleSettingsMouseUp}
      title={currentSettings.showDeveloperSettings ? "Developer mode active! Long press again to disable." : "Long press for developer settings"}
    >
      <span class="settings-icon" class:developer-mode={currentSettings.showDeveloperSettings}>⚙️</span>
      Settings
      <span class="chevron-icon">{showSettings ? '⬆️' : '⬇️'}</span>
    </button>

    {#if showSettings}
      <div class="settings-panel">
        <!-- Language Selection -->
        <LanguageSettings
          nativeLanguage={currentSettings.nativeLanguage}
          learningLanguage={currentSettings.learningLanguage}
          {nativeLanguages}
          {learningLanguages}
          loggingVerbosity={currentSettings.loggingVerbosity}
        />

        <!-- Display Options -->
        <DisplaySettings
          bind:showExpectedOutput={currentSettings.showExpectedOutput}
          bind:showCategory={currentSettings.showCategory}
          bind:showFeedback={currentSettings.showFeedback}
          bind:showUpcomingQueue={currentSettings.showUpcomingQueue}
          bind:enableAudioHints={currentSettings.enableAudioHints}
          bind:translationThreshold={currentSettings.translationThreshold}
          bind:pauseBetweenTests={currentSettings.pauseBetweenTests}
          bind:pauseWhenStruggling={currentSettings.pauseWhenStruggling}
          on:updateQueue={updateUpcomingQueue}
        />

        <!-- Algorithm Settings -->
        <AlgorithmSettings
          bind:passThreshold={currentSettings.passThreshold}
          bind:repetitivenessFactor={currentSettings.repetitivenessFactor}
        />

        <!-- Categories -->
        <CategoryManager
          {categories}
          bind:enabledCategories={currentSettings.enabledCategories}
          loggingVerbosity={currentSettings.loggingVerbosity}
          on:categoryChange={handleCategoryChange}
        />
        
        <!-- Management Buttons -->
        <div class="management-section">
          <h3 class="section-header">Management</h3>
          <div class="management-buttons">
<button 
              class="management-btn reset-btn"
              on:click={resetLearningQueue}
              disabled={!learningQueue}
            >
              🔄 Reset Learning Queue
            </button>
          </div>
        </div>

        <!-- Developer Settings -->
        <DeveloperSettings
          showDeveloperSettings={currentSettings.showDeveloperSettings}
          bind:loggingVerbosity={currentSettings.loggingVerbosity}
          on:debugTest={handleDebugTest}
        />
      </div>
    {/if}
  </div>

  <!-- Queue Display Component -->
  <QueueDisplay
    showUpcomingQueue={currentSettings.showUpcomingQueue}
    {upcomingQueue}
  />
</main>

<style>
  /* Developer settings styling */
  .settings-icon.developer-mode {
    color: #8b5cf6;
    text-shadow: 0 0 8px rgba(139, 92, 246, 0.6);
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
</style>
