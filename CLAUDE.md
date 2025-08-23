# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Language Tutor** - an AI-powered language learning application built with Svelte that uses OpenAI's Realtime API for pronunciation scoring and adaptive spaced repetition for vocabulary retention. The app combines real-time speech recognition, text-to-speech audio playback, and a sophisticated binary learning algorithm.

## Common Development Commands

### Development Server
```bash
npm run dev          # Start development server with live reload
npm run build        # Build for production
npm start            # Serve production build
```

### Dependencies
```bash
npm install          # Install all dependencies
```

## Architecture Overview

### Core Technologies
- **Frontend**: Svelte 3 with component-based architecture
- **Build System**: Rollup with live reload and CSS processing
- **Backend**: PHP scripts for OpenAI API integration and audio generation
- **Audio**: Pre-generated TTS files organized by language and speed
- **State Management**: Reactive Svelte stores with localStorage persistence

### Key Components

#### 1. Main Application (`src/App.svelte`)
- **Role**: System orchestrator and integration layer
- **Manages**: Learning session lifecycle, component communication, system initialization
- **Features**: Centralized logging, reactive settings updates, Easter egg developer mode

#### 2. Core Learning Systems
- **`src/LanguageTutor.js`**: AI-powered speech scoring using OpenAI Realtime API
- **`src/LearningQueue.js`**: Binary spaced repetition algorithm with 20-item memory
- **`src/settingsStore.js`**: Centralized state management with automatic localStorage persistence

#### 3. Component Library (`src/`)
- **`LanguageSettings.svelte`**: Language pair selection with validation
- **`DisplaySettings.svelte`**: UI preferences and timing controls  
- **`AlgorithmSettings.svelte`**: Learning algorithm tuning (hidden developer mode)
- **`CategoryManager.svelte`**: Learning category selection
- **`LearningSession.svelte`**: Current phrase display and session controls
- **`QueueDisplay.svelte`**: Learning queue visualization

#### 4. Backend Services (`public/`)
- **`openai.php`**: Generates ephemeral session tokens for OpenAI Realtime API
- **`config.php`**: Contains OpenAI API key configuration
- **`generate_tts_audio.php`**: Server-side audio file generation script

### File Structure
```
src/
├── App.svelte                 # Main orchestrator
├── settingsStore.js          # Centralized state management
├── LanguageTutor.js          # AI scoring and audio system
├── LearningQueue.js          # Spaced repetition algorithm
├── [Component].svelte        # Focused UI components
└── main.js                   # Svelte initialization

public/
├── learning/                 # JSON language data files
├── audio/                    # Pre-generated TTS organized by language/speed
│   ├── English/native/       # Normal speed pronunciation
│   ├── English/learning/     # Slow/clear pronunciation
│   └── Italian/native|learning/
├── *.php                     # Backend API endpoints
└── build/                    # Production build output
```

## Key Technical Concepts

### 1. Binary Learning Algorithm
- Uses pass/fail scoring (configurable threshold, default 7/10)
- Maintains 20-item memory of recent results per phrase
- Queue movement based on success rate with adjustable repetitiveness factor
- No traditional "levels" - phrases move dynamically based on performance

### 2. Audio System Architecture
- **Pre-generated files**: TTS audio files generated server-side and cached
- **Speed modes**: `native/` (normal speed) and `learning/` (slow/clear) directories
- **Filename generation**: Uses SHA-256 hash + sanitized text for consistent naming
- **Auto-detection**: Language detection based on source/target language context

### 3. OpenAI Integration
- **Realtime API**: WebSocket connection for live speech scoring
- **Session management**: Ephemeral tokens refreshed every 50 seconds
- **Prompt engineering**: Dynamic prompts based on language pair and learning context
- **Voice Activity Detection**: Configurable threshold and silence detection

### 4. State Management Pattern
- **Reactive store**: Svelte writable store with automatic persistence
- **Settings cascade**: Changes trigger system reconfiguration automatically
- **Component communication**: Props down, events up with reactive updates
- **localStorage sync**: All settings changes automatically saved

