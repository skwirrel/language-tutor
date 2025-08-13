# LearningQueue Documentation (v2.1)

## Overview

LearningQueue is a sophisticated spaced repetition system designed for language learning applications. It uses an advanced binary pass/fail algorithm with 20-item memory tracking to optimize vocabulary retention based on user performance. The system supports multiple difficulty levels and provides intelligent learning history for enhanced educational experiences.

## Key Features

- **Advanced Binary Pass/Fail Algorithm**: Tests move through the queue based on success rate with configurable thresholds
- **20-Item Memory System**: Tracks last 20 attempts for reliable learning analytics  
- **Enhanced History Tracking**: Provides detailed learning history for intelligent pre-pronunciation
- **Multi-Level Progression**: Support for different difficulty levels (basic, intermediate, advanced, etc.)
- **Category Management**: Organize tests by topic (travel, food, health, etc.) with dynamic enable/disable
- **Persistent Storage**: Automatically saves progress to localStorage with level isolation
- **Success Rate Calculation**: Movement scales based on mathematical success rate curves
- **Complete Queue Inspection**: View entire queue state, statistics, and progress tracking
- **Enhanced Test Management**: Comprehensive test lifecycle with detailed analytics

## Installation

```javascript
// Include the LearningQueue.js file in your project
<script src="path/to/LearningQueue.js"></script>

// Or import as module
import { LearningQueue } from './LearningQueue.js';
```

## Data Format

Create JSON files in your specified directory with the naming convention: `{sourceLanguage}-{targetLanguage}-{level}.json`

**Example files:**
- `english-italian-basic.json`
- `english-italian-intermediate.json`
- `english-italian-advanced.json`

```json
{
  "travel": [
    {
      "source": "Where is the bathroom?",
      "target": "Dove è il bagno?"
    },
    {
      "source": "How much does this cost?",
      "target": "Quanto costa questo?"
    }
  ],
  "food": [
    {
      "source": "I am hungry",
      "target": "Ho fame"
    },
    {
      "source": "The bill please",
      "target": "Il conto per favore"
    }
  ]
}
```

### Level Progression Examples

**Basic Level** (`english-italian-basic.json`):
- Simple greetings: "Hello" → "Ciao"
- Essential phrases: "Thank you" → "Grazie"
- Basic questions: "How are you?" → "Come stai?"

**Intermediate Level** (`english-italian-intermediate.json`):
- Complex sentences: "I would like to make a reservation" → "Vorrei fare una prenotazione"
- Past/future tenses: "I went to the market yesterday" → "Sono andato al mercato ieri"

**Advanced Level** (`english-italian-advanced.json`):
- Idiomatic expressions: "It's raining cats and dogs" → "Piove a catinelle"
- Professional vocabulary: "Let's schedule a meeting" → "Programmiamo una riunione"

## Basic Usage

```javascript
// Create a new learning queue at basic level with binary algorithm options
const basicQueue = new LearningQueue('english', 'italian', 'basic', 'learning/', {
  passThreshold: 7,           // Score ≥ 7 counts as pass
  memoryLength: 20,           // Track last 20 attempts
  repetitivenessFactor: 5     // Curve steepness for movement
});

// Wait for initialization to complete
await basicQueue.init();

// Get the next test (now includes learning history)
const test = basicQueue.getNextTest();
console.log(test);
// Output: { 
//   source: "Hello", 
//   target: "Ciao", 
//   category: "greetings",
//   recentResults: [0, 1, 0, 1, 1] // Last 5 attempts (0=fail, 1=pass)
// }

// Score the user's response (1-10 scale, 0 for no response)
basicQueue.scoreCurrentTest(8); // Score gets converted to pass/fail internally

// Progress to next level when ready
const advancedQueue = new LearningQueue('english', 'italian', 'advanced');
await advancedQueue.init();
```

### Level Progression Strategy

```javascript
// Check if user is ready for next level
function checkLevelProgression(queue) {
    const stats = queue.getQueueStats();
    
    // Example criteria: 80% of tests have positive success rate
    const masteryRate = stats.inertiaDistribution.positive / stats.totalItems;
    
    if (masteryRate > 0.8) {
        console.log('Ready for next level!');
        // Initialize next level queue
        return true;
    }
    return false;
}
```

## API Reference

### Constructor

```javascript
new LearningQueue(sourceLanguage, targetLanguage, level = 'basic', baseDir = '/learning/', options = {})
```

