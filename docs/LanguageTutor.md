# LanguageTutor Class Documentation

A powerful JavaScript class for building language learning applications with real-time pronunciation scoring using OpenAI's Realtime API, server-side pre-generated audio files with speed modes, intelligent history-aware pre-pronunciation, and audible notification bleeps.

## Overview

The `LanguageTutor` class provides a complete solution for language learning applications, featuring:
- Real-time pronunciation scoring via ChatGPT Realtime API
- **Server-side pre-generated audio files** with speed mode support (native vs learning)
- **Intelligent pre-pronunciation** for new phrases based on learning history
- **Audible notification bleeps** to signal when user should speak
- Detailed text-based feedback and commentary with intelligent repetition
- Configurable voice activity detection (VAD)
- Dynamic options management with logging verbosity control
- Automatic session management
- Browser audio recording and playbook

## Quick Start

```javascript
// Initialize with language pair and enhanced audio options
const tutor = new LanguageTutor(statusElement, 'English', 'Spanish', {
    audioPath: 'audio/',      // Path to pre-generated audio files with speed modes
    feedbackThreshold: 7,     // Score ≤ this triggers target pronunciation
    loggingVerbosity: 5,      // Console logging level (0-10)
    enableBleep: true         // Enable audible notification bleeps
});

// Test a phrase translation with learning history for smart pre-pronunciation
const recentResults = [0, 1, 0, 1, 1]; // Example: 3/5 correct attempts
const result = await tutor.test(
    "Hello, how are you?",           // Source text
    "Hola, ¿cómo estás?",           // Target text  
    recentResults,                   // Learning history for smart pronunciation
    10                              // Timeout in seconds
);

console.log(`Score: ${result.score}/10`);
console.log(`Feedback: ${result.commentary}`);

// Clean up when done
tutor.destroy();
```

## Constructor

```javascript
new LanguageTutor(outputElement, sourceLanguage, targetLanguage, options)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `outputElement` | HTMLElement | - | DOM element for displaying status messages |
| `sourceLanguage` | string | `'English'` | Language to translate from (user's native language) |
| `targetLanguage` | string | `'Italian'` | Language to translate to (language being learned) |
| `options` | object | `{}` | Configuration options (see below) |

### Options Object

The `options` parameter accepts the following configuration:

```javascript
const options = {
    // API Configuration
    apiKeyEndpoint: '?mode=get_key',    // Endpoint for fetching OpenAI session keys
    
    // Audio Configuration (Enhanced with Speed Modes)
    audioPath: 'audio/',                // Base path for pre-generated audio files with speed modes
    enableBleep: true,                  // Enable audible notification bleeps
    
    // Feedback Configuration
    feedbackThreshold: 7,               // Score ≤ this triggers target pronunciation
    
    // Logging Configuration
    loggingVerbosity: 5,                // Console logging verbosity (0-10, 0=silent)
    
    // Status Updates
    statusCallback: null,               // Optional callback for status updates
    
    // Voice Activity Detection Settings
    vad: {
        threshold: 0.6,                 // VAD sensitivity (0.0-1.0, higher = more aggressive)
        prefixPaddingMs: 200,           // Time before speech detection starts (ms)
        silenceDurationMs: 800          // Silence duration before stopping listening (ms)
    }
};
```

#### Option Details

**`audioPath`** (string) - **Enhanced with Speed Modes**
- Base path for pre-generated audio files with speed mode directories
- Default: `'audio/'`
- Files expected at: `{audioPath}{language}/{speed_mode}/{filename}.mp3`
- Speed modes: `native` (normal speed) and `learning` (slow/clear)
- Example: `audio/English/native/Good_morning_a1b2c3d4.mp3`

**`enableBleep`** (boolean) - **NEW**
- Enable audible notification bleeps to signal user interaction
- Default: `true`
- Generates pleasant two-tone chime (800Hz → 1000Hz)
- Plays before user is expected to speak

**`feedbackThreshold`** (number)
- Score threshold at or below which target language pronunciation is played back
- Range: 0-10
- Default: `7`
- Uses `≤` comparison so threshold 10 always plays audio
- Scores below 3 trigger **triple repetition** for enhanced learning

**`loggingVerbosity`** (number)
- Console logging verbosity level
- Range: 0-10 (0=silent, 10=very verbose)
- Default: `5`
- Level guidelines:
  - **0**: Silent - no console output
  - **1-3**: Errors and critical warnings only
  - **4-6**: Important events and status updates (recommended)
  - **7-10**: Detailed debugging information

## Core Methods

### `test(sourceText, targetText, recentResults, waitTime)`

Tests user's translation and pronunciation with intelligent pre-pronunciation for new phrases and audible notifications.

**Parameters:**
- `sourceText` (string): Text in source language to be translated
- `targetText` (string): Expected translation in target language  
- `recentResults` (array): Learning history as array of 0s and 1s for smart pronunciation
- `waitTime` (number, optional): Maximum wait time in seconds (default: 10)

**Returns:** 
- `Promise<Object>`: Response object with score, commentary, and stop flag

**Response Object:**
```javascript
{
    score: 8,                    // Number 0-10 (0 = no response detected)
    commentary: "Excellent pronunciation! Your 'gatto' was perfect and 'divano' was very clear. Just watch the stress on 'dormendo' - it should be dor-MEN-do. Overall, great fluency!",
    stop: false                  // Boolean - true if user said stop/pause/enough
}
```

**Enhanced Pre-Pronunciation System:**

The method analyzes learning history to provide intelligent pre-pronunciation:

```javascript
// For brand new phrases (empty recentResults or all zeros)
const result = await tutor.test("Good morning", "Buongiorno", []);
// Flow: 
// 1. 🎵 "New phrase! Listen to this English phrase..."
// 2. 🔊 Plays "Good morning" (normal speed from audio/English/native/)
// 3. 🎵 "Now here's how to say it in Italian..."
// 4. 🔊 Plays "Buongiorno" (slow speed from audio/Italian/learning/)
// 5. 🔊 Plays "Buongiorno" again (repetition for new phrases)
// 6. 🎵 "Now you try! Say it in Italian..."
// 7. 🔔 Pleasant notification bleep
// 8. 🎤 Microphone activates for user input

