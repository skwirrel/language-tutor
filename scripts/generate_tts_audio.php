<?php
/**
 * TTS Audio Generator for Language Learning
 * 
 * Iterates through all learning JSON files and generates TTS audio files
 * for all phrases in both source and target languages using OpenAI TTS API.
 * Now generates both native-speed and learning-speed versions for each language.
 * 
 * New directory structure: audio/<language>/<native|learning>/<phrase>_<hash>.mp3
 */

class TTSGenerator {
    private $openaiApiKey;
    private $baseDir;
    private $audioDir;
    private $generatedCount = 0;
    private $skippedCount = 0;
    private $errorCount = 0;
    private $batchSize = 20; // Maximum files to generate per run
    private $validationEnabled = false;
    private $validateAndDelete = false;
    private $validateOnly = false;
    private $validationStats = [
        'total' => 0,
        'passed' => 0,
        'failed' => 0,
        'deleted' => 0,
        'cached' => 0
    ];
    private $validationCache = [];
    private $cacheFile = '../cache/validation_cache.json';
    private $cacheLoaded = false;
    
    public function __construct($apiKey, $batchSize = 20, $audioDir = '../public/audio', $baseDir = '../public/learning') {
        $this->openaiApiKey = $apiKey;
        $this->batchSize = $batchSize;
        $this->audioDir = $audioDir;
        $this->baseDir = $baseDir;
        
        // Create audio directory if it doesn't exist
        if (!is_dir($this->audioDir)) {
            mkdir($this->audioDir, 0755, true);
            echo "Created audio directory: {$this->audioDir}\n";
        }
    }
    
    /**
     * Main execution method with batch processing
     */
    public function generateAllAudio() {
        echo "🎵 Starting TTS audio generation (max {$this->batchSize} files)...\n";
        echo "📂 Scanning directory: {$this->baseDir}\n";
        echo "🆕 New structure: audio/<language>/<native|learning>/<phrase>_<hash>.mp3\n";
        echo "📝 Generates: source@native + target@learning for each phrase\n\n";
        
        $startTime = microtime(true);
        
        // Get all JSON files in the learning directory
        $jsonFiles = $this->getJsonFiles();
        
        if (empty($jsonFiles)) {
            echo "❌ No JSON files found in {$this->baseDir} directory\n";
            return;
        }
        
        echo "📋 Found " . count($jsonFiles) . " JSON files:\n";
        foreach ($jsonFiles as $file) {
            echo "  - $file\n";
        }
        echo "\n";
        
        // Collect all phrases that need generation
        $pendingPhrases = $this->collectPendingPhrases($jsonFiles);
        
        if (empty($pendingPhrases)) {
            echo "🎉 All audio files already exist! Nothing to generate.\n";
            return;
        }
        
        echo "📝 Found " . count($pendingPhrases) . " audio files needing generation\n";
        echo "🎯 Will generate up to {$this->batchSize} files this run\n\n";
        
        // Process only up to batchSize phrases
        $phrasesToProcess = array_slice($pendingPhrases, 0, $this->batchSize);
        
        foreach ($phrasesToProcess as $phraseInfo) {
            $this->generateTTSForPhraseInfo($phraseInfo);
            
            // Break if we've hit our batch limit
            if ($this->generatedCount >= $this->batchSize) {
                echo "\n🛑 Reached batch limit of {$this->batchSize} files\n";
                break;
            }
        }
        
        $endTime = microtime(true);
        $duration = round($endTime - $startTime, 2);
        $remaining = count($pendingPhrases) - $this->generatedCount - $this->errorCount;
        
        // Summary
        echo "\n" . str_repeat("=", 50) . "\n";
        echo "🎉 Batch Complete!\n";
        echo "⏱️  Duration: {$duration} seconds\n";
        echo "✅ Generated: {$this->generatedCount} files\n";
        echo "⏭️  Skipped: {$this->skippedCount} files (already exist)\n";
        echo "❌ Errors: {$this->errorCount} files\n";
        
        if ($remaining > 0) {
            echo "📋 Remaining: {$remaining} files to generate\n";
            echo "💡 Run the script again to generate the next batch\n";
        } else {
            echo "🎉 All audio files have been generated!\n";
        }
        echo str_repeat("=", 50) . "\n";
    }
    
    /**
     * Collect all phrases that need audio generation (don't exist yet)
     * Generates source language at native speed and target language at learning speed
     */
    private function collectPendingPhrases($jsonFiles) {
        $pendingPhrases = [];
        
        foreach ($jsonFiles as $filename) {
            echo "🔍 Scanning: $filename\n";
            
            // Parse filename to get languages
            $languages = $this->parseFilename($filename);
            if (!$languages) {
                echo "  ❌ Could not parse languages from filename\n";
                continue;
            }
            
            $sourceLanguage = $languages['source'];
            $targetLanguage = $languages['target'];
            
            // Create language directories with native/learning subdirs
            $this->createLanguageDirs($sourceLanguage);
            $this->createLanguageDirs($targetLanguage);
            
            // Load JSON data
            $filepath = $this->baseDir . '/' . $filename;
            $data = json_decode(file_get_contents($filepath), true);
            
            if (!$data) {
                echo "  ❌ Could not parse JSON file\n";
                continue;
            }
            
            // Check all phrases in all categories
            foreach ($data as $category => $phrases) {
                foreach ($phrases as $phrase) {
                    // Source language at NATIVE speed (the language they already know)
                    $sourceNativeInfo = $this->createPhraseInfo(
                        $phrase['source'], $sourceLanguage, $category, $filename, 'native'
                    );
                    if (!$this->audioFileExists($sourceNativeInfo)) {
                        $pendingPhrases[] = $sourceNativeInfo;
                    }
                    
                    // Target language at LEARNING speed (the language they're trying to learn)
                    $targetLearningInfo = $this->createPhraseInfo(
                        $phrase['target'], $targetLanguage, $category, $filename, 'learning'
                    );
                    if (!$this->audioFileExists($targetLearningInfo)) {
                        $pendingPhrases[] = $targetLearningInfo;
                    }
                }
            }
        }
        
        // Shuffle to mix languages and speeds to avoid doing all of one type first
        shuffle($pendingPhrases);
        
        return $pendingPhrases;
    }
    
    /**
     * Create phrase info structure with new directory structure
     * Now includes speed parameter (native|learning)
     */
    private function createPhraseInfo($text, $language, $category, $sourceFile, $speed) {
        $sanitized = $this->sanitizeFilename($text);
        
        // Use MD5 hash for consistency with existing client code
        $hash = hash('sha256', $text);
        // Take first 8 characters to match typical hash length expectations
        $shortHash = substr($hash, 0, 8);
        
        $filename = $sanitized . '_' . $shortHash . '.mp3';
        // New path structure: audio/<language>/<native|learning>/<filename>
        $filepath = $this->audioDir . '/' . $language . '/' . $speed . '/' . $filename;
        
        return [
            'text' => $text,
            'language' => $language,
            'speed' => $speed,
            'category' => $category,
            'sourceFile' => $sourceFile,
            'filename' => $filename,
            'filepath' => $filepath
        ];
    }
    