- `sourceLanguage` (string): User's native language
- `targetLanguage` (string): Language being learned
- `level` (string): Difficulty level (e.g., 'basic', 'intermediate', 'advanced')
- `baseDir` (string): Directory containing test data files (supports relative paths)
- `options` (object, **NEW in v2.1**): Binary algorithm configuration

**Options Object (NEW in v2.1):**
```javascript
const options = {
  passThreshold: 7,           // Score ≥ this counts as pass (1-10)
  memoryLength: 20,           // Number of recent attempts to remember
  repetitivenessFactor: 5     // Movement curve steepness (1-10)
};
```

**Enhanced Constructor Behavior:**
- Tests now start with **empty recentResults array** for proper history tracking
- Supports relative paths for subdirectory deployment
- Enhanced error handling and fallback data
- **Manual initialization required**: Must call `await queue.init()` after construction

### Initialization

```javascript
// Manual initialization (required)
await learningQueue.init();
```

**Important:** The constructor no longer automatically calls `init()`. You must call it manually to control when async initialization happens.

### Category Management

```javascript
// Get all categories and their enabled state
const categories = learningQueue.getCategories();
// Returns: ["travel", "food", "health"] (array of category names)

// Enable or disable a category
learningQueue.setCategory('travel', true);   // Enable travel category
learningQueue.setCategory('food', false);    // Disable food category
```

**Enhanced Category API:**
- `getCategories()` returns array of category names for consistency
- `setCategory()` provides clean enable/disable interface
- Enhanced category synchronization with database

### Learning Flow

```javascript
// Get next test from front of queue (now includes history)
const test = learningQueue.getNextTest();
// Returns: { 
//   source: string, 
//   target: string, 
//   category: string,
//   recentResults: [0,1,1,0,1,...] // Array of last attempts (0=fail, 1=pass)
// } or null

// Score the current test and move it in the queue
learningQueue.scoreCurrentTest(score); // Accepts 0-10, converts to binary internally
```

**Enhanced Scoring System (v2.1):**
- **Score 0**: No response detected - queue remains unchanged, same test repeats
- **Scores 1-10**: Converted to binary pass/fail based on `passThreshold`
- **Pass/Fail Logic**: `score >= passThreshold` counts as pass (1), otherwise fail (0)
- **Memory Tracking**: Last 20 results stored in `recentResults` array
- **Success Rate**: Calculated as `passes / totalAttempts` in recent memory

**Special Score 0 Handling:**
When `scoreCurrentTest(0)` is called, the queue remains completely unchanged, allowing the same test to be repeated without penalty.

### Queue Inspection (Enhanced)

```javascript
// Get complete queue state (no limit by default)
const fullQueue = learningQueue.getTopQueueItems();
// Returns: Array of all queue items with position, source, target, successRate, category, history

// Get limited queue preview
const preview = learningQueue.getTopQueueItems(20);
// Returns: Array of top 20 items

// Get queue length
const length = learningQueue.getQueueLength();

// Get detailed queue statistics
const stats = learningQueue.getQueueStats();
console.log(stats);
/* Returns:
{
  totalItems: 150,
  categories: {
    "travel": 45,
    "food": 38,
    "health": 25,
    "greetings": 42
  },
  inertiaDistribution: {
    negative: 23,  // Items with success rate < 30%
    neutral: 67,   // Items with success rate 30-70%  
    positive: 60   // Items with success rate > 70%
  }
}
*/
```

**Enhanced Queue Item Structure (v2.1):**
```javascript
{
  position: 1,                    // Position in queue (1-based)
  source: "Good morning",         // Source language text
  target: "Buongiorno",          // Target language text
  category: "greetings",         // Category name
  recentResults: [0,1,1,0,1,1,1,0,1,1], // Last attempts (0=fail, 1=pass)
  successRate: 0.7               // Calculated success rate (0.0-1.0)
}
```

### Management Operations (Enhanced)

```javascript
// Reset to initial state (enhanced with logging)
learningQueue.reset();

// Update algorithm options during runtime
learningQueue.updateOptions({
  passThreshold: 8,           // Make passing harder
  repetitivenessFactor: 7     // Make tests more sticky
});

// Get current options
const currentOptions = learningQueue.getOptions();
```

## Advanced Binary Algorithm (v2.1)