// For familiar phrases (has some correct attempts)
const result = await tutor.test("Good morning", "Buongiorno", [0,1,1,0,1]);
// Flow:
// 1. 🎵 "Listen to this English phrase..."
// 2. 🔊 Plays "Good morning" (normal speed from audio/English/native/)
// 3. 🎵 "Now say it in Italian..."
// 4. 🔔 Pleasant notification bleep
// 5. 🎤 Microphone activates for user input
```

**History Analysis Logic:**
```javascript
const correctAnswers = recentResults.reduce((sum, result) => sum + result, 0);
const isNewPhrase = correctAnswers === 0;

if (isNewPhrase && recentResults.length === 0) {
    // Brand new phrase - full introduction with both languages
} else {
    // Familiar phrase - standard testing flow
}
```

**Enhanced Feedback System:**
- **Score 0**: No response - queue preservation, same phrase repeats
- **Scores 1-2**: Poor performance → **Triple repetition** with pauses for reinforcement
- **Scores 3-6**: Moderate performance → Single repetition (if ≤ threshold)
- **Scores 7+**: Good performance → No additional feedback (above default threshold)

### `speakText(text, language)`

Plays pre-generated audio file for the specified text and language with automatic speed mode selection.

**Parameters:**
- `text` (string): Text to speak
- `language` (string, optional): Language for pronunciation (auto-detected if omitted)

**Returns:** `Promise<void>`

**Enhanced Features:**
- **Automatic speed mode selection** based on language context
- **Source language** (user's native) → `native` folder (normal speed)
- **Target language** (being learned) → `learning` folder (slow/clear speed)
- **Instant playbook** from server-side audio files
- **SHA-256 filename generation** for consistency
- **Error handling** for missing audio files
- **Zero API costs** during playbook

**Audio File Path Resolution:**
```javascript
// Source language (English for English→Italian learner)
await tutor.speakText("Good morning", "English");
// Loads: audio/English/native/Good_morning_a1b2c3d4.mp3 (normal speed)