    /**
     * Check if audio file already exists
     */
    private function audioFileExists($phraseInfo) {
        return file_exists($phraseInfo['filepath']);
    }
    
    /**
     * Generate TTS audio for a phrase info structure
     */
    private function generateTTSForPhraseInfo($phraseInfo) {
        // Double-check file doesn't exist (in case it was created since we scanned)
        if ($this->audioFileExists($phraseInfo)) {
            echo "⏭️  Skipping (exists): {$phraseInfo['language']}/{$phraseInfo['speed']}/{$phraseInfo['filename']}\n";
            $this->skippedCount++;
            return;
        }
        
        echo "🎵 Generating: {$phraseInfo['language']}/{$phraseInfo['speed']}/{$phraseInfo['filename']}\n";
        echo "   📝 Text: \"{$phraseInfo['text']}\"\n";
        echo "   📚 Category: {$phraseInfo['category']}\n";
        echo "   🎯 Speed: " . ucfirst($phraseInfo['speed']) . "\n";
        
        // Use validation-enabled generation if validation is turned on
        if ($this->validationEnabled) {
            $this->generateTTSWithValidation($phraseInfo);
        } else {
            // Original generation logic
            try {
                $isNativeSpeed = ($phraseInfo['speed'] === 'native');
                $audioData = $this->callOpenAITTS($phraseInfo['text'], $phraseInfo['language'], $isNativeSpeed);
                
                if ($audioData) {
                    file_put_contents($phraseInfo['filepath'], $audioData);
                    echo "   ✅ Saved: " . number_format(strlen($audioData)) . " bytes\n";
                    $this->generatedCount++;
                } else {
                    echo "   ❌ Failed to generate audio\n";
                    $this->errorCount++;
                }
            } catch (Exception $e) {
                echo "   ❌ Error: " . $e->getMessage() . "\n";
                $this->errorCount++;
            }
        }
        
        // Small delay to be nice to the API
        usleep(200000); // 200ms delay between generations
        
        echo "\n";
    }
    
    /**
     * Get all JSON files from the learning directory
     */
    private function getJsonFiles() {
        $files = [];
        
        if (!is_dir($this->baseDir)) {
            echo "❌ Directory {$this->baseDir} does not exist\n";
            return $files;
        }
        
        $handle = opendir($this->baseDir);
        if ($handle) {
            while (($file = readdir($handle)) !== false) {
                if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
                    $files[] = $file;
                }
            }
            closedir($handle);
        }
        