### Binary Pass/Fail System

Each test tracks a **success rate** based on recent performance:

- **Pass**: Score ≥ `passThreshold` (default 7) → adds 1 to history
- **Fail**: Score < `passThreshold` → adds 0 to history
- **Memory Length**: Tracks last 20 attempts (configurable)
- **Success Rate**: `passes / totalAttempts` in recent memory

### Enhanced Algorithm Details

**Binary Conversion:**
```javascript
// Example with passThreshold = 7
scoreCurrentTest(8);  // → Pass (1) added to recentResults
scoreCurrentTest(6);  // → Fail (0) added to recentResults
scoreCurrentTest(10); // → Pass (1) added to recentResults
// recentResults: [1, 0, 1] → success rate: 2/3 = 0.67
```

**Queue Movement Calculation:**
```javascript
// Success rate determines position in queue
const successRate = passes / attempts;
const power = 2 + (repetitivenessFactor - 1) * 0.2; // Maps 1-10 to 2.0-3.8
const movement = Math.pow(successRate, power);
const newPosition = Math.floor(movement * queueLength);
```

**Movement Examples with 100-item queue:**
```javascript
// repetitivenessFactor = 5 → power = 2.8

// New phrase (no attempts): position 1 (front)
// Success rate 0%: 0^2.8 = 0 → position 0 (front) 
// Success rate 50%: 0.5^2.8 = 0.18 → position 18
// Success rate 80%: 0.8^2.8 = 0.57 → position 57
// Success rate 100%: 1.0^2.8 = 1.0 → position 100 (back)
```

### Memory Management (20-Item System)

**History Tracking:**
```javascript
// Example progression for a single phrase
attempt 1:  [1] → 100% (but only 1 sample)
attempt 5:  [1,0,1,1,0] → 60% (3/5 passes)
attempt 20: [1,0,1,1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1] → 80% (16/20 passes)
attempt 21: [0,1,1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0] → 75% (15/20 passes)
```

**Memory Benefits:**
- **Reliable statistics**: 20 attempts provide stable success rate
- **Manageable storage**: Fixed-size arrays prevent memory bloat
- **Recent focus**: Only latest attempts influence position
- **History visibility**: Complete learning journey available for analysis

### Enhanced Learning Dynamics

**New Tests (Empty History)**
- Added with empty `recentResults` array
- Start at front of queue (position 1)
- Build history as user attempts them

**Struggling Tests (Low Success Rate)**
- Tests with < 30% success rate stay near front
- Require sustained improvement to advance
- Multiple failed attempts keep them "sticky"

**Mastered Tests (High Success Rate)**
- Tests with > 70% success rate move toward back
- Eventually seen very infrequently
- Success breeds less frequent review

**Adaptive Recovery**
- Poor performance quickly moves tests forward
- Good performance gradually moves tests back
- Balanced approach prevents both stagnation and premature advancement

## Storage (Enhanced)

- **Automatic persistence**: Queue state and category selections saved to localStorage
- **Language isolation**: Each language pair has separate storage
- **Level isolation**: Each difficulty level maintains separate progress
- **Enhanced state synchronization**: Queue automatically syncs with test database changes
- **Relative path support**: Works in subdirectories for flexible deployment
- **History preservation**: Complete learning history maintained across sessions

Storage key format: `learning_queue_{sourceLanguage}_{targetLanguage}_{level}`

**Example storage keys:**
- `learning_queue_english_italian_basic`
- `learning_queue_english_italian_intermediate`
- `learning_queue_english_spanish_advanced`

## Queue Statistics and Analytics (Enhanced)

### Detailed Statistics

```javascript
const stats = learningQueue.getQueueStats();
```

**Response Object:**
```javascript
{
  totalItems: 150,
  categories: {
    "travel": 45,      // Number of travel tests
    "food": 38,        // Number of food tests  
    "health": 25,      // Number of health tests
    "greetings": 42    // Number of greeting tests
  },
  inertiaDistribution: {
    negative: 23,      // Tests with success rate < 30% (struggling)
    neutral: 67,       // Tests with success rate 30-70% (learning)
    positive: 60       // Tests with success rate > 70% (mastered)
  }
}
```

### Complete Queue Inspection