// Target language (Italian for English→Italian learner)  
await tutor.speakText("Buongiorno", "Italian");
// Loads: audio/Italian/learning/Buongiorno_a1b2c3d4.mp3 (slow/clear speed)

// Auto-detection works based on configured languages
await tutor.speakText("Hello world");    // Detected as source → normal speed
await tutor.speakText("Ciao mondo");     // Detected as target → slow speed
```

**Example:**
```javascript
// Explicit language with automatic speed selection
await tutor.speakText("Bonjour le monde", "French");

// Auto-detection uses source/target language configuration
await tutor.speakText("Hello world");   // Source language → normal speed
await tutor.speakText("Ciao mondo");    // Target language → slow speed
```

### `playNotificationBleep()`

Generates a pleasant audible notification bleep to signal user interaction.

**Returns:** `Promise<void>`

**Features:**
- **Two-tone chime**: 800Hz for 150ms, then 1000Hz for 150ms
- **Pleasant fade in/out**: Smooth amplitude envelope to avoid harsh clicks
- **Configurable**: Can be disabled via `enableBleep: false` option
- **Graceful fallback**: Continues silently if audio context unavailable
- **Automatic timing**: Plays just before microphone activation

**Usage:**
```javascript
// Manual bleep (usually handled automatically)
await tutor.playNotificationBleep();

// Disable bleeps entirely
const tutor = new LanguageTutor(statusEl, 'English', 'Spanish', {
    enableBleep: false
});
```

### `updateOptions(newOptions)`

Updates tutor configuration during runtime without recreating the instance.

**Parameters:**
- `newOptions` (object): Partial options object with values to update

**Returns:** 
- `Object`: Complete updated options object

**Features:**
- Deep merges new options with existing configuration
- Takes effect immediately
- Logs changes for debugging (respects loggingVerbosity)
- Preserves unspecified options

**Example:**
```javascript
// Update audio and feedback settings
tutor.updateOptions({
    enableBleep: false,           // Disable notification bleeps
    feedbackThreshold: 10,        // Always play pronunciation
    loggingVerbosity: 8          // More detailed logging
});

// Update VAD sensitivity
tutor.updateOptions({
    vad: {
        threshold: 0.8,           // More aggressive
        silenceDurationMs: 500    // Faster timeout
    }
});
```

### `getOptions()`

Retrieves current tutor configuration.

**Returns:** 
- `Object`: Copy of current options (safe to modify without affecting tutor)

### `showScore(score)`

Formats score information for UI display.

**Parameters:**
- `score` (number): Score from 0-10

**Returns:** Object with display information
```javascript
{
    score: 8,
    message: "Excellent work!",
    emoji: "🎉"
}
```

**Score Ranges:**
- 8-10: "Excellent work!" 🎉
- 6-7: "Good job!" 👍  
- 0-5: "Keep practicing!" 📚

### `destroy()`

Cleans up all resources and stops background processes.

## Audio System

### Server-Side Audio with Speed Modes

The LanguageTutor expects pre-generated audio files organized by speed mode:

**Directory Structure:**
```
audio/
├── English/
│   ├── native/                     # Normal speed for native speakers
│   │   ├── Good_morning_a1b2c3d4.mp3
│   │   ├── Where_is_the_bathroom_def45678.mp3
│   │   └── ...
│   └── learning/                   # Slow/clear speed for learners
│       ├── Good_morning_a1b2c3d4.mp3
│       ├── Where_is_the_bathroom_def45678.mp3
│       └── ...
├── Italian/
│   ├── native/                     # Normal speed for native speakers
│   │   ├── Buongiorno_a1b2c3d4.mp3
│   │   ├── Dove___il_bagno_def45678.mp3
│   │   └── ...
│   └── learning/                   # Slow/clear speed for learners
│       ├── Buongiorno_a1b2c3d4.mp3
│       ├── Dove___il_bagno_def45678.mp3
│       └── ...
└── Spanish/
    ├── native/
    └── learning/
```

**Speed Mode Selection Logic:**
```javascript
// Automatic speed mode selection in speakText()
const isNativeLanguage = (language === this.sourceLanguage);
const speedMode = isNativeLanguage ? 'native' : 'learning';

