/**
 * LanguageTutor - AI-Powered Language Learning with Real-time Pronunciation Scoring
 * 
 * A powerful JavaScript class for building language learning applications with real-time 
 * pronunciation scoring and text-to-speech feedback using OpenAI's Realtime API.
 * Enhanced with audible notification bleeps for user interaction prompts.
 */

import { PronunciationScorer } from './pronunciationScorer.js';

export class LanguageTutor {
    constructor(outputElement, sourceLanguage = 'English', targetLanguage = 'Italian', options = {}, logFunction = null) {
        // Basic configuration
        this.outputElement = outputElement;
        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;
        this.log = logFunction || ((level, ...args) => {}); // Use provided log function or no-op
        
        // Default options
        const defaultOptions = {
            apiKeyEndpoint: '?mode=get_key',
            feedbackThreshold: 7,  // Score below which target pronunciation is played
            passThreshold: 7,      // Score threshold for determining pass/fail (for audio feedback)
            statusCallback: null,  // Optional callback for status updates
            audioPath: 'audio/',   // Base path for pre-generated audio files
            enableBleep: true,     // Enable audible notification bleep (NEW)
            enableAudioHints: false, // Enable audio hints for struggling phrases
            audioHintDuration: 0.25, // Fraction of audio to play as hint (0.25 = 25%)
            audioHintMinWords: 3,    // Minimum words in phrase to enable hints
            vad: {
                threshold: 0.6,
                prefixPaddingMs: 200,
                silenceDurationMs: 800
            }
        };
        
        // Merge user options with defaults
        this.options = this.mergeOptions(defaultOptions, options);
        
        // Audio state
        this.audioContext = null;
        this.currentAudioStream = null;
        this.audioProcessor = null;
        this.ws = null;
        this.isListening = false;
        this.isLearningSessionActive = false; // Track if we're in a learning session
        
        // Session key management
        this.currentSessionKey = null;
        this.keyRefreshInterval = null;
        
        // Initialize pronunciation scorer
        this.pronunciationScorer = new PronunciationScorer();
        
        this.log(3, `🎓 LanguageTutor initialized: ${sourceLanguage} → ${targetLanguage}`);
        this.log(7, '📋 Options:', this.options);
        
        // Start session key management
        this.initializeSessionKeys();
    }
    
    // ========== LOGGING SYSTEM ==========
    
    // Error and warning logging also use the passed-in log function
    
    // ========== UTILITY METHODS ==========
    mergeOptions(defaults, userOptions) {
        const merged = { ...defaults };
        
        for (const key in userOptions) {
            if (userOptions.hasOwnProperty(key)) {
                if (typeof userOptions[key] === 'object' && userOptions[key] !== null && !Array.isArray(userOptions[key])) {
                    // Deep merge for nested objects like 'vad'
                    merged[key] = { ...defaults[key], ...userOptions[key] };
                } else {
                    merged[key] = userOptions[key];
                }
            }
        }
        
        return merged;
    }
    
    // ========== AUDIO NOTIFICATION SYSTEM (NEW) ==========
    /**
     * Generate a pleasant notification bleep to signal user interaction
     */
    async playNotificationBleep() {
        if (!this.options.enableBleep) {
            this.log(7, '🔇 Notification bleep disabled');
            return;
        }
        
        try {
            this.log(6, '🎵 Playing notification bleep');
            
            // Create a temporary audio context for the bleep
            const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create a pleasant two-tone bleep (like a gentle chime)
            const duration = 0.3; // 300ms total
            const sampleRate = tempAudioContext.sampleRate;
            const buffer = tempAudioContext.createBuffer(1, duration * sampleRate, sampleRate);
            const data = buffer.getChannelData(0);
            
            // Generate a pleasant two-tone bleep: 800Hz then 1000Hz
            for (let i = 0; i < buffer.length; i++) {
                const time = i / sampleRate;
                let frequency;
                let amplitude;
                
                if (time < 0.15) {
                    // First tone: 800Hz
                    frequency = 800;
                    amplitude = 0.1 * Math.sin(Math.PI * time / 0.15); // Fade in/out
                } else {
                    // Second tone: 1000Hz  
                    frequency = 1000;
                    amplitude = 0.1 * Math.sin(Math.PI * (time - 0.15) / 0.15); // Fade in/out
                }
                
                data[i] = amplitude * Math.sin(2 * Math.PI * frequency * time);
            }
            
            // Play the bleep
            const source = tempAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(tempAudioContext.destination);
            
            return new Promise((resolve) => {
                source.onended = () => {
                    tempAudioContext.close();
                    this.log(7, '✅ Notification bleep completed');
                    resolve();
                };
                
                source.start();
            });
            
        } catch (error) {
            this.log(4, '⚠️ Could not play notification bleep:', error.message);
            // Don't throw - this is a nice-to-have feature
        }
    }
    