```javascript
// View entire queue with enhanced information
const fullQueue = learningQueue.getTopQueueItems();

// Each item contains:
{
  position: 1,                    // Position in queue (1-based)
  source: "Good morning",         // Source language text
  target: "Buongiorno",          // Target language text
  category: "greetings",         // Category name
  recentResults: [0,1,1,0,1,1,1,0,1,1], // Last 20 attempts (binary)
  successRate: 0.7               // Calculated success rate (0.0-1.0)
}
```

## Error Handling (Enhanced)

- **Graceful fallback** if test data file cannot be loaded
- **Protection against corrupted localStorage** data
- **Boundary checks** for queue operations
- **Automatic state recovery** with enhanced error reporting
- **Comprehensive logging** for debugging
- **Relative path error handling** for deployment flexibility
- **History validation** ensures recentResults array integrity

## Integration Examples (Enhanced)

### With Enhanced AI Scoring and History

```javascript
const queue = new LearningQueue('english', 'italian', 'basic', 'learning/', {
  passThreshold: 7,
  memoryLength: 20,
  repetitivenessFactor: 5
});
await queue.init();

async function enhancedLearningSession() {
    const test = queue.getNextTest();
    if (test) {
        console.log(`Testing: "${test.source}"`);
        console.log(`History: ${test.recentResults.join(',')} (${test.recentResults.filter(r => r).length}/${test.recentResults.length} passes)`);
        
        // AI scoring with history awareness
        const result = await aiTutor.test(test.source, test.target, test.recentResults);
        
        if (result.score === 0) {
            // No response - don't affect queue, repeat same test
            console.log('No response detected, repeating...');
        } else {
            // Valid score - update queue with binary algorithm
            queue.scoreCurrentTest(result.score);
            const passed = result.score >= 7;
            console.log(`Scored ${result.score}/10 (${passed ? 'PASS' : 'FAIL'})`);
        }
    }
}
```

### With Queue Visualization

```javascript
function displayQueuePreview(queue, maxItems = 20) {
    const preview = queue.getTopQueueItems(maxItems);
    const stats = queue.getQueueStats();
    
    console.log(`Queue Preview (${stats.totalItems} total items):`);
    console.log(`Distribution: ${stats.inertiaDistribution.negative} struggling, ${stats.inertiaDistribution.neutral} learning, ${stats.inertiaDistribution.positive} mastered`);
    
    preview.forEach(item => {
        const status = item.successRate < 0.3 ? '🔴' : item.successRate > 0.7 ? '🟢' : '🟡';
        const passCount = item.recentResults.filter(r => r).length;
        const totalAttempts = item.recentResults.length;
        
        console.log(`${status} #${item.position}: ${item.source} (${passCount}/${totalAttempts} = ${(item.successRate * 100).toFixed(0)}%)`);
    });
}
```

### Category-Based Analytics (Enhanced)

```javascript
function analyzeLearningProgress(queue) {
    const stats = queue.getQueueStats();
    
    console.log('\n📊 Learning Progress Analysis:');
    console.log(`Total Tests: ${stats.totalItems}`);
    
    // Category breakdown
    console.log('\n📚 By Category:');
    Object.entries(stats.categories).forEach(([category, count]) => {
        const percentage = ((count / stats.totalItems) * 100).toFixed(1);
        console.log(`  ${category}: ${count} tests (${percentage}%)`);
    });
    
    // Progress breakdown  
    console.log('\n📈 Progress Distribution:');
    const { negative, neutral, positive } = stats.inertiaDistribution;
    console.log(`  🔴 Struggling: ${negative} (${((negative/stats.totalItems)*100).toFixed(1)}%)`);
    console.log(`  🟡 Learning: ${neutral} (${((neutral/stats.totalItems)*100).toFixed(1)}%)`);
    console.log(`  🟢 Mastered: ${positive} (${((positive/stats.totalItems)*100).toFixed(1)}%)`);
    
    // Readiness assessment
    const masteryRate = positive / stats.totalItems;
    if (masteryRate > 0.8) {
        console.log('\n🎉 Ready for next level!');
    } else if (masteryRate > 0.5) {
        console.log('\n📚 Good progress, keep practicing!');
    } else {
        console.log('\n💪 Focus on current level mastery.');
    }
}
```

### Advanced Queue Management with Binary Algorithm

```javascript
// Queue management with binary algorithm controls
class EnhancedQueueManager {
    constructor(sourceLanguage, targetLanguage, level) {
        this.queue = new LearningQueue(sourceLanguage, targetLanguage, level, 'learning/', {
            passThreshold: 7,
            memoryLength: 20,
            repetitivenessFactor: 5
        });
    }
    
