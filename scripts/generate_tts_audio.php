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
        
        try {
            // Generate TTS audio - speed now explicitly determined by phraseInfo
            $isNativeSpeed = ($phraseInfo['speed'] === 'native');
            $audioData = $this->callOpenAITTS($phraseInfo['text'], $phraseInfo['language'], $isNativeSpeed);
            
            if ($audioData) {
                // Save to file
                file_put_contents($phraseInfo['filepath'], $audioData);
                echo "   ✅ Saved: " . number_format(strlen($audioData)) . " bytes\n";
                $this->generatedCount++;
                
                // Small delay to be nice to the API
                usleep(200000); // 200ms delay between generations
            } else {
                echo "   ❌ Failed to generate audio\n";
                $this->errorCount++;
            }
        } catch (Exception $e) {
            echo "   ❌ Error: " . $e->getMessage() . "\n";
            $this->errorCount++;
        }
        
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
                    'content' => "Speak this text in {$language} exactly as it is written including any test in parentheses: {$text}"
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
}

// Usage example and CLI interface
if ($argc > 1 && $argv[1] === 'stats') {
    // Show statistics only
    echo "TTS Audio Generator - Statistics Mode\n";
    echo str_repeat("=", 40) . "\n";
    
    $generator = new TTSGenerator('dummy-key');
    $generator->getStatistics();
    
} else {
    // Main generation mode
    echo "TTS Audio Generator for Language Learning (Updated Structure)\n";
    echo str_repeat("=", 60) . "\n";
    
    // Load API key from config.php
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
    echo "✅ API key loaded from config.php\n";
    echo "🆕 Using new directory structure: audio/<language>/<native|learning>/\n\n";
    
    // Get batch size from command line (default 20)
    $batchSize = 20;
    if ($argc > 1 && is_numeric($argv[1])) {
        $batchSize = max(1, min(100, intval($argv[1]))); // Limit between 1-100
    }
    
    $generator = new TTSGenerator($apiKey, $batchSize);
    $generator->generateAllAudio();
}
?>