// Examples for English→Italian learner:
// English phrases → audio/English/native/ (normal speed)
// Italian phrases → audio/Italian/learning/ (slow/clear speed)
```

**Filename Generation (SHA-256):**
1. **Sanitize**: First 20 UTF-8 bytes, replace non-alphanumeric with underscores
2. **Hash**: SHA-256 hash of original text, first 8 characters
3. **Format**: `{sanitized}_{hash}.mp3`

**Example:**
- Text: `"Bonjour, comment allez-vous?"`
- Sanitized: `"Bonjour__comment_alle"`
- SHA-256 Hash: `"a1b2c3d4e5f6g7h8..."`
- Short Hash: `"a1b2c3d4"`
- Filename: `"Bonjour__comment_alle_a1b2c3d4.mp3"`

### Notification Bleep System

**Audio Generation:**
```javascript
// Pleasant two-tone bleep generation
const duration = 0.3; // 300ms total
// First tone: 800Hz for 150ms with fade envelope
// Second tone: 1000Hz for 150ms with fade envelope
// 10% amplitude to avoid being intrusive
```

**Integration Points:**
- Plays automatically before user input is expected
- Signals transition from listening to speaking
- Provides clear audio cue for interaction timing
- Works alongside visual status updates

### Language Detection

The class includes intelligent language detection for audio playbook:

```javascript
// Auto-detection algorithm
const englishWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
const words = text.toLowerCase().split(/\s+/);
const englishWordCount = words.filter(word => englishWords.includes(word)).length;

// If >20% of words are common English words → source language
// Otherwise → target language
```

**Examples:**
```javascript
// These would be auto-detected as source language (normal speed)
await tutor.speakText("The cat is sleeping");
await tutor.speakText("I am learning Italian");

// These would be auto-detected as target language (slow speed)  
await tutor.speakText("Il gatto sta dormendo");
await tutor.speakText("Sto imparando l'inglese");
```

## Logging System

### Verbosity Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| **0** | Silent | Production (no console output) |
| **1-2** | Critical errors only | Production error monitoring |
| **3-4** | Errors and warnings | Development/staging |
| **5-6** | Important events | **Default** - normal development |
| **7-8** | Detailed operations | Debugging specific issues |
| **9-10** | Very verbose | Deep debugging |

### Example Log Output

**Level 5 (Default):**
```javascript
🎓 LanguageTutor initialized: English → Italian
🔑 Getting initial session key...
✅ Connected to ChatGPT Realtime API
🎙️ Playing audio for "Good morning" in English
🎯 Speed mode: native (normal speed)
🔊 Loading audio from: audio/English/native/Good_morning_a1b2c3d4.mp3
🎵 Playing notification bleep
📊 Final result returned: {score: 8, commentary: "Excellent...", stop: false}
```

**Level 8 (Verbose):**
```javascript
🎓 LanguageTutor initialized: English → Italian
📋 Options: {audioPath: "audio/", feedbackThreshold: 7, enableBleep: true, ...}
🔑 Getting initial session key...
🔗 Creating new ChatGPT WebSocket connection for testing
📤 Sending prompt to ChatGPT: [full prompt logged]
✅ Session configured successfully
🎙️ New phrase detected! Providing full introduction
🎙️ Playing audio for "Good morning" in English
🎯 Speed mode: native (normal speed)
🔊 Loading audio from: audio/English/native/Good_morning_a1b2c3d4.mp3
▶️ Starting audio playbook
✅ Audio playbook finished
🎙️ Now playing target language: "Buongiorno"
🎯 Speed mode: learning (slow/clear)
🔔 Playing notification bleep before user input
📊 Processed result: {score: 8, commentary: "Excellent...", stop: false}
```

## Advanced Usage Examples

### Basic Smart Learning with Bleeps
```javascript
const tutor = new LanguageTutor(
    document.getElementById('status'),
    'English', 
    'Spanish',
    { 
        audioPath: 'audio/', 
        loggingVerbosity: 5,
        enableBleep: true 
    }
);

// New phrase - gets full introduction with notification bleep
let result = await tutor.test("Hello", "Hola", []);
console.log('New phrase result:', result);