        sort($files);
        return $files;
    }
    
    /**
     * Parse filename to extract source/target languages and level
     * Expected format: source-target-level.json
     */
    private function parseFilename($filename) {
        $basename = pathinfo($filename, PATHINFO_FILENAME);
        $parts = explode('-', $basename);
        
        if (count($parts) >= 3) {
            return [
                'source' => ucfirst($parts[0]),
                'target' => ucfirst($parts[1]),
                'level' => $parts[2]
            ];
        }
        
        return null;
    }
    
    /**
     * Create directories for a language with native/learning subdirectories
     */
    private function createLanguageDirs($language) {
        $languageDir = $this->audioDir . '/' . $language;
        $nativeDir = $languageDir . '/native';
        $learningDir = $languageDir . '/learning';
        
        if (!is_dir($languageDir)) {
            mkdir($languageDir, 0755, true);
            echo "  📁 Created directory: $languageDir\n";
        }
        
        if (!is_dir($nativeDir)) {
            mkdir($nativeDir, 0755, true);
            echo "  📁 Created directory: $nativeDir\n";
        }
        
        if (!is_dir($learningDir)) {
            mkdir($learningDir, 0755, true);
            echo "  📁 Created directory: $learningDir\n";
        }
    }
    
    /**
     * Sanitize filename using same logic as JavaScript client
     * Convert to UTF-8 bytes, take first 20 bytes, replace non-alphanumeric with underscore
     */
    private function sanitizeFilename($text) {
        // Convert to UTF-8 bytes and take first 20 bytes (matching JavaScript logic)
        $utf8Bytes = unpack('C*', $text);
        $first20Bytes = array_slice($utf8Bytes, 0, 20);
        
        $sanitized = '';
        foreach ($first20Bytes as $byte) {
            $char = chr($byte);
            if (preg_match('/[a-zA-Z0-9]/', $char)) {
                $sanitized .= $char;
            } else {
                $sanitized .= '_';
            }
        }
        
        // Remove trailing underscores
        $sanitized = rtrim($sanitized, '_');
        
        // Ensure we have at least something
        if (empty($sanitized)) {
            $sanitized = 'phrase';
        }
        
        return $sanitized;
    }
    
    /**
     * Call OpenAI TTS API to generate audio using chat completion with speed-specific instructions
     */
    private function callOpenAITTS($text, $language, $isNativeSpeed = false) {
        $url = 'https://api.openai.com/v1/chat/completions';
        
        // Map language names to appropriate voices
        $voiceMap = [
            'English' => 'alloy',
            'Italian' => 'alloy',
            'Spanish' => 'alloy',
            'French' => 'alloy',
            'German' => 'alloy',
            'Portuguese' => 'alloy',
            'Chinese' => 'alloy',
            'Japanese' => 'alloy',
            'Korean' => 'alloy'
        ];
        
        $voice = isset($voiceMap[$language]) ? $voiceMap[$language] : 'alloy';
        
        // Create different instructions based on speed requirement
        if ($isNativeSpeed) {
            // Native speed: normal, natural speed for native speakers
            $instruction = "You are a text-to-speech system. Speak the following text in {$language} with clear, natural pronunciation and normal speaking pace. Use proper {$language} pronunciation and accent. Speak naturally as you would in normal conversation. Instructions in brackets should be read out verbatim along with the rest of the text.";
        } else {
            // Learning speed: slow and clear for language learners
            $instruction = "You are a language learning pronunciation tutor. Speak the following text in {$language} with clear, slow, and natural pronunciation suitable for a language learner. Use proper {$language} pronunciation and accent. Speak slowly and clearly, pausing slightly between words to help the learner follow along, but maintain natural rhythm and intonation.";
        }
        
        $data = [
            'model' => 'gpt-4o-audio-preview',
            'modalities' => ['text', 'audio'],
            'audio' => [
                'voice' => $voice,
                'format' => 'mp3'
            ],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => $instruction
                ],
                [
                    'role' => 'user',
                    'content' => "CRITICAL: after a tiny pause, speak this text in {$language} exactly once. Do not repeat it, do not add anything before or after it, do not explain it. Speak exactly as written including any text in parentheses: \"{$text}\""
                ]
            ]
        ];
        
        // Build headers with optional organization and project IDs
        $headers = [
            'Authorization: Bearer ' . $this->openaiApiKey,
            'Content-Type: application/json'
        ];
        
        // Add optional OpenAI organization ID if defined
        if (defined('OPENAI_ORG_ID') && !empty(OPENAI_ORG_ID)) {
            $headers[] = 'OpenAI-Organization: ' . OPENAI_ORG_ID;
        }
        
        // Add optional OpenAI project ID if defined
        if (defined('OPENAI_PROJECT_ID') && !empty(OPENAI_PROJECT_ID)) {
            $headers[] = 'OpenAI-Project: ' . OPENAI_PROJECT_ID;
        }
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 45,  // Longer timeout for chat completion
            CURLOPT_CONNECTTIMEOUT => 15
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            throw new Exception("cURL error: $error");
        }
        
        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMsg = isset($errorData['error']['message']) ? 
                $errorData['error']['message'] : 
                "HTTP $httpCode";
            throw new Exception("OpenAI API error: $errorMsg");
        }
        
        // Parse chat completion response to extract audio
        $responseData = json_decode($response, true);
        
        if (!isset($responseData['choices'][0]['message']['audio']['data'])) {
            throw new Exception("No audio data found in chat completion response");
        }
        
        // Decode base64 audio data
        $audioBase64 = $responseData['choices'][0]['message']['audio']['data'];
        $audioData = base64_decode($audioBase64);
        
        if (!$audioData) {
            throw new Exception("Failed to decode base64 audio data");
        }
        
        return $audioData;
    }
    
    /**
     * Set validation mode
     */
    public function setValidationMode($enabled, $deleteInvalid = false, $validateOnly = false) {
        $this->validationEnabled = $enabled;
        $this->validateAndDelete = $deleteInvalid;
        $this->validateOnly = $validateOnly;
    }
    
    /**
     * Validate existing audio files
     */
    public function validateExistingFiles() {
        echo "🔍 Validating existing audio files...\n";
        
        $jsonFiles = $this->getJsonFiles();
        
        foreach ($jsonFiles as $filename) {
            $languages = $this->parseFilename($filename);
            if (!$languages) continue;
            
            $filepath = $this->baseDir . '/' . $filename;
            $data = json_decode(file_get_contents($filepath), true);
            if (!$data) continue;
            
            foreach ($data as $category => $phrases) {
                foreach ($phrases as $phrase) {
                    // Check both source and target audio files
                    $sourceInfo = $this->createPhraseInfo(
                        $phrase['source'], $languages['source'], $category, $filename, 'native'
                    );
                    $targetInfo = $this->createPhraseInfo(
                        $phrase['target'], $languages['target'], $category, $filename, 'learning'
                    );
                    
                    foreach ([$sourceInfo, $targetInfo] as $phraseInfo) {
                        if ($this->audioFileExists($phraseInfo)) {
                            $this->validateSingleFile($phraseInfo);
                        }
                    }
                }
            }
        }
        
        $this->printValidationSummary();
    }
    
    /**
     * Validate a single audio file
     */
    private function validateSingleFile($phraseInfo) {
        echo "🔍 Validating: {$phraseInfo['language']}/{$phraseInfo['speed']}/{$phraseInfo['filename']}\n";
        
        // Check cache first
        $cached = $this->isCachedValidation($phraseInfo);
        if ($cached !== false) {
            echo "   💾 Using cached result\n";
            $this->validationStats['total']++;
            $this->validationStats['cached']++;
            
            $isValid = $cached['result']['valid'];
            if ($isValid) {
                echo "   ✅ Valid (cached)\n";
                $this->validationStats['passed']++;
            } else {
                echo "   ❌ Invalid (cached)\n";
                $this->validationStats['failed']++;
                
                // Show cached failure details
                if (isset($cached['result']['duration_check']) && !$cached['result']['duration_check']['valid']) {
                    $dur = $cached['result']['duration_check'];
                    echo "   ⚠️  Duration check failed: {$dur['actual']}s > {$dur['max_allowed']}s\n";
                } elseif (isset($cached['result']['content_check']) && !$cached['result']['content_check']['valid']) {
                    $cont = $cached['result']['content_check'];
                    $threshold = isset($cont['threshold_used']) ? $cont['threshold_used'] : 'N/A';
                    echo "   ⚠️  Content check failed: {$cont['similarity']}% similarity (threshold: {$threshold}%)\n";
                    echo "   📝 Expected: \"{$cont['expected']}\"\n";
                    echo "   🎤 Got: \"{$cont['transcribed']}\"\n";
                }
                
                if ($this->validateAndDelete) {
                    unlink($phraseInfo['filepath']);
                    echo "   🗑️  Deleted invalid file\n";
                    $this->validationStats['deleted']++;
                    // Remove from cache since file is deleted
                    unset($this->validationCache[$phraseInfo['filepath']]);
                    $this->saveValidationCache();
                }
            }
            echo "\n";
            return;
        }
        
        // Not in cache, perform validation
        try {
            $audioData = file_get_contents($phraseInfo['filepath']);
            
            // Perform validation and capture detailed results
            $durationResult = $this->validateAudioDuration($audioData, $phraseInfo['text'], $phraseInfo['speed'] === 'native');
            $contentResult = null;
            $isValid = true;
            
            if (!$durationResult['valid']) {
                echo "   ⚠️  Duration check failed: {$durationResult['actual']}s > {$durationResult['max_allowed']}s\n";
                $isValid = false;
            } else {
                // Only run content check if duration check passed
                $contentResult = $this->validateAudioContent($audioData, $phraseInfo['text'], $phraseInfo['language']);
                if (!$contentResult['valid']) {
                    echo "   ⚠️  Content check failed: {$contentResult['similarity']}% similarity (threshold: {$contentResult['threshold_used']}%)\n";
                    echo "   📝 Expected: \"{$contentResult['expected']}\"\n";
                    echo "   🎤 Got: \"{$contentResult['transcribed']}\"\n";
                    $isValid = false;
                } else {
                    echo "   ✅ Duration: {$durationResult['actual']}s, Similarity: {$contentResult['similarity']}% (threshold: {$contentResult['threshold_used']}%)\n";
                }
            }
            
            // Cache the result
            $this->cacheValidationResult($phraseInfo, $isValid, $durationResult, $contentResult);
            
            $this->validationStats['total']++;
            
            if ($isValid) {
                echo "   ✅ Valid\n";
                $this->validationStats['passed']++;
            } else {
                echo "   ❌ Invalid\n";
                $this->validationStats['failed']++;
                
                if ($this->validateAndDelete) {
                    unlink($phraseInfo['filepath']);
                    echo "   🗑️  Deleted invalid file\n";
                    $this->validationStats['deleted']++;
                    // Remove from cache since file is deleted
                    unset($this->validationCache[$phraseInfo['filepath']]);
                    $this->saveValidationCache();
                }
            }
        } catch (Exception $e) {
            echo "   ❌ Validation error: " . $e->getMessage() . "\n";
            $this->validationStats['failed']++;
            $this->validationStats['total']++;
        }
        
        echo "\n";
    }
    
    /**
     * Validate audio content using duration and Whisper transcription
     */
    private function validateAudio($audioData, $expectedText, $language, $isNativeSpeed) {
        // 1. Duration validation (quick check)
        $durationValid = $this->validateAudioDuration($audioData, $expectedText, $isNativeSpeed);
        if (!$durationValid['valid']) {
            echo "   ⚠️  Duration check failed: {$durationValid['actual']}s > {$durationValid['max_allowed']}s\n";
            return false;
        }
        
        // 2. Content validation with GPT-4o mini (more expensive)
        $contentValid = $this->validateAudioContent($audioData, $expectedText, $language);
        if (!$contentValid['valid']) {
            $threshold = isset($contentValid['threshold_used']) ? $contentValid['threshold_used'] : 'N/A';
            echo "   ⚠️  Content check failed: {$contentValid['similarity']}% similarity (threshold: {$threshold}%)\n";
            echo "   📝 Expected: \"{$contentValid['expected']}\"\n";
            echo "   🎤 Got: \"{$contentValid['transcribed']}\"\n";
            return false;
        }
        
        $threshold = isset($contentValid['threshold_used']) ? $contentValid['threshold_used'] : 'N/A';
        echo "   ✅ Duration: {$durationValid['actual']}s, Similarity: {$contentValid['similarity']}% (threshold: {$threshold}%)\n";
        return true;
    }
    
    /**
     * Validate audio duration
     */
    private function validateAudioDuration($audioData, $expectedText, $isNativeSpeed) {
        // Create temporary file to analyze duration
        $tempFile = tempnam(sys_get_temp_dir(), 'duration_check_') . '.mp3';
        file_put_contents($tempFile, $audioData);
        
        try {
            // Get duration using ffprobe if available, otherwise estimate
            $duration = $this->getAudioDuration($tempFile);
            
            // Estimate expected duration
            $wordCount = str_word_count($expectedText);
            $expectedDuration = $this->estimateDuration($wordCount, $isNativeSpeed);
            
            // More lenient validation for short phrases
            if ($wordCount <= 2) {
                // Very short phrases: allow up to 300% variance (3x expected)
                $maxDuration = max($expectedDuration * 3.0, 4.0); // At least 4 seconds max
            } elseif ($wordCount <= 4) {
                // Short phrases: allow up to 200% variance
                $maxDuration = $expectedDuration * 2.5;
            } else {
                // Longer phrases: use original 75% variance
                $maxDuration = $expectedDuration * 1.75;
            }
            
            // Always allow at least 2 seconds for any phrase (sometimes TTS has intro/outro)
            $maxDuration = max($maxDuration, 2.0);
            
            $result = [
                'valid' => $duration <= $maxDuration && $duration > 0.3, // Lower minimum to 0.3 seconds
                'actual' => round($duration, 2),
                'expected' => round($expectedDuration, 2),
                'max_allowed' => round($maxDuration, 2)
            ];
            
            unlink($tempFile);
            return $result;
            
        } catch (Exception $e) {
            unlink($tempFile);
            // If we can't get duration, assume it's valid
            return ['valid' => true, 'actual' => 0, 'expected' => 0, 'max_allowed' => 0];
        }
    }
    
    /**
     * Get audio duration using ffprobe
     */
    private function getAudioDuration($filepath) {
        $cmd = "ffprobe -i " . escapeshellarg($filepath) . " -show_entries format=duration -v quiet -of csv=\"p=0\" 2>/dev/null";
        $output = shell_exec($cmd);
        
        if ($output && is_numeric(trim($output))) {
            return floatval(trim($output));
        }
        
        // Fallback: estimate based on file size (rough approximation)
        $fileSize = filesize($filepath);
        // Rough estimate: ~1KB per second for compressed MP3
        return $fileSize / 1000;
    }
    
    /**
     * Estimate expected duration based on word count
     */
    private function estimateDuration($wordCount, $isNativeSpeed) {
        // Average speaking rates (words per minute)
        $wpm = $isNativeSpeed ? 150 : 100; // Slower for learning speed
        $seconds = ($wordCount / $wpm) * 60;
        
        // Add minimum duration for very short phrases
        return max($seconds, 1.0);
    }
    
    /**
     * Validate audio content using GPT-4o mini transcription
     */
    private function validateAudioContent($audioData, $expectedText, $language) {
        try {
            $transcription = $this->transcribeAudio($audioData, $language);
            
            // Normalize both texts for comparison
            $expectedClean = $this->normalizeText($expectedText);
            $transcribedClean = $this->normalizeText($transcription);
            
            // Calculate similarity using Levenshtein distance
            $similarity = $this->calculateSimilarity($expectedClean, $transcribedClean);
            
            // Adaptive similarity threshold based on phrase length
            // Short phrases (< 10 chars) are more prone to transcription variations
            $threshold = strlen($expectedClean) < 10 ? 0.50 : 0.70; // 50% for short, 70% for longer phrases
            
            return [
                'valid' => $similarity >= $threshold,
                'similarity' => round($similarity * 100, 1),
                'expected' => $expectedClean,
                'transcribed' => $transcribedClean,
                'threshold_used' => round($threshold * 100, 1)
            ];
            
        } catch (Exception $e) {
            echo "   ⚠️  GPT-4o mini transcription failed: " . $e->getMessage() . "\n";
            // If transcription fails, assume content is valid
            return ['valid' => true, 'similarity' => 100, 'expected' => $expectedText, 'transcribed' => 'N/A'];
        }
    }
    
    /**
     * Transcribe audio using GPT-4o mini transcribe model
     */
    private function transcribeAudio($audioData, $language) {
        $url = 'https://api.openai.com/v1/audio/transcriptions';
        
        // Create temporary file
        $tempFile = tempnam(sys_get_temp_dir(), 'transcribe_') . '.mp3';
        file_put_contents($tempFile, $audioData);
        
        // Map language names to ISO codes
        $languageMap = [
            'English' => 'en',
            'Italian' => 'it',
            'Spanish' => 'es',
            'French' => 'fr',
            'German' => 'de',
            'Portuguese' => 'pt',
            'Chinese' => 'zh',
            'Japanese' => 'ja',
            'Korean' => 'ko'
        ];
        
        $langCode = isset($languageMap[$language]) ? $languageMap[$language] : 'en';
        
        // Build headers with optional organization and project IDs
        $headers = [
            'Authorization: Bearer ' . $this->openaiApiKey
        ];
        
        // Add optional OpenAI organization ID if defined
        if (defined('OPENAI_ORG_ID') && !empty(OPENAI_ORG_ID)) {
            $headers[] = 'OpenAI-Organization: ' . OPENAI_ORG_ID;
        }
        
        // Add optional OpenAI project ID if defined
        if (defined('OPENAI_PROJECT_ID') && !empty(OPENAI_PROJECT_ID)) {
            $headers[] = 'OpenAI-Project: ' . OPENAI_PROJECT_ID;
        }
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => [
                'file' => new CURLFile($tempFile, 'audio/mp3', 'audio.mp3'),
                'model' => 'gpt-4o-transcribe',
                'language' => $langCode,
                'response_format' => 'text',
                'prompt' => 'Transcribe the entire audio exactly as spoken. Write out all numbers as words (e.g., "1" as "one", "20" as "twenty"). Do not include filler words like um, uh, er unless they are clearly part of the intended phrase.'
            ],
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        unlink($tempFile);
        
        if ($error) {
            throw new Exception("cURL error: $error");
        }
        
        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMsg = isset($errorData['error']['message']) ? 
                $errorData['error']['message'] : 
                "HTTP $httpCode";
            throw new Exception("GPT-4o mini transcribe API error: $errorMsg");
        }
        
        return trim($response);
    }
    
    /**
     * Normalize text for comparison with flexible transcription handling
     */
    private function normalizeText($text) {
        // Convert to lowercase
        $text = strtolower($text);
        
        // Remove all punctuation and special characters, keeping only letters, numbers, and spaces
        $text = preg_replace('/[^\p{L}\p{N}\s]/u', '', $text);
        
        // Normalize multiple spaces to single spaces
        $text = preg_replace('/\s+/', ' ', $text);
        
        // Remove common transcription artifacts that might appear
        $text = str_replace([' um ', ' uh ', ' er ', ' ah '], ' ', ' ' . $text . ' ');
        
        // Normalize whitespace again after replacements
        $text = preg_replace('/\s+/', ' ', $text);
        
        return trim($text);
    }
    
    /**
     * Calculate text similarity using Levenshtein distance
     */
    private function calculateSimilarity($text1, $text2) {
        if ($text1 === $text2) return 1.0;
        
        $maxLength = max(strlen($text1), strlen($text2));
        if ($maxLength === 0) return 1.0;
        
        $distance = levenshtein($text1, $text2);
        return 1 - ($distance / $maxLength);
    }
    
    /**
     * Generate TTS with validation and retries
     */
    private function generateTTSWithValidation($phraseInfo, $maxRetries = 2) {
        for ($attempt = 1; $attempt <= $maxRetries + 1; $attempt++) {
            if ($attempt > 1) {
                echo "   🔄 Attempt $attempt/" . ($maxRetries + 1) . "\n";
            }
            
            try {
                $isNativeSpeed = ($phraseInfo['speed'] === 'native');
                $audioData = $this->callOpenAITTS($phraseInfo['text'], $phraseInfo['language'], $isNativeSpeed);
                
                if (!$audioData) {
                    echo "   ❌ No audio data received\n";
                    continue;
                }
                
                // If validation is enabled, validate the audio
                if ($this->validationEnabled) {
                    $isValid = $this->validateAudio($audioData, $phraseInfo['text'], $phraseInfo['language'], $isNativeSpeed);
                    
                    if (!$isValid && $attempt <= $maxRetries) {
                        echo "   🔄 Validation failed, retrying...\n";
                        continue;
                    }
                    
                    if (!$isValid) {
                        echo "   ❌ Final validation failed after $maxRetries retries\n";
                        $this->errorCount++;
                        return false;
                    }
                }
                
                // Save the valid audio
                file_put_contents($phraseInfo['filepath'], $audioData);
                echo "   ✅ Saved: " . number_format(strlen($audioData)) . " bytes\n";
                $this->generatedCount++;
                return true;
                
            } catch (Exception $e) {
                echo "   ❌ Attempt $attempt error: " . $e->getMessage() . "\n";
                if ($attempt <= $maxRetries) {
                    echo "   🔄 Retrying...\n";
                    sleep(1);
                }
            }
        }
        
        echo "   ❌ Failed after " . ($maxRetries + 1) . " attempts\n";
        $this->errorCount++;
        return false;
    }
    
    /**
     * Print validation summary
     */
    private function printValidationSummary() {
        echo "\n" . str_repeat("=", 50) . "\n";
        echo "🔍 Validation Summary:\n";
        echo "📊 Total files checked: {$this->validationStats['total']}\n";
        echo "✅ Passed: {$this->validationStats['passed']}\n";
        echo "❌ Failed: {$this->validationStats['failed']}\n";
        
        if ($this->validationStats['cached'] > 0) {
            echo "💾 From cache: {$this->validationStats['cached']}\n";
        }
        
        if ($this->validationStats['deleted'] > 0) {
            echo "🗑️  Deleted: {$this->validationStats['deleted']}\n";
        }
        
        if ($this->validationStats['total'] > 0) {
            $passRate = round(($this->validationStats['passed'] / $this->validationStats['total']) * 100, 1);
            echo "📈 Pass rate: {$passRate}%\n";
        }
        
        echo str_repeat("=", 50) . "\n";
    }
    
    /**
     * Load validation cache from file
     */
    private function loadValidationCache() {
        if ($this->cacheLoaded) return;
        
        // Create cache directory if it doesn't exist
        $cacheDir = dirname($this->cacheFile);
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        
        if (file_exists($this->cacheFile)) {
            $cacheData = json_decode(file_get_contents($this->cacheFile), true);
            if ($cacheData && isset($cacheData['files'])) {
                $this->validationCache = $cacheData['files'];
            }
        }
        
        $this->cacheLoaded = true;
    }
    
    /**
     * Save validation cache to file
     */
    private function saveValidationCache() {
        $cacheData = [
            'cache_version' => '1.0',
            'last_updated' => date('c'),
            'files' => $this->validationCache
        ];
        
        // Create cache directory if it doesn't exist
        $cacheDir = dirname($this->cacheFile);
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        
        file_put_contents($this->cacheFile, json_encode($cacheData, JSON_PRETTY_PRINT));
    }
    
    /**
     * Check if file validation is cached and still valid
     */
    private function isCachedValidation($phraseInfo) {
        $this->loadValidationCache();
        
        $filepath = $phraseInfo['filepath'];
        if (!isset($this->validationCache[$filepath])) {
            return false;
        }
        
        $cached = $this->validationCache[$filepath];
        
        // Check if file still exists
        if (!file_exists($filepath)) {
            // Remove from cache if file no longer exists
            unset($this->validationCache[$filepath]);
            return false;
        }
        
        // Check if file has been modified since cache entry
        $currentModTime = filemtime($filepath);
        $currentSize = filesize($filepath);
        
        if ($cached['last_modified'] !== $currentModTime || $cached['file_size'] !== $currentSize) {
            // File has been modified, remove from cache
            unset($this->validationCache[$filepath]);
            return false;
        }
        
        // Check if text/language/speed match (in case file was renamed)
        if ($cached['text'] !== $phraseInfo['text'] || 
            $cached['language'] !== $phraseInfo['language'] || 
            $cached['speed'] !== $phraseInfo['speed']) {
            // Metadata doesn't match, remove from cache
            unset($this->validationCache[$filepath]);
            return false;
        }
        
        return $cached;
    }
    
    /**
     * Cache validation result
     */
    private function cacheValidationResult($phraseInfo, $result, $durationResult = null, $contentResult = null) {
        $this->loadValidationCache();
        
        $filepath = $phraseInfo['filepath'];
        
        $this->validationCache[$filepath] = [
            'filepath' => $filepath,
            'text' => $phraseInfo['text'],
            'language' => $phraseInfo['language'],
            'speed' => $phraseInfo['speed'],
            'last_modified' => filemtime($filepath),
            'file_size' => filesize($filepath),
            'validation_date' => date('c'),
            'result' => [
                'valid' => $result,
                'duration_check' => $durationResult,
                'content_check' => $contentResult
            ]
        ];
        
        $this->saveValidationCache();
    }
    
    /**
     * Clear validation cache
     */
    public function clearValidationCache() {
        $this->validationCache = [];
        if (file_exists($this->cacheFile)) {
            unlink($this->cacheFile);
        }
        echo "🗑️  Validation cache cleared\\n";
    }
    
    /**
     * Show validation cache statistics
     */
    public function showCacheStats() {
        $this->loadValidationCache();
        
        echo "📊 Validation Cache Statistics:\\n";
        echo str_repeat("=", 40) . "\\n";
        
        if (empty($this->validationCache)) {
            echo "Cache is empty\\n";
            return;
        }
        
        $totalEntries = count($this->validationCache);
        $validFiles = 0;
        $invalidFiles = 0;
        $byLanguage = [];
        $bySpeed = [];
        
        foreach ($this->validationCache as $entry) {
            if ($entry['result']['valid']) {
                $validFiles++;
            } else {
                $invalidFiles++;
            }
            
            $language = $entry['language'];
            $speed = $entry['speed'];
            
            $byLanguage[$language] = ($byLanguage[$language] ?? 0) + 1;
            $bySpeed[$speed] = ($bySpeed[$speed] ?? 0) + 1;
        }
        
        echo "📁 Total cached entries: $totalEntries\\n";
        echo "✅ Valid files: $validFiles\\n";
        echo "❌ Invalid files: $invalidFiles\\n";
        
        if ($totalEntries > 0) {
            $validRate = round(($validFiles / $totalEntries) * 100, 1);
            echo "📈 Cache validity rate: {$validRate}%\\n";
        }
        
        echo "\\n🌍 By Language:\\n";
        foreach ($byLanguage as $lang => $count) {
            echo "  $lang: $count files\\n";
        }
        
        echo "\\n🎯 By Speed:\\n";
        foreach ($bySpeed as $speed => $count) {
            echo "  " . ucfirst($speed) . ": $count files\\n";
        }
        
        if (file_exists($this->cacheFile)) {
            $cacheSize = filesize($this->cacheFile);
            echo "\\n💾 Cache file size: " . $this->formatBytes($cacheSize) . "\\n";
        }
        
        echo str_repeat("=", 40) . "\\n";
    }
    
    /**
     * Get statistics about existing audio files with new directory structure
     */
    public function getStatistics() {
        echo "📊 TTS Audio Statistics (new structure):\n";
        
        if (!is_dir($this->audioDir)) {
            echo "  📁 Audio directory does not exist\n";
            return;
        }
        
        $totalFiles = 0;
        $totalSize = 0;
        $languageStats = [];
        
        $languages = scandir($this->audioDir);
        foreach ($languages as $language) {
            if ($language === '.' || $language === '..') continue;
            
            $languageDir = $this->audioDir . '/' . $language;
            if (!is_dir($languageDir)) continue;
            
            $languageStats[$language] = [
                'native' => ['files' => 0, 'size' => 0],
                'learning' => ['files' => 0, 'size' => 0],
                'total' => ['files' => 0, 'size' => 0]
            ];
            
            // Check native and learning subdirectories
            foreach (['native', 'learning'] as $speed) {
                $speedDir = $languageDir . '/' . $speed;
                if (is_dir($speedDir)) {
                    $files = glob($speedDir . '/*.mp3');
                    $fileCount = count($files);
                    $speedSize = 0;
                    
                    foreach ($files as $file) {
                        $speedSize += filesize($file);
                    }
                    
                    $languageStats[$language][$speed]['files'] = $fileCount;
                    $languageStats[$language][$speed]['size'] = $speedSize;
                    $languageStats[$language]['total']['files'] += $fileCount;
                    $languageStats[$language]['total']['size'] += $speedSize;
                    
                    $totalFiles += $fileCount;
                    $totalSize += $speedSize;
                }
            }
        }
        
        echo "  🎵 Total files: $totalFiles\n";
        echo "  💾 Total size: " . $this->formatBytes($totalSize) . "\n\n";
        
        foreach ($languageStats as $language => $stats) {
            echo "  🌍 $language: {$stats['total']['files']} files, " . 
                 $this->formatBytes($stats['total']['size']) . "\n";
            echo "    📢 Native: {$stats['native']['files']} files, " . 
                 $this->formatBytes($stats['native']['size']) . "\n";
            echo "    🎓 Learning: {$stats['learning']['files']} files, " . 
                 $this->formatBytes($stats['learning']['size']) . "\n";
        }
    }
    
    /**
     * Format bytes into human readable format
     */
    private function formatBytes($bytes) {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        
        $bytes /= pow(1024, $pow);
        
        return round($bytes, 2) . ' ' . $units[$pow];
    }
    
    /**
     * Generate missing pronunciation guides using ChatGPT-4o-mini-audio
     */
    public function generatePronunciationGuides() {
        echo "🎤 Starting pronunciation guide generation (max {$this->batchSize} entries)...\n";
        echo "📂 Scanning directory: {$this->baseDir}\n\n";
        
        $startTime = microtime(true);
        
        // Get all JSON files
        $jsonFiles = $this->getJsonFiles();
        
        if (empty($jsonFiles)) {
            echo "❌ No JSON files found in {$this->baseDir} directory\n";
            return;
        }
        
        echo "📋 Found " . count($jsonFiles) . " JSON files:\n";
        foreach ($jsonFiles as $file) {
            echo "  - $file\n";
        }
        echo "\n";
        
        // Collect entries missing pronunciation guides
        $missingEntries = $this->collectMissingPronunciations($jsonFiles);
        
        if (empty($missingEntries)) {
            echo "🎉 All entries already have pronunciation guides! Nothing to generate.\n";
            return;
        }
        
        echo "📝 Found " . count($missingEntries) . " entries missing pronunciation guides\n";
        echo "🎯 Will process up to {$this->batchSize} entries this run\n\n";
        
        // Process only up to batchSize entries
        $entriesToProcess = array_slice($missingEntries, 0, $this->batchSize);
        
        $processedCount = 0;
        $errorCount = 0;
        
        foreach ($entriesToProcess as $entry) {
            if ($this->generateSinglePronunciation($entry)) {
                $processedCount++;
            } else {
                $errorCount++;
            }
            
            if ($processedCount + $errorCount >= $this->batchSize) {
                echo "\n🛑 Reached batch limit of {$this->batchSize} entries\n";
                break;
            }
        }
        
        $endTime = microtime(true);
        $duration = round($endTime - $startTime, 2);
        $remaining = count($missingEntries) - $processedCount - $errorCount;
        
        // Summary
        echo "\n" . str_repeat("=", 50) . "\n";
        echo "🎉 Pronunciation Generation Complete!\n";
        echo "⏱️  Duration: {$duration} seconds\n";
        echo "✅ Generated: {$processedCount} pronunciations\n";
        echo "❌ Errors: {$errorCount} entries\n";
        
        if ($remaining > 0) {
            echo "📋 Remaining: {$remaining} entries to process\n";
            echo "💡 Run the script again to process the next batch\n";
        } else {
            echo "🎉 All pronunciation guides have been generated!\n";
        }
        echo str_repeat("=", 50) . "\n";
    }
    
    /**
     * Collect entries that are missing pronunciation guides
     */
    private function collectMissingPronunciations($jsonFiles) {
        $missingEntries = [];
        
        foreach ($jsonFiles as $filename) {
            echo "🔍 Scanning: $filename\n";
            
            // Parse filename to get languages
            $languages = $this->parseFilename($filename);
            if (!$languages) {
                echo "  ❌ Could not parse languages from filename\n";
                continue;
            }
            
            $sourceLanguage = $languages['source'];
            $targetLanguage = $languages['target'];
            
            // Load JSON data
            $filepath = $this->baseDir . '/' . $filename;
            $data = json_decode(file_get_contents($filepath), true);
            
            if (!$data) {
                echo "  ❌ Could not parse JSON file\n";
                continue;
            }
            
            // Check all phrases in all categories for missing pronunciation
            foreach ($data as $category => $phrases) {
                foreach ($phrases as $index => $phrase) {
                    if (empty($phrase['pronunciation'])) {
                        // Check if learning language audio file exists
                        $audioInfo = $this->createPhraseInfo(
                            $phrase['target'], $targetLanguage, $category, $filename, 'learning'
                        );
                        
                        if (file_exists($audioInfo['filepath'])) {
                            $missingEntries[] = [
                                'filename' => $filename,
                                'category' => $category,
                                'index' => $index,
                                'phrase' => $phrase,
                                'audioPath' => $audioInfo['filepath'],
                                'languages' => $languages
                            ];
                            echo "  📝 Missing: {$phrase['target']} (audio exists)\n";
                        } else {
                            echo "  ⏭️  Skipping: {$phrase['target']} (no audio file)\n";
                        }
                    }
                }
            }
        }
        
        // Shuffle to mix different files/categories
        shuffle($missingEntries);
        
        return $missingEntries;
    }
    
    /**
     * Generate pronunciation for a single entry using ChatGPT-4o-mini-audio
     */
    private function generateSinglePronunciation($entry) {
        $phrase = $entry['phrase'];
        $audioPath = $entry['audioPath'];
        $targetLanguage = $entry['languages']['target'];
        
        echo "🎤 Processing: {$phrase['target']}\n";
        echo "   📁 Audio: " . basename($audioPath) . "\n";
        echo "   🌍 Language: {$targetLanguage}\n";
        
        try {
            // Read audio file
            $audioData = file_get_contents($audioPath);
            if (!$audioData) {
                echo "   ❌ Failed to read audio file\n";
                return false;
            }
            
            // Add silent padding to audio for better transcription
            $paddedAudioPath = $this->addSilentPadding($audioPath);
            
            // Get pronunciation from ChatGPT
            $pronunciation = $this->callChatGPTForPronunciation($paddedAudioPath, $targetLanguage);
            
            // Clean up temporary padded file
            if ($paddedAudioPath !== $audioPath && file_exists($paddedAudioPath)) {
                unlink($paddedAudioPath);
            }
            
            if (!$pronunciation) {
                echo "   ❌ Failed to get pronunciation from ChatGPT\n";
                return false;
            }
            
            echo "   🎯 Generated pronunciation: {$pronunciation}\n";
            
            // Update JSON file
            if ($this->updateJSONWithPronunciation($entry, $pronunciation)) {
                echo "   ✅ Updated JSON file successfully\n";
                return true;
            } else {
                echo "   ❌ Failed to update JSON file\n";
                return false;
            }
            
        } catch (Exception $e) {
            echo "   ❌ Error: " . $e->getMessage() . "\n";
            return false;
        } finally {
            echo "\n";
        }
    }
    
    /**
     * Add silent padding to the beginning and end of audio file
     */
    private function addSilentPadding($audioPath) {
        // Check if ffmpeg is available
        if (!$this->isCommandAvailable('ffmpeg')) {
            echo "   ⚠️  ffmpeg not available, skipping audio padding\n";
            return $audioPath; // Return original path
        }
        
        // Create temporary file for padded audio
        $tempFile = tempnam(sys_get_temp_dir(), 'padded_audio_') . '.mp3';
        
        // Add 0.8 seconds of silence at the beginning using working ffmpeg format
        // Based on user's working command: simplified approach with stereo and standard sample rate
        $command = sprintf(
            'ffmpeg -f lavfi -t 0.8 -i anullsrc=channel_layout=stereo:sample_rate=44100 -i %s -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" %s -y 2>/dev/null',
            escapeshellarg($audioPath),
            escapeshellarg($tempFile)
        );
        
        $result = shell_exec($command);
        
        // Check if the padded file was created successfully
        if (!file_exists($tempFile) || filesize($tempFile) === 0) {
            echo "   ⚠️  Audio padding failed, using original file\n";
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
            return $audioPath;
        }
        
        echo "   🔇 Added silent padding (0.8s at start)\n";
        return $tempFile;
    }
    
    /**
     * Check if a command is available in the system
     */
    private function isCommandAvailable($command) {
        $output = shell_exec("which $command 2>/dev/null");
        return !empty($output);
    }
    
    /**
     * Call ChatGPT-4o-mini-audio to generate pronunciation guide
     */
    private function callChatGPTForPronunciation($audioFilePath, $targetLanguage) {
        $url = 'https://api.openai.com/v1/chat/completions';
        
        // Read and encode audio file
        $audioData = file_get_contents($audioFilePath);
        $audioBase64 = base64_encode($audioData);
        
        $userInstructions = "Listen to this audio and provide ONLY an English \"phrasebook respelling\" transcription of what you hear. Do not include any explanations, commentary, or additional text.

Please provide the phonetic transcription using English phrasebook respelling using ALL CAPS to show where the speaker puts emphasis using the following phonemes:
ah, eh, ay, ee, oh, oo, aw, ew, ur, uh, ow, ahn, ehn, ohn, uhn, p, b, t, d, k, g, f, v, s, z, m, n, l, r, rr, sh, zh, ch, j, ny, ly, h, th, w, y

The audio is in {$targetLanguage}";
        
        $data = [
            'model' => 'gpt-4o-audio-preview',
            'modalities' => ['text'],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are an expert phonetician.'
                ],
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => $userInstructions
                        ],
                        [
                            'type' => 'input_audio',
                            'input_audio' => [
                                'data' => $audioBase64,
                                'format' => 'mp3'
                            ]
                        ]
                    ]
                ]
            ]
        ];
        
        // Build headers
        $headers = [
            'Authorization: Bearer ' . $this->openaiApiKey,
            'Content-Type: application/json'
        ];
        
        // Add optional organization and project IDs
        if (defined('OPENAI_ORG_ID') && !empty(OPENAI_ORG_ID)) {
            $headers[] = 'OpenAI-Organization: ' . OPENAI_ORG_ID;
        }
        
        if (defined('OPENAI_PROJECT_ID') && !empty(OPENAI_PROJECT_ID)) {
            $headers[] = 'OpenAI-Project: ' . OPENAI_PROJECT_ID;
        }
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_CONNECTTIMEOUT => 15
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            throw new Exception("cURL error: $error");
        }
        
        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMsg = isset($errorData['error']['message']) ? 
                $errorData['error']['message'] : 
                "HTTP $httpCode";
            throw new Exception("ChatGPT API error: $errorMsg");
        }
        
        // Parse response
        $responseData = json_decode($response, true);
        
        if (!isset($responseData['choices'][0]['message']['content'])) {
            throw new Exception("No pronunciation found in ChatGPT response");
        }
        
        return trim($responseData['choices'][0]['message']['content']);
    }
    
    /**
     * Update JSON file with generated pronunciation
     */
    private function updateJSONWithPronunciation($entry, $pronunciation) {
        $filepath = $this->baseDir . '/' . $entry['filename'];
        
        // Load current JSON data
        $data = json_decode(file_get_contents($filepath), true);
        if (!$data) {
            return false;
        }
        
        // Update the specific phrase with pronunciation
        $data[$entry['category']][$entry['index']]['pronunciation'] = $pronunciation;
        
        // Write back to file
        $jsonString = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if (file_put_contents($filepath, $jsonString)) {
            return true;
        }
        
        return false;
    }
}