    async initialize() {
        await this.queue.init();
        console.log('✅ Enhanced queue initialized');
        this.showStatus();
    }
    
    showStatus() {
        const stats = this.queue.getQueueStats();
        console.log(`\n📊 Queue Status: ${stats.totalItems} total tests`);
        console.log(`🔴 ${stats.inertiaDistribution.negative} struggling (< 30% success)`);
        console.log(`🟡 ${stats.inertiaDistribution.neutral} learning (30-70% success)`); 
        console.log(`🟢 ${stats.inertiaDistribution.positive} mastered (> 70% success)`);
    }
    
    adjustDifficulty(newPassThreshold, newRepetitiveness) {
        this.queue.updateOptions({
            passThreshold: newPassThreshold,
            repetitivenessFactor: newRepetitiveness
        });
        console.log(`🎛️ Updated: passThreshold=${newPassThreshold}, repetitiveness=${newRepetitiveness}`);
    }
    
    exportProgress() {
        const stats = this.queue.getQueueStats();
        const fullQueue = this.queue.getTopQueueItems();
        
        return {
            timestamp: new Date().toISOString(),
            algorithm: 'binary_pass_fail_v2.1',
            statistics: stats,
            queueState: fullQueue,
            options: this.queue.getOptions()
        };
    }
    
    generateLearningReport() {
        const fullQueue = this.queue.getTopQueueItems();
        const report = {
            totalPhrases: fullQueue.length,
            averageSuccessRate: 0,
            categoryBreakdown: {},
            strugglingPhrases: [],
            masteredPhrases: []
        };
        
        let totalSuccessRate = 0;
        
        fullQueue.forEach(item => {
            // Calculate average success rate
            totalSuccessRate += item.successRate;
            
            // Category breakdown
            if (!report.categoryBreakdown[item.category]) {
                report.categoryBreakdown[item.category] = {
                    count: 0,
                    averageSuccess: 0
                };
            }
            report.categoryBreakdown[item.category].count++;
            report.categoryBreakdown[item.category].averageSuccess += item.successRate;
            
            // Identify struggling and mastered phrases
            if (item.successRate < 0.3) {
                report.strugglingPhrases.push({
                    phrase: item.source,
                    category: item.category,
                    successRate: item.successRate,
                    attempts: item.recentResults.length
                });
            } else if (item.successRate > 0.8) {
                report.masteredPhrases.push({
                    phrase: item.source,
                    category: item.category,
                    successRate: item.successRate
                });
            }
        });
        
        // Calculate averages
        report.averageSuccessRate = totalSuccessRate / fullQueue.length;
        
        Object.keys(report.categoryBreakdown).forEach(category => {
            const cat = report.categoryBreakdown[category];
            cat.averageSuccess = cat.averageSuccess / cat.count;
        });
        
        return report;
    }
}
```

## Performance Considerations (Enhanced)

- **Memory efficient**: Binary arrays (0s and 1s) with fixed 20-item limit per test
- **Fast operations**: O(1) queue operations with array splice
- **Minimal storage**: Only essential state and 20-item history persisted
- **Scalable algorithm**: Performance independent of queue size
- **Enhanced caching**: Improved localStorage efficiency with history compression
- **Relative path support**: Reduces server configuration requirements

## Best Practices (Enhanced)

1. **Binary algorithm tuning**: Adjust `passThreshold` and `repetitivenessFactor` for optimal learning
2. **Category organization**: Group related tests logically for better learning flow  
3. **Data quality**: Ensure test translations are accurate and appropriate for level
4. **Progress monitoring**: Use queue statistics and success rates to track learning effectiveness
5. **Session management**: Monitor success rate distribution to guide learning sessions
6. **Level progression**: Use mastery rates (> 70% success) to determine readiness for advancement
7. **Error handling**: Always call `await queue.init()` before using the queue
8. **Queue inspection**: Regularly check queue state and learning history for insights
9. **History integration**: Pass `recentResults` to other components for intelligent behavior

## Migration from v2.0

### Breaking Changes
- **Constructor**: Now accepts `options` parameter for binary algorithm configuration
- **getNextTest()**: Now returns `recentResults` array containing learning history
- **Scoring algorithm**: Now uses binary pass/fail with success rate calculation
- **Queue movement**: Now based on mathematical success rate curves instead of inertia

### New Features
- **20-item memory**: Enhanced from 5-item to 20-item for better learning analytics
- **Binary algorithm**: Pass/fail system with configurable threshold
- **Success rate tracking**: Mathematical success rate calculation
- **History integration**: Complete learning history available for other components
- **Enhanced options**: Runtime option updates with `updateOptions()`
- **Better analytics**: Detailed success rate distributions and progress tracking

### Migration Example
```javascript
// v2.0
const queue = new LearningQueue('english', 'italian');
const test = queue.getNextTest(); // { source, target, inertia, category }
queue.scoreCurrentTest(8); // Inertia-based movement