    /**
     * Play a success feedback bleep (ascending tones)
     */
    async playSuccessBleep() {
        if (!this.options.enableBleep) {
            this.log(7, '🔇 Success bleep disabled');
            return;
        }
        
        try {
            this.log(6, '🎵 Playing success bleep');
            
            const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            const duration = 0.25; // 250ms
            const sampleRate = tempAudioContext.sampleRate;
            const buffer = tempAudioContext.createBuffer(1, duration * sampleRate, sampleRate);
            const data = buffer.getChannelData(0);
            
            // Generate ascending success tones: 600Hz -> 800Hz -> 1000Hz
            for (let i = 0; i < buffer.length; i++) {
                const time = i / sampleRate;
                let frequency;
                let amplitude = 0.08; // Slightly quieter than notification
                
                if (time < 0.08) {
                    frequency = 600;
                    amplitude *= Math.sin(Math.PI * time / 0.08);
                } else if (time < 0.16) {
                    frequency = 800;
                    amplitude *= Math.sin(Math.PI * (time - 0.08) / 0.08);
                } else {
                    frequency = 1000;
                    amplitude *= Math.sin(Math.PI * (time - 0.16) / 0.09);
                }
                
                data[i] = amplitude * Math.sin(2 * Math.PI * frequency * time);
            }
            
            const source = tempAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(tempAudioContext.destination);
            
            return new Promise((resolve) => {
                source.onended = () => {
                    tempAudioContext.close();
                    this.log(7, '✅ Success bleep completed');
                    resolve();
                };
                source.start();
            });
            
        } catch (error) {
            this.log(4, '⚠️ Could not play success bleep:', error.message);
        }
    }
    
    /**
     * Play a failure feedback bleep (descending tone)
     */
    async playFailureBleep() {
        if (!this.options.enableBleep) {
            this.log(7, '🔇 Failure bleep disabled');
            return;
        }
        
        try {
            this.log(6, '🎵 Playing failure bleep');
            
            const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            const duration = 0.4; // 400ms - longer for failure
            const sampleRate = tempAudioContext.sampleRate;
            const buffer = tempAudioContext.createBuffer(1, duration * sampleRate, sampleRate);
            const data = buffer.getChannelData(0);
            
            // Generate descending failure tone: 500Hz -> 300Hz
            for (let i = 0; i < buffer.length; i++) {
                const time = i / sampleRate;
                const progress = time / duration;
                const frequency = 500 - (200 * progress); // Descend from 500Hz to 300Hz
                let amplitude = 0.06 * (1 - progress * 0.3); // Fade out gradually
                
                data[i] = amplitude * Math.sin(2 * Math.PI * frequency * time);
            }
            
            const source = tempAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(tempAudioContext.destination);
            
            return new Promise((resolve) => {
                source.onended = () => {
                    tempAudioContext.close();
                    this.log(7, '✅ Failure bleep completed');
                    resolve();
                };
                source.start();
            });
            
        } catch (error) {
            this.log(4, '⚠️ Could not play failure bleep:', error.message);
        }
    }
    
    // ========== SESSION KEY MANAGEMENT ==========
    async initializeSessionKeys() {
        try {
            await this.refreshSessionKey();
            this.startKeyRefreshTimer();
        } catch (error) {
            this.log(1, '❌ Failed to initialize session keys:', error);
        }
    }
    
    async refreshSessionKey() {
        try {
            this.log(5, '🔑 Refreshing session key...');
            const response = await fetch(this.options.apiKeyEndpoint);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            this.currentSessionKey = data.session_token;
            this.log(4, '✅ Session key refreshed successfully');
            return this.currentSessionKey;
        } catch (error) {
            this.log(2, '❌ Error refreshing session key:', error);
            this.showError('Failed to refresh session key: ' + error.message);
            return null;
        }
    }
    
    async getSessionKey() {
        if (this.currentSessionKey) {
            this.log(7, '🔑 Using cached session key');
            return this.currentSessionKey;
        }
        
        this.log(5, '🔑 Getting initial session key...');
        return await this.refreshSessionKey();
    }
    
    startKeyRefreshTimer() {
        // Refresh key every 50 seconds (10 second buffer before 60s expiry)
        this.keyRefreshInterval = setInterval(async () => {
            await this.refreshSessionKey();
        }, 50000);
        this.log(6, '⏰ Started key refresh timer (every 50 seconds)');
    }
    
    stopKeyRefreshTimer() {
        if (this.keyRefreshInterval) {
            clearInterval(this.keyRefreshInterval);
            this.keyRefreshInterval = null;
            this.log(6, '⏰ Stopped key refresh timer');
        }
    }
    