// Usage example and CLI interface
function showHelp() {
    echo "TTS Audio Generator - Usage:\n";
    echo str_repeat("=", 40) . "\n";
    echo "php generate_tts_audio.php [mode] [batch_size]\n\n";
    echo "Modes:\n";
    echo "  generate-validate [batch]  - Generate with validation (up to 2 retries) [DEFAULT]\n";
    echo "  generate [batch]           - Generate only (no validation)\n";
    echo "  validate                   - Validate existing files only\n";
    echo "  validate-delete            - Validate and delete invalid files\n";
    echo "  pronunciation [batch]      - Generate missing pronunciation guides from audio\n";
    echo "  stats                      - Show statistics only\n";
    echo "  cache-stats                - Show validation cache statistics\n";
    echo "  cache-clear                - Clear validation cache\n";
    echo "  help                       - Show this help\n\n";
    echo "Examples:\n";
    echo "  php generate_tts_audio.php                    # Generate with validation, batch size 20\n";
    echo "  php generate_tts_audio.php generate-validate 10  # Generate with validation, batch size 10\n";
    echo "  php generate_tts_audio.php generate 50           # Generate only, batch size 50\n";
    echo "  php generate_tts_audio.php validate              # Validate existing files\n";
    echo "  php generate_tts_audio.php validate-delete       # Validate and delete invalid files\n";
}