## Development Guidelines

### Adding New Features
1. **Settings**: Add to `defaultSettings` in `settingsStore.js`
2. **UI**: Create focused component following existing patterns
3. **Integration**: Add reactive handlers in `App.svelte` if needed
4. **Testing**: Use developer mode (long press settings cog) for verbose logging

### Working with Audio
- Audio files are pre-generated server-side using `generate_tts_audio.php`
- Client-side uses filename generation logic matching server-side script
- Audio organized by language and speed mode for optimal learning experience
- No client-side TTS generation - all audio served from `public/audio/`

### Learning Data Format
```javascript
// public/learning/English-Italian-basic.json
{
  "travel": [
    { 
      "source": "Good morning", 
      "target": "Buongiorno", 
      "pronunciation": "bohn-JOHR-no" 
    },
    { 
      "source": "Where is the station?", 
      "target": "Dove è la stazione?",
      "pronunciation": ["DOH-veh eh lah stah-tsee-OH-neh", "DOH-veh eh la sta-TSYO-neh"]
    }
  ],
  "food": [
    { 
      "source": "I would like a coffee", 
      "target": "Vorrei un caffè",
      "pronunciation": "vor-RAY oon kah-FEH"
    }
  ]
}
```

**Pronunciation Field Support:**
- **String format**: Single pronunciation guide (traditional behavior)
- **Array format**: Multiple pronunciation options - the system will test user input against all options and use the highest score
- **Use cases for arrays**: Regional variations, alternative pronunciations, or different emphasis patterns
- **Scoring**: When arrays are used, each option is scored independently and the best match is selected
```

### Component Development Patterns
```javascript
// Standard component structure
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  // Props
  export let someProp;
  export let loggingVerbosity = 5;
  
  // Local state
  let localState = '';
  
  // Event handlers
  function handleChange() {
    dispatch('customEvent', { data: localState });
  }
</script>

<!-- Template with conditional rendering -->
{#if showSomething}
  <div class="component-container">
    <!-- Content -->
  </div>
{/if}

<style>
  /* Component-specific styles */
  .component-container {
    /* Use global CSS classes when possible */
  }
</style>
```

## Configuration and Setup

### Environment Setup
1. Ensure OpenAI API key is configured in `public/config.php`
2. Audio files should be pre-generated using the server-side script
3. Language data files must be present in `public/learning/`

### Developer Mode
- **Access**: Long press (2 seconds) on settings cog
- **Features**: Advanced logging controls, algorithm tuning, system diagnostics
- **Logging levels**: 0=silent, 5=normal, 10=verbose debugging

### Performance Considerations
- **Memory management**: 20-item history limit per phrase prevents unbounded growth
- **Audio caching**: Pre-generated files eliminate real-time TTS latency
- **Component isolation**: Each component manages only its specific concerns
- **Lazy initialization**: Systems initialize only when needed

## Security Notes
- OpenAI API key should be server-side only (in `config.php`)
- Session tokens are ephemeral (60-second expiry) for minimal exposure
- No sensitive data stored in localStorage (only user preferences)
- CORS headers configured for local development

## Common Issues and Solutions

### Audio Playback Issues
- Check that audio files exist in expected directory structure
- Verify filename generation matches server-side logic
- Ensure proper MIME types for MP3 files

### OpenAI Connection Issues  
- Verify API key is valid and has Realtime API access
- Check session token generation in browser network tab
- Monitor WebSocket connection status in console

### Learning Algorithm Tuning
- **Pass threshold**: Lower values (3-5) for struggling learners
- **Repetitiveness factor**: Higher values (7-10) for more repetition
- **Memory length**: Fixed at 20 items for optimal learning curve

This application demonstrates sophisticated integration of modern web technologies with AI services to create an effective language learning experience. The modular architecture allows for easy extension and customization while maintaining performance and user experience quality.