    // ========== AUDIO PLAYBACK ==========
    async speakText(text, language = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // Auto-detect language if not specified
                if (!language) {
                    language = this.detectLanguage(text);
                }
                
                this.log(4, `🎙️ Playing audio for "${text}" in ${language}`);
                
                // Determine if this is native or learning speed based on language
                const isNativeLanguage = (language === this.sourceLanguage);
                const speedMode = isNativeLanguage ? 'native' : 'learning';
                
                this.log(6, `🎯 Speed mode: ${speedMode} (${isNativeLanguage ? 'normal speed' : 'slow/clear'})`);
                
                // Generate filename using same logic as server-side script
                const filename = await this.generateAudioFilename(text);
                const audioUrl = `${this.options.audioPath}${language}/${speedMode}/${filename}`;
                
                this.log(6, `🔊 Loading audio from: ${audioUrl}`);
                
                // Load and play the audio file
                await this.playAudioFromUrl(audioUrl);
                resolve();
                
            } catch (error) {
                this.log(3, '❌ Error playing audio:', error);
                this.showError('Audio playback failed: ' + error.message);
                reject(error);
            }
        });
    }
    
    /**
     * Generate audio filename using same logic as server-side script
     * Now uses SHA-256 instead of MD5 for better compatibility
     */
    async generateAudioFilename(text) {
        // Convert to UTF-8 bytes first, then sanitize byte by byte to match server behavior
        const utf8Bytes = this.stringToUtf8Bytes(text);
        
        // Take first 20 bytes (not characters) and convert each byte to char
        const first20Bytes = utf8Bytes.slice(0, 20);
        let sanitized = '';
        
        for (let i = 0; i < first20Bytes.length; i++) {
            const byte = first20Bytes[i];
            const char = String.fromCharCode(byte);
            
            // Replace non-alphanumeric with underscore (same regex as server: [^a-zA-Z0-9])
            if (/[a-zA-Z0-9]/.test(char)) {
                sanitized += char;
            } else {
                sanitized += '_';
            }
        }
        
        // Remove trailing underscores
        sanitized = sanitized.replace(/_+$/, '');
        
        if (!sanitized) {
            sanitized = 'phrase';
        }
        
        // Generate SHA-256 hash of original text
        const hash = await this.sha256(text);
        
        // Take first 8 characters of hash to match typical hash length expectations
        const shortHash = hash.substring(0, 8);
        
        return `${sanitized}_${shortHash}.mp3`;
    }
    
    /**
     * SHA-256 hash implementation using Web Crypto API
     * This will work consistently across modern browsers and match server-side implementations
     */
    async sha256(str) {
        // Convert string to UTF-8 bytes
        const utf8Bytes = new TextEncoder().encode(str);
        
        // Generate SHA-256 hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', utf8Bytes);
        
        // Convert buffer to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    }
    
    /**
     * Convert string to UTF-8 byte array
     */
    stringToUtf8Bytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            let code = str.charCodeAt(i);
            if (code < 0x80) {
                bytes.push(code);
            } else if (code < 0x800) {
                bytes.push(0xC0 | (code >> 6));
                bytes.push(0x80 | (code & 0x3F));
            } else if (code < 0x10000) {
                bytes.push(0xE0 | (code >> 12));
                bytes.push(0x80 | ((code >> 6) & 0x3F));
                bytes.push(0x80 | (code & 0x3F));
            } else {
                bytes.push(0xF0 | (code >> 18));
                bytes.push(0x80 | ((code >> 12) & 0x3F));
                bytes.push(0x80 | ((code >> 6) & 0x3F));
                bytes.push(0x80 | (code & 0x3F));
            }
        }
        return bytes;
    }
    
    /**
     * Load and play audio from URL
     */
    async playAudioFromUrl(url) {
        return new Promise((resolve, reject) => {
            try {
                this.log(6, '🔊 Creating audio element for playback');
                
                const audio = new Audio();
                
                audio.onloadeddata = () => {
                    this.log(7, '✅ Audio loaded successfully');
                };
                
                audio.onended = () => {
                    this.log(6, '✅ Audio playback finished');
                    resolve();
                };
                
                audio.onerror = (error) => {
                    this.log(3, '❌ Audio playback error:', error);
                    reject(new Error(`Failed to load audio from ${url}`));
                };
                
                audio.oncanplaythrough = () => {
                    this.log(7, '▶️ Starting audio playback');
                    audio.play().catch(playError => {
                        this.log(3, '❌ Audio play() failed:', playError);
                        reject(playError);
                    });
                };
                
                // Set source and start loading
                audio.src = url;
                audio.load();
                
            } catch (error) {
                this.log(3, '❌ Error setting up audio playback:', error);
                reject(error);
            }
        });
    }

    /**
     * Play a portion of audio file as a hint (first 25% of duration)
     */
    async playAudioHint(text, language = null, speedMode = 'learning') {
        return new Promise(async (resolve, reject) => {
            try {
                // Use target language if not specified
                if (!language) {
                    language = this.targetLanguage;
                }
                
                this.log(5, `🎯 Playing audio hint for: "${text}" in ${language}`);
                
                // Generate filename using same logic as speakText method
                const filename = await this.generateAudioFilename(text);
                const audioUrl = `${this.options.audioPath}${language}/${speedMode}/${filename}`;
                
                this.log(6, `🔊 Loading hint audio from: ${audioUrl}`);
                
                const audio = new Audio();
                
                audio.onloadedmetadata = () => {
                    this.log(7, `✅ Audio metadata loaded, duration: ${audio.duration}s`);
                    
                    // Calculate hint duration based on configurable percentage
                    const hintDuration = audio.duration * this.options.audioHintDuration;
                    this.log(7, `🎯 Playing first ${hintDuration.toFixed(2)}s as hint (${(this.options.audioHintDuration * 100)}% of ${audio.duration.toFixed(2)}s)`);
                    
                    // Set up a timer to stop playback after configured duration
                    const stopTimer = setTimeout(() => {
                        audio.pause();
                        audio.currentTime = 0;
                        this.log(7, '🔇 Hint playback completed');
                        resolve();
                    }, hintDuration * 1000);
                    
                    // Clean up timer if audio ends naturally (shouldn't happen with hints)
                    audio.onended = () => {
                        clearTimeout(stopTimer);
                        this.log(7, '🔇 Audio hint ended naturally');
                        resolve();
                    };
                    
                    // Start playback
                    audio.play().catch(playError => {
                        clearTimeout(stopTimer);
                        this.log(3, '❌ Audio hint play() failed:', playError);
                        reject(playError);
                    });
                };
                
                audio.onerror = (error) => {
                    this.log(3, '❌ Audio hint error:', error);
                    reject(new Error(`Failed to load audio hint from ${audioUrl}`));
                };
                
                // Set source and start loading
                audio.src = audioUrl;
                audio.load();
                
            } catch (error) {
                this.log(3, '❌ Error setting up audio hint:', error);
                reject(error);
            }
        });
    }

    /**
     * Determine if an audio hint should be played based on phrase history and word count
     */
    shouldPlayHint(targetText, recentResults) {
        // Validate inputs
        if (!recentResults || recentResults.length === 0) {
            this.log(8, '🎯 No hint: no recent results');
            return false;
        }
        
        // Check word count - skip hints for short phrases
        const wordCount = targetText.trim().split(/\s+/).length;
        if (wordCount < this.options.audioHintMinWords) {
            this.log(8, `🎯 No hint: phrase too short (${wordCount} words < ${this.options.audioHintMinWords} minimum)`);
            return false;
        }
        
        // Count successes (1s) and calculate success rate
        const successCount = recentResults.filter(r => r === 1).length;
        const totalAttempts = recentResults.length;
        const successRate = successCount / totalAttempts;
        
        this.log(8, `🎯 Hint check: ${successCount}/${totalAttempts} success rate: ${successRate.toFixed(2)}, words: ${wordCount}`, recentResults);
        
        // Only play hint if:
        // 1. User has had at least some success (successCount > 0)
        // 2. But success rate is below 50% (struggling)
        // 3. And has attempted the phrase at least twice (to have meaningful history)
        const hasAttemptedMultipleTimes = totalAttempts >= 2;
        const hasSomeSuccess = successCount > 0;
        const isStruggling = successRate < 0.5;
        
        const shouldHint = hasAttemptedMultipleTimes && hasSomeSuccess && isStruggling;
        
        this.log(8, `🎯 Hint decision: attempts=${totalAttempts} >= 2: ${hasAttemptedMultipleTimes}, successes=${successCount} > 0: ${hasSomeSuccess}, struggling=${successRate.toFixed(2)} < 0.5: ${isStruggling}`);
        this.log(8, `🎯 Should play hint: ${shouldHint}`);
        
        return shouldHint;
    }

    
    // ========== LEARNING SESSION MANAGEMENT ==========
    /**
     * Start a learning session with persistent microphone access
     * Call this once when learning starts to avoid repeated mic requests
     */
    async startLearningSession() {
        if (this.isLearningSessionActive) {
            this.log(6, '🎓 Learning session already active');
            return;
        }
        
        this.log(5, '🎓 Starting learning session with persistent microphone');
        await this.startRecording();
        this.isLearningSessionActive = true;
    }
    
    /**
     * Stop the learning session and release microphone access
     * Call this when the user finishes learning or closes the app
     */
    stopLearningSession() {
        if (!this.isLearningSessionActive) {
            this.log(6, '🎓 No learning session to stop');
            return;
        }
        
        this.log(5, '🎓 Stopping learning session and releasing microphone');
        this.stopRecording();
        this.isLearningSessionActive = false;
    }
    
    /**
     * Check if a learning session is currently active
     */
    isSessionActive() {
        return this.isLearningSessionActive;
    }
    
    // ========== AUDIO RECORDING ==========
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            
            this.currentAudioStream = stream;
            this.audioContext = new AudioContext({ sampleRate: 24000 });
            const source = this.audioContext.createMediaStreamSource(stream);
            
            this.audioProcessor = this.audioContext.createScriptProcessor(1024, 1, 1);
            this.audioProcessor.onaudioprocess = (event) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isListening) {
                    const audioData = event.inputBuffer.getChannelData(0);
                    const pcm16 = new Int16Array(audioData.length);
                    
                    for (let i = 0; i < audioData.length; i++) {
                        pcm16[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
                    }
                    
                    const uint8Array = new Uint8Array(pcm16.buffer);
                    const base64Audio = btoa(String.fromCharCode.apply(null, uint8Array));
                    
                    this.ws.send(JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: base64Audio
                    }));
                }
            };
            
            source.connect(this.audioProcessor);
            this.audioProcessor.connect(this.audioContext.destination);
            
            this.isListening = true;
            this.log(5, '🎤 Started recording and listening');
            
        } catch (error) {
            this.log(2, 'Error starting recording:', error);
            this.showError('Could not access microphone: ' + error.message);
            throw error;
        }
    }
    
    pauseListening() {
        this.isListening = false;
        this.log(6, '⏸️ Paused listening (microphone still active)');
    }
    
    resumeListening() {
        this.isListening = true;
        this.log(6, '▶️ Resumed listening');
    }
    
    stopRecording() {
        this.isListening = false;
        
        if (this.currentAudioStream) {
            this.currentAudioStream.getTracks().forEach(track => track.stop());
            this.currentAudioStream = null;
        }
        
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.log(5, '🛑 Stopped recording completely');
    }
    
    // Simple language detection based on known source/target languages
    detectLanguage(text) {
        // This is a simple heuristic - in a real app you might use a more sophisticated approach
        // For now, assume shorter phrases or common English words are source language
        const englishWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const words = text.toLowerCase().split(/\s+/);
        const englishWordCount = words.filter(word => englishWords.includes(word)).length;
        
        // If more than 20% are common English words, assume it's the source language
        if (englishWordCount / words.length > 0.2) {
            return this.sourceLanguage;
        }
        
        // Otherwise assume target language
        return this.targetLanguage;
    }
    
    // ========== UI HELPERS ==========
    showStatus(message) {
        this.log(7, '📢 Status:', message);
        
        // Call status callback if provided
        if (this.options.statusCallback) {
            this.options.statusCallback(message);
        }
        
        // Update output element if provided
        if (this.outputElement) {
            this.outputElement.textContent = message;
        }
    }
    
    showError(message) {
        this.log(2, '❌ Error:', message);
        // Could emit an event or call a callback here
        if (this.outputElement) {
            this.outputElement.textContent = 'Error: ' + message;
            this.outputElement.style.color = 'red';
            setTimeout(() => {
                this.outputElement.style.color = '';
            }, 3000);
        }
    }
    
    showScore(score) {
        this.log(4, '📊 Score:', score);
        // Return score info for UI to handle
        return {
            score: score,
            message: this.getScoreMessage(score),
            emoji: this.getScoreEmoji(score)
        };
    }
    
    getScoreMessage(score) {
        if (score >= 8) return 'Excellent work!';
        if (score >= 6) return 'Good job!';
        return 'Keep practicing!';
    }
    
    getScoreEmoji(score) {
        if (score >= 8) return '🎉';
        if (score >= 6) return '👍';
        return '📚';
    }
    
    // ========== OPTIONS MANAGEMENT ==========
    updateOptions(newOptions) {
        this.log(5, '🔧 Updating tutor options:', newOptions);
        
        // Merge new options with existing ones
        this.options = this.mergeOptions(this.options, newOptions);
        
        this.log(6, '✅ Options updated:', this.options);
        return this.options;
    }
    
    getOptions() {
        return { ...this.options }; // Return a copy to prevent external modification
    }
    
    // ========== MAIN TEST FUNCTION ==========
    async test(sourceText, targetText, expectedPronunciation = '', recentResults = [], waitTime = 10) {
        try {
            this.showStatus('Getting session key...');
            const sessionKey = await this.getSessionKey();
            if (!sessionKey) {
                return {
                    score: 0,
                    commentary: 'Failed to get session key',
                    stop: false
                };
            }
            
            this.showStatus('Connecting to ChatGPT...');
            this.log(4, '🔗 Creating new ChatGPT WebSocket connection for testing');
            this.log(6, '🎚️ Using VAD settings:', this.options.vad);
            this.log(6, '🎯 Feedback threshold:', this.options.feedbackThreshold);
            
            // Connect to ChatGPT Realtime API
            this.ws = new WebSocket(
                'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview&openai-beta=realtime%3Dv1',
                [`realtime`, `openai-insecure-api-key.${sessionKey}`, "openai-beta.realtime-v1"]
            );
            
            return new Promise((resolve) => {
                let hasResponse = false;
                let silenceTimer;
                
                this.ws.onopen = async () => {
                    this.log(5, '✅ Connected to ChatGPT Realtime API');
                    
                    // Prepare the prompt for ChatGPT
                    const prompt = `You are an expert phonetician. Listen to the user's speech and provide ONLY a English "phrasebook respelling" transcription of what they said. Do not include any explanations, commentary, or additional text except for these special cases - if the user says any of these, return JUST the standardized word instead of a transcription:
- If they say "stop", "pause", "that's enough", "quit", "finish", "done" or similar: return "stop"
- If they say "again", "play it again", "repeat", "one more time" or similar: return "again" 
- If they say "skip", "next", "pass", "I don't know", "I give up" or similar: return "skip"
- If they remain completely silent or you hear nothing: return "silent"

Please provide the phonetic transcription using English phrasebook respelling using ALL CAPS to show where the speaker puts emphasis using the following phonemes:
ah, eh, ay, ee, oh, oo, aw, ew, ur, uh, ow, ahn, ehn, ohn, uhn, p, b, t, d, k, g, f, v, s, z, m, n, l, r, rr, sh, zh, ch, j, ny, ly, h, th, w, y
The user is speaking in ${this.targetLanguage}
`;

                    if (this.options.loggingVerbosity >= 8) {
                        this.log(8, '📤 Sending prompt to ChatGPT:');
                        this.log(8, '------- PROMPT START -------');
                        this.log(8, prompt);
                        this.log(8, '------- PROMPT END -------');
                    }
                    
                    // Configure session with dynamic language instructions and custom VAD
                    this.ws.send(JSON.stringify({
                        type: 'session.update',
                        session: {
                            modalities: ['text'],
                            instructions: prompt,
                            input_audio_format: 'pcm16',
                            input_audio_transcription: {
                                model: 'whisper-1'
                            },
                            turn_detection: {
                                type: 'server_vad',
                                threshold: this.options.vad.threshold,
                                prefix_padding_ms: this.options.vad.prefixPaddingMs,
                                silence_duration_ms: this.options.vad.silenceDurationMs
                            }
                        }
                    }));
                    
                    // Ensure we have an active learning session
                    if (!this.isLearningSessionActive) {
                        this.log(2, '❌ test() called without active learning session');
                        return {
                            score: 0,
                            commentary: 'No active learning session. Please start a learning session first.',
                            stop: true
                        };
                    }
                    
                    this.log(6, '🎤 Using persistent microphone session');
                    
                    // Check if this is a brand new phrase (zero correct answers in history)
                    const correctAnswers = recentResults.reduce((sum, result) => sum + result, 0);
                    const isNewPhrase = correctAnswers === 0;
                    if (isNewPhrase ) {
                        // For completely new phrases, introduce them properly
                        this.showStatus(`🎵 New phrase! Listen to this ${this.sourceLanguage} phrase...`);
                        this.pauseListening();
                        await this.speakText(sourceText, this.sourceLanguage);
                        
                        this.showStatus(`🎵 Now here's how to say it in ${this.targetLanguage}...`);
                        await this.speakText(targetText, this.targetLanguage);
                        // repeat it
                        // Pause for 1 second (1000 milliseconds)
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        await this.speakText(targetText, this.targetLanguage);
                        
                        this.showStatus(`🎤 Now you try! Say it in ${this.targetLanguage}...`);
                        
                        // Play notification bleep before resuming listening
                        await this.playNotificationBleep();
                        this.resumeListening();
                    } else {
                        // Regular flow for phrases with some history
                        this.showStatus(`🎵 Listen to this ${this.sourceLanguage} phrase...`);
                        this.pauseListening();
                        await this.speakText(sourceText, this.sourceLanguage);
                        
                        // Check if we should play an audio hint
                        if (this.options.enableAudioHints && this.shouldPlayHint(targetText, recentResults)) {
                            try {
                                this.showStatus("🎯 Here is a hint for you...");
                                this.log(6, '🎯 Playing audio hint for struggling phrase');
                                await this.playAudioHint(targetText);
                                await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause after hint
                            } catch (error) {
                                this.log(4, '⚠️ Audio hint failed:', error);
                                // Continue with normal flow even if hint fails
                            }
                        }
                        
                        this.showStatus(`🎤 Now say it in ${this.targetLanguage}...`);
                        
                        // Play notification bleep before resuming listening
                        await this.playNotificationBleep();
                        this.resumeListening();
                    }
                    
                    // Set silence timer
                    silenceTimer = setTimeout(() => {
                        if (!hasResponse) {
                            this.log(4, '⏰ Silence timeout reached');
                            this.cleanup();
                            resolve({
                                score: 0,
                                commentary: 'No response detected within the time limit. Please try speaking closer to the microphone or check your audio settings.',
                                stop: false
                            });
                        }
                    }, waitTime * 1000);
                };
                
                this.ws.onmessage = async (event) => {
                    const message = JSON.parse(event.data);
                    this.log(8, '📨 Received message:', message.type);
                    
                    // Debug: Log full message for important types
                    if (['response.done', 'error', 'response.text.delta'].includes(message.type)) {
                        this.log(9, '📋 Full message details:', message);
                    }
                    
                    if (message.type === 'session.updated') {
                        this.log(6, '✅ Session configured successfully');
                    }
                    
                    if (message.type === 'input_audio_buffer.speech_started') {
                        this.log(6, '🎤 Speech detected, user started speaking');
                        clearTimeout(silenceTimer);
                    }
                    
                    if (message.type === 'input_audio_buffer.speech_stopped') {
                        this.log(6, '🔇 Speech stopped, processing...');
                    }
                    
                    if (message.type === 'response.done') {
                        this.log(5, '✅ Response complete from ChatGPT');
                        hasResponse = true;
                        clearTimeout(silenceTimer);
                        
                        // Extract response from ChatGPT
                        const response = message.response;
                        let result = {
                            score: 0,
                            commentary: 'Unable to process response',
                            stop: false
                        };
                        
                        this.log(6, '🔍 Processing ChatGPT response...');
                        this.log(9, '📥 Raw response object:', JSON.stringify(response, null, 2));
                        
                        if (response.output && response.output.length > 0) {
                            for (const output of response.output) {
                                this.log(8, '📄 Processing output item:', output);
                                if (output.content && output.content.length > 0) {
                                    for (const content of output.content) {
                                        if (content.type === 'text' && content.text) {
                                            if (this.options.loggingVerbosity >= 7) {
                                                this.log(7, '📥 Raw ChatGPT response text:');
                                                this.log(7, '------- RESPONSE START -------');
                                                this.log(7, content.text);
                                                this.log(7, '------- RESPONSE END -------');
                                            }
                                            
                                            // ChatGPT now returns phonetic transcription or standardized special words
                                            const response = content.text.trim();
                                            this.log(6, '🎤 ChatGPT response:', response);
                                            
                                            // Check for standardized special cases
                                            if (response === 'stop') {
                                                result = {
                                                    score: 0,
                                                    heardPronunciation: response,
                                                    commentary: 'User requested to stop',
                                                    stop: true
                                                };
                                                this.log(5, '🛑 Stop command detected');
                                            }
                                            else if (response === 'again') {
                                                result = {
                                                    score: 0,
                                                    heardPronunciation: response,
                                                    commentary: "They'll hear it again",
                                                    stop: false
                                                };
                                                this.log(5, '🔄 Repeat request detected');
                                            }
                                            else if (response === 'skip') {
                                                result = {
                                                    score: 1,
                                                    heardPronunciation: response,
                                                    commentary: 'Try your best! Practice makes perfect.',
                                                    stop: false
                                                };
                                                this.log(5, '🤷 Skip/don\'t know response detected');
                                            }
                                            else if (response === 'silent') {
                                                result = {
                                                    score: 0,
                                                    heardPronunciation: '',
                                                    commentary: 'No response detected',
                                                    stop: false
                                                };
                                                this.log(5, '🔇 Silent response detected');
                                            }
                                            // Normal pronunciation scoring
                                            else if (response.length > 0) {
                                                let scoringResult;
                                                
                                                // Handle both string and array pronunciations
                                                if (Array.isArray(expectedPronunciation)) {
                                                    // Array of pronunciation options - test against all and take the best score
                                                    this.log(6, `🎯 Testing against ${expectedPronunciation.length} pronunciation options:`, expectedPronunciation);
                                                    
                                                    let bestResult = null;
                                                    let bestScore = -1;
                                                    
                                                    for (let i = 0; i < expectedPronunciation.length; i++) {
                                                        const option = expectedPronunciation[i];
                                                        const testResult = this.pronunciationScorer.score(option, response);
                                                        this.log(7, `📊 Option ${i + 1} "${option}": ${testResult.finalScore.toFixed(1)}/10`);
                                                        
                                                        if (testResult.finalScore > bestScore) {
                                                            bestScore = testResult.finalScore;
                                                            bestResult = testResult;
                                                            bestResult.matchedPronunciation = option; // Track which option matched best
                                                        }
                                                    }
                                                    
                                                    scoringResult = bestResult;
                                                    this.log(6, `🏆 Best match: "${scoringResult.matchedPronunciation}" with score ${scoringResult.finalScore.toFixed(1)}/10`);
                                                } else {
                                                    // Single string pronunciation (traditional behavior)
                                                    scoringResult = this.pronunciationScorer.score(expectedPronunciation, response);
                                                    this.log(6, `📊 Single pronunciation scoring: ${scoringResult.finalScore.toFixed(1)}/10`);
                                                }
                                                
                                                result = {
                                                    score: scoringResult.finalScore,
                                                    targetPronunciation: expectedPronunciation,
                                                    heardPronunciation: response,
                                                    commentary: `Score: ${scoringResult.finalScore.toFixed(1)}/10 (${scoringResult.grade})`,
                                                    stop: false,
                                                    matchedPronunciation: scoringResult.matchedPronunciation // Include which option was matched (only for arrays)
                                                };
                                                this.log(5, '📊 Scored pronunciation:', result);
                                            }
                                            // Empty response fallback
                                            else {
                                                result = {
                                                    score: 0,
                                                    heardPronunciation: '',
                                                    commentary: 'No response received',
                                                    stop: false
                                                };
                                                this.log(5, '🔇 Empty response');
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            this.log(3, '⚠️ No output found in ChatGPT response');
                        }
                        
                        // If user requested to stop, clean up and return immediately
                        if (result.stop) {
                            this.log(4, '🛑 User requested to stop');
                            this.cleanup();
                            resolve(result);
                            return;
                        }
                        
                        // Play audio feedback based on score
                        if (result.score > 0) {
                            // Determine pass/fail based on pass threshold (not feedback threshold)
                            const passed = result.score >= this.options.passThreshold;
                            this.log(6, `🎵 Playing ${passed ? 'success' : 'failure'} bleep for score ${result.score} (pass threshold: ${this.options.passThreshold})`);
                            
                            // Play appropriate feedback bleep (don't await to avoid blocking)
                            if (passed) {
                                this.playSuccessBleep().catch(err => this.log(4, 'Success bleep failed:', err));
                            } else {
                                this.playFailureBleep().catch(err => this.log(4, 'Failure bleep failed:', err));
                            }
                        }
                        
                        // Show score feedback and potentially play target pronunciation
                        this.showStatus('Test complete!');
                        const scoreInfo = this.showScore(result.score);
                        
                        // Speak target language if score is below or equal to configured threshold
                        if (result.score > 0 && result.score <= this.options.feedbackThreshold) {
                            this.log(5, `📢 Score ${result.score} below threshold ${this.options.feedbackThreshold}, speaking ${this.targetLanguage} target phrase...`);
                            
                            const wasListening = this.isListening;
                            if (wasListening) this.pauseListening();
                            
                            // Show what was heard before playing the correct pronunciation
                            if (result.heardPronunciation && result.heardPronunciation.length > 0) {
                                this.showStatus(`👂 I heard you say: "${result.heardPronunciation}"`);
                                this.log(6, `👂 Displaying heard pronunciation: "${result.heardPronunciation}"`);
                            }
                            
                            // For very poor scores (< 3), repeat the phrase 3 times
                            if (result.score < 3) {
                                this.log(4, `🔁 Score ${result.score} is very low, repeating target phrase 3 times for better learning`);
                                this.showStatus(`🎵 Score ${result.score}/10 - Here's the correct ${this.targetLanguage} pronunciation (3 times)...`);
                                
                                for (let i = 1; i <= 3; i++) {
                                    this.log(6, `🎵 Playing repetition ${i}/3`);
                                    await this.speakText(targetText, this.targetLanguage);
                                    
                                    // Short pause between repetitions (except after the last one)
                                    if (i < 3) {
                                        await new Promise(resolve => setTimeout(resolve, 800));
                                    }
                                }
                            } else {
                                // Normal single playback for scores 3-6 (below threshold but not terrible)
                                this.showStatus(`🎵 Here's the correct ${this.targetLanguage} pronunciation...`);
                                await this.speakText(targetText, this.targetLanguage);
                            }
                            
                            if (wasListening) this.resumeListening();
                        }
                        
                        this.log(4, '📊 Final result returned:', result);
                        this.cleanup();
                        resolve(result);
                    }
                    
                    if (message.type === 'error') {
                        this.log(2, '❌ ChatGPT WebSocket error:', message.error);
                        this.log(8, '💥 Full error details:', JSON.stringify(message, null, 2));
                        this.showError('Error: ' + message.error.message);
                        this.cleanup();
                        resolve({
                            score: 0,
                            commentary: `Error occurred: ${message.error.message}`,
                            stop: false
                        });
                    }
                };
                
                this.ws.onerror = (error) => {
                    this.log(2, '❌ WebSocket connection error:', error);
                    this.showError('Connection error occurred');
                    this.cleanup();
                    resolve({
                        score: 0,
                        commentary: 'Connection error occurred. Please check your internet connection and try again.',
                        stop: false
                    });
                };
            });
            
        } catch (error) {
            this.log(1, '💥 Error in test method:', error);
            this.log(8, '🔍 Error stack trace:', error.stack);
            this.showError('Error: ' + error.message);
            return {
                score: 0,
                commentary: `Error occurred: ${error.message}`,
                stop: false
            };
        }
    }
    
    cleanup() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.log(5, '🔌 Closing ChatGPT WebSocket connection');
            this.ws.close();
            this.ws = null;
        }
        
        // Only stop recording if we're not in a persistent learning session
        if (!this.isLearningSessionActive) {
            this.log(6, '🎤 Stopping temporary recording session');
            this.stopRecording();
        } else {
            this.log(6, '🎤 Keeping persistent microphone session active');
        }
    }
    
    // ========== LIFECYCLE MANAGEMENT ==========
    destroy() {
        this.log(4, '🧹 Destroying LanguageTutor instance');
        this.cleanup();
        this.stopKeyRefreshTimer();
    }
}