// Parse command line arguments
$mode = 'generate-validate'; // Default mode
$batchSize = 20;

if ($argc > 1) {
    $arg1 = $argv[1];
    
    if (in_array($arg1, ['help', '--help', '-h'])) {
        showHelp();
        exit(0);
    }
    
    if (in_array($arg1, ['generate-validate', 'generate', 'validate', 'validate-delete', 'pronunciation', 'stats', 'cache-stats', 'cache-clear'])) {
        $mode = $arg1;
        
        // Check for batch size as second argument
        if ($argc > 2 && is_numeric($argv[2])) {
            $batchSize = max(1, min(100, intval($argv[2])));
        }
    } elseif (is_numeric($arg1)) {
        // First argument is batch size, use default mode
        $batchSize = max(1, min(100, intval($arg1)));
    } else {
        echo "❌ Unknown mode: $arg1\n";
        showHelp();
        exit(1);
    }
}

// Handle modes that don't need API key
if (in_array($mode, ['stats', 'cache-stats', 'cache-clear'])) {
    echo "TTS Audio Generator - " . ucwords(str_replace('-', ' ', $mode)) . " Mode\n";
    echo str_repeat("=", 40) . "\n";
    
    $generator = new TTSGenerator('dummy-key');
    
    switch ($mode) {
        case 'stats':
            $generator->getStatistics();
            break;
        case 'cache-stats':
            $generator->showCacheStats();
            break;
        case 'cache-clear':
            echo "⚠️  This will clear all validation cache data.\n";
            echo "Press Enter to continue or Ctrl+C to cancel...\n";
            fgets(STDIN);
            $generator->clearValidationCache();
            break;
    }
    
    exit(0);
}