// Practiced phrase - standard flow with bleep
const practiceHistory = [0, 1, 1, 0, 1]; // 3/5 correct
result = await tutor.test("Hello", "Hola", practiceHistory);
console.log('Practice result:', result);

tutor.destroy();
```

### Adaptive Learning with History and Speed Modes
```javascript
class HistoryAwareTutor {
    constructor(phrases) {
        this.phrases = phrases;
        this.history = new Map(); // phrase → [results]
        this.tutor = new LanguageTutor(statusEl, 'English', 'Spanish', {
            audioPath: 'audio/',
            feedbackThreshold: 7,
            enableBleep: true
        });
    }
    
    async practice(phraseKey) {
        const phrase = this.phrases[phraseKey];
        const history = this.history.get(phraseKey) || [];
        
        // LanguageTutor adapts automatically:
        // - Speed modes based on source vs target language
        // - Pre-pronunciation based on history
        // - Notification bleeps for interaction timing
        const result = await this.tutor.test(
            phrase.source, 
            phrase.target, 
            history
        );
        
        if (result.score > 0) {
            // Update history
            const passed = result.score >= 7;
            history.push(passed ? 1 : 0);
            
            // Keep last 20 results
            if (history.length > 20) {
                history.shift();
            }
            
            this.history.set(phraseKey, history);
        }
        
        return result;
    }
}
```

### Production Configuration
```javascript
const tutor = new LanguageTutor(statusEl, 'English', 'French', {
    apiKeyEndpoint: '/api/v1/openai-session',
    audioPath: 'https://cdn.example.com/audio/',  // Speed modes supported
    feedbackThreshold: 8,
    loggingVerbosity: 0,  // Silent for production
    enableBleep: true,    // Keep user interaction signals
    vad: {
        threshold: 0.7,
        prefixPaddingMs: 200,
        silenceDurationMs: 800
    }
});
```

### Development Configuration with Enhanced Debugging
```javascript
const tutor = new LanguageTutor(statusEl, 'English', 'Italian', {
    audioPath: 'audio/',
    feedbackThreshold: 6,     // More audio feedback for testing
    loggingVerbosity: 8,      // Verbose logging
    enableBleep: true,        // Test notification system
    statusCallback: (message) => {
        console.log('Status:', message);
        document.getElementById('debug-status').textContent = message;
    }
});
```

## Integration with Binary Learning Systems

### LearningQueue Integration

```javascript
// LearningQueue provides history in getNextTest()
const phrase = learningQueue.getNextTest();
// Returns: { source, target, category, recentResults: [0,1,1,0,1,...] }

// Pass history to LanguageTutor for intelligent behavior
const result = await tutor.test(
    phrase.source, 
    phrase.target, 
    phrase.recentResults || []
);

// History analysis examples:
// [] or [0,0,0,0,0] → Full introduction with both languages
// [1,1,1,1,1] → Standard testing flow
// [0,1,0,1,1] → Standard testing flow
```

### Smart Learning Flow

```javascript
class SmartLearningSession {
    constructor(queue, tutor) {
        this.queue = queue;
        this.tutor = tutor;
    }
    