// v2.1
const queue = new LearningQueue('english', 'italian', 'basic', 'learning/', {
    passThreshold: 7,
    memoryLength: 20,
    repetitivenessFactor: 5
});
await queue.init(); // Required manual initialization
const test = queue.getNextTest(); // { source, target, category, recentResults }
queue.scoreCurrentTest(8); // Binary pass/fail with success rate movement
```

## Troubleshooting (Enhanced)

### Common Issues

**Queue appears empty after language change**
- Ensure `await queue.init()` is called after creating new instance
- Check that test data file exists at correct relative path
- Verify all categories aren't disabled
- Check browser console for loading errors

**Tests not moving as expected with good scores**
- Check `passThreshold` setting - scores must be ≥ threshold to count as pass
- Remember: new binary algorithm requires multiple passes to move significantly
- Use `getQueueStats()` to monitor success rate distribution
- Verify `repetitivenessFactor` isn't set too high (making tests too sticky)

**Same test repeating indefinitely**
- Check if score 0 is being passed (preserves queue state)
- Verify `scoreCurrentTest()` is being called with valid 1-10 scores
- Use queue inspection to verify success rates are changing
- Check that `passThreshold` is reasonable for user skill level

**History not showing correctly**
- Ensure `recentResults` array is being passed to other components
- Check that queue state is being saved to localStorage properly
- Verify that `recentResults` contains expected 0s and 1s

**Algorithm tuning issues**
- Lower `passThreshold` if progression is too slow
- Raise `passThreshold` if progression is too fast
- Adjust `repetitivenessFactor` to control how sticky difficult tests are
- Use `updateOptions()` to test different settings without recreating queue

### Debug Information

```javascript
// Enable comprehensive debugging
const queue = new LearningQueue('english', 'italian', 'basic', 'learning/', {
    passThreshold: 7,
    memoryLength: 20,
    repetitivenessFactor: 5
});
await queue.init();

// Monitor queue state and algorithm behavior
console.log('Queue length:', queue.getQueueLength());
console.log('Queue stats:', queue.getQueueStats());
console.log('Categories:', queue.getCategories());
console.log('Current options:', queue.getOptions());

// Test progression tracking with binary algorithm
const test = queue.getNextTest();
console.log('Current test:', test);
console.log('Learning history:', test.recentResults);
console.log('Current success rate:', test.recentResults.filter(r => r).length / test.recentResults.length);

queue.scoreCurrentTest(8);
const updatedTest = queue.getNextTest();
console.log('Success rate after scoring:', updatedTest?.recentResults.filter(r => r).length / updatedTest?.recentResults.length);
```

## Browser Compatibility

- Modern browsers with ES6+ support
- localStorage API required for persistence
- Fetch API for loading test data
- No external dependencies
- Relative path support for flexible deployment

## Changelog

### v2.1.0
- **Enhanced**: Binary pass/fail algorithm with 20-item memory system
- **Added**: Learning history tracking with `recentResults` array in `getNextTest()`
- **Added**: Configurable options with `passThreshold`, `memoryLength`, and `repetitivenessFactor`
- **Added**: Success rate calculation and movement based on mathematical curves
- **Added**: Runtime option updates with `updateOptions()` method
- **Updated**: Queue statistics now show success rate distributions instead of inertia
- **Updated**: Constructor no longer auto-calls `init()` - manual initialization required
- **Updated**: Enhanced queue inspection with complete learning history
- **Enhanced**: Improved error handling and state validation

### v2.0.0
- Initial release with basic spaced repetition algorithm

---

*Engineered for effective language learning through scientifically-based binary spaced repetition with comprehensive learning analytics*