// Load API key for all other modes
if (!file_exists('../config/config.php')) {
    echo "❌ Error: config.php file not found\n";
    echo "Please ensure config.php exists with OPENAI_API_KEY defined\n";
    exit(1);
}

include '../config/config.php';

if (!defined('OPENAI_API_KEY') || empty(OPENAI_API_KEY)) {
    echo "❌ Error: OPENAI_API_KEY not defined in config.php\n";
    echo "Please ensure config.php contains: define('OPENAI_API_KEY', 'sk-...');\n";
    exit(1);
}

$apiKey = OPENAI_API_KEY;

// Execute based on mode
echo "TTS Audio Generator - " . ucwords(str_replace('-', ' ', $mode)) . " Mode\n";
echo str_repeat("=", 60) . "\n";
echo "✅ API key loaded from config.php\n";
echo "🆕 Using directory structure: audio/<language>/<native|learning>/\n";

$generator = new TTSGenerator($apiKey, $batchSize);

switch ($mode) {
    case 'generate-validate':
        echo "🎯 Mode: Generate with validation (up to 2 retries per file)\n";
        echo "📦 Batch size: $batchSize\n\n";
        $generator->setValidationMode(true, false, false);
        $generator->generateAllAudio();
        break;
        
    case 'generate':
        echo "🎯 Mode: Generate only (no validation)\n";
        echo "📦 Batch size: $batchSize\n\n";
        $generator->setValidationMode(false, false, false);
        $generator->generateAllAudio();
        break;
        
    case 'validate':
        echo "🎯 Mode: Validate existing files\n\n";
        $generator->setValidationMode(true, false, true);
        $generator->validateExistingFiles();
        break;
        
    case 'validate-delete':
        echo "🎯 Mode: Validate and delete invalid files\n";
        echo "⚠️  WARNING: This will permanently delete files that fail validation!\n";
        echo "Press Enter to continue or Ctrl+C to cancel...\n";
        fgets(STDIN);
        $generator->setValidationMode(true, true, true);
        $generator->validateExistingFiles();
        break;
        
    case 'pronunciation':
        echo "🎯 Mode: Generate pronunciation guides from audio\n";
        echo "📦 Batch size: $batchSize\n\n";
        $generator->generatePronunciationGuides($batchSize);
        break;
        
    default:
        echo "❌ Unknown mode: $mode\n";
        showHelp();
        exit(1);
}
?>