    async runSession() {
        while (this.isActive) {
            const phrase = this.queue.getNextTest();
            if (!phrase) break;
            
            // LanguageTutor automatically adapts based on:
            // - phrase.recentResults for smart pre-pronunciation
            // - Source vs target language for speed modes
            // - Notification bleeps for user interaction timing
            const result = await this.tutor.test(
                phrase.source, 
                phrase.target, 
                phrase.recentResults
            );
            
            if (result.stop) break;
            
            // Update queue with new result
            this.queue.scoreCurrentTest(result.score);
        }
    }
}
```

## Legacy Cache Management

The class includes legacy methods for backward compatibility:

### `clearTTSCache()`

Clears any old client-side TTS cache data from previous versions.

**Returns:** `boolean` - Success status

### `getTTSCacheSize()`

Returns minimal cache information (legacy compatibility).

**Returns:** Object with cache information
```javascript
{
    entries: 0,
    chunks: 0,
    sizeBytes: 0,
    sizeMB: 0,
    note: 'Using server-side audio files - no client cache needed'
}
```

## Supported Languages

The class works with any language pair supported by OpenAI's models, provided you have generated the corresponding audio files with speed modes:

- European languages (Spanish, French, German, Italian, Portuguese, Dutch, etc.)
- Asian languages (Chinese, Japanese, Korean, Hindi, etc.)  
- Middle Eastern languages (Arabic, Hebrew, Persian, etc.)
- And many more...

**Note:** You must generate audio files for both speed modes (`native` and `learning`) using the server-side PHP script for each language you want to support.

## Error Handling

The class includes comprehensive error handling:

```javascript
try {
    const result = await tutor.test(sourceText, targetText, recentResults);
    
    if (result.stop) {
        console.log('User stopped practice');
    } else {
        console.log(`Score: ${result.score}/10`);
        console.log(`Commentary: ${result.commentary}`);
    }
} catch (error) {
    console.error('Practice failed:', error.message);
}
```

**Common Error Scenarios:**
- Microphone permission denied
- Network connectivity issues
- OpenAI API rate limits
- Invalid session keys
- Missing audio files (either speed mode)
- Audio playbook failures
- Audio context issues (for notification bleeps)

**Audio File Error Handling:**
```javascript
// If audio file is missing, error is logged and user is notified
🔊 Loading audio from: audio/Italian/learning/Missing_phrase_abc12345.mp3
❌ Error playing audio: Failed to load audio from audio/Italian/learning/Missing_phrase_abc12345.mp3
```

## Browser Compatibility

**Requirements:**
- Modern browser with Web Audio API support
- Microphone access permission
- WebSocket support
- Audio element support for MP3 playbook
- Web Crypto API for SHA-256 hashing

**Tested Browsers:**
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Performance Considerations

### Memory Usage
- **Minimal memory footprint** - no client-side audio caching
- Session keys refresh automatically to prevent expiry
- Audio files loaded on-demand and garbage collected
- History arrays passed by reference (no copying)
- Notification bleeps use temporary audio contexts

### API Costs
- **Zero TTS costs** during learning sessions
- **One-time generation cost** for server-side audio files (both speed modes)
- Only scoring API calls during user practice
- Session key refresh is minimal cost

### Network Usage
- **Reduced bandwidth** - pre-compressed MP3 files
- **Speed mode efficiency** - appropriate audio for context
- **Caching-friendly** - static audio files work with CDNs
- **CDN-compatible** - supports hosted audio paths

## Troubleshooting

### Common Issues

**"Failed to load audio" errors**
- **Likely cause:** Missing server-side audio files for speed modes
- **Solution:** Run PHP script to generate audio files for both `native` and `learning` directories
- **Check:** Verify files exist at expected paths: `audio/Language/native/` and `audio/Language/learning/`

**Pre-pronunciation not working**
- **Likely cause:** History not being passed correctly
- **Solution:** Ensure `recentResults` array is passed to `test()` method
- **Check:** Empty array `[]` or all zeros `[0,0,0,0,0]` should trigger full introduction

**Notification bleeps not playing**
- **Likely cause:** Web Audio API restrictions or disabled option
- **Solution:** Ensure `enableBleep: true` and check browser audio permissions
- **Check:** Look for "Could not play notification bleep" warnings in console

**Wrong audio speed**
- **Likely cause:** Incorrect speed mode directory structure
- **Solution:** Ensure audio files exist in both `native` and `learning` directories
- **Check:** Source language should use `native`, target language should use `learning`

**Feedback threshold not working at value 10**
- **Behavior:** Threshold uses `≤` comparison
- **Expected:** Threshold 10 should always play target pronunciation
- **Check:** Scores 1-10 should all trigger audio when threshold is 10

## Security Considerations

- Session keys are ephemeral (60-second lifespan)
- No API keys stored in client-side code
- Audio data processed in real-time (not stored on client)
- Server-side audio files are static and cacheable
- Web Crypto API used for client-side SHA-256 generation
- Notification bleeps generated locally (no external audio sources)

---

*Built with ❤️ for intelligent language learning*

**Current Version** - Enhanced with speed modes, notification bleeps, and history-aware learning!
