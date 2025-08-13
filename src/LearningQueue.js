/**
 * LearningQueue - Adaptive Spaced Repetition System
 * 
 * A sophisticated queue-based language learning system that uses AI-scored responses
 * and inertia-based movement to optimize vocabulary retention.
 */

export class LearningQueue {
  constructor(sourceLanguage, targetLanguage, level = 'basic', baseDir = '/learning/', options = {}) {
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;
    this.baseDir = baseDir;
    this.level = level;
    this.testDatabase = {};
    this.queue = [];
    this.categories = {};
    this.currentTestIndex = 0;
    this.storageKey = `learning_queue_${sourceLanguage}_${targetLanguage}_${level}`;
    
    // Initialize options with defaults
    this.options = {
      passThreshold: 7,
      memoryLength: 20,
      repetitivenessFactor: 5,
      ...options
    };
    
    // Don't call init() automatically - let the caller control when it happens
  }
  
  async init() {
    await this.loadTestData();
    this.loadState();
  }
  
  async loadTestData() {
    try {
      const filename = `${this.sourceLanguage}-${this.targetLanguage}-${this.level}.json`;
      const response = await fetch(`${this.baseDir}${filename}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load test data: ${response.status}`);
      }
      
      this.testDatabase = await response.json();
    } catch (error) {
      console.error('Error loading test data:', error);
      // Fallback to sample data for demo
      this.testDatabase = {
        "travel": [
          { source: "Good morning", target: "Buongiorno" },
          { source: "Where is the station?", target: "Dove è la stazione?" },
          { source: "Thank you very much", target: "Grazie mille" }
        ],
        "food": [
          { source: "I would like a coffee", target: "Vorrei un caffè" },
          { source: "How much does it cost?", target: "Quanto costa?" },
          { source: "The bill please", target: "Il conto per favore" }
        ]
      };
    }
  }
  
  loadState() {
    const savedState = localStorage.getItem(this.storageKey);
    
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        this.categories = state.categories || {};
        this.queue = state.queue || [];
        
        this.syncQueueWithDatabase();
      } catch (error) {
        console.error('Error loading saved state:', error);
        this.initializeAllCategories();
      }
    } else {
      this.initializeAllCategories();
    }
  }
  
  syncQueueWithDatabase() {
    const expectedTests = new Set();
    
    for (const [categoryName, isSelected] of Object.entries(this.categories)) {
      if (isSelected && this.testDatabase[categoryName]) {
        this.testDatabase[categoryName].forEach(test => {
          expectedTests.add(this.createTestId(test));
        });
      }
    }
    
    this.queue = this.queue.filter(item => {
      const testId = this.createTestId({ source: item.source, target: item.target });
      return expectedTests.has(testId);
    });
    
    const currentTestIds = new Set(this.queue.map(item => 
      this.createTestId({ source: item.source, target: item.target })
    ));
    
    for (const [categoryName, isSelected] of Object.entries(this.categories)) {
      if (isSelected && this.testDatabase[categoryName]) {
        this.testDatabase[categoryName].forEach(test => {
          const testId = this.createTestId(test);
          if (!currentTestIds.has(testId)) {
            this.addTestToQueue(test, categoryName);
          }
        });
      }
    }
  }
  
  initializeAllCategories() {
    // Don't automatically enable all categories - let the UI control this
    for (const categoryName of Object.keys(this.testDatabase)) {
      this.categories[categoryName] = false; // Start with all disabled
    }
  }
  
  createTestId(test) {
    return `${test.source}|${test.target}`;
  }
  
  addTestToQueue(test, categoryName) {
    const queueItem = {
      source: test.source,
      target: test.target,
      inertia: -1, // Start at maximum resistance - phrases are "sticky" until learned
      category: categoryName,
      recentResults: new Array(this.options.memoryLength).fill(0) // Initialize with full history of failures
    };
    
    const randomIndex = Math.floor(Math.random() * (this.queue.length + 1));
    this.queue.splice(randomIndex, 0, queueItem);
  }
  
  addCategoryToQueue(categoryName) {
    if (this.testDatabase[categoryName]) {
      this.testDatabase[categoryName].forEach(test => {
        this.addTestToQueue(test, categoryName);
      });
    }
  }
  
  removeCategoryFromQueue(categoryName) {
    if (!this.testDatabase[categoryName]) return;
    
    const categoryTestIds = new Set(
      this.testDatabase[categoryName].map(test => this.createTestId(test))
    );
    
    this.queue = this.queue.filter(item => {
      const testId = this.createTestId({ source: item.source, target: item.target });
      return !categoryTestIds.has(testId);
    });
    
    if (this.currentTestIndex >= this.queue.length) {
      this.currentTestIndex = 0;
    }
  }
  
  getCategories() {
    return Object.keys(this.testDatabase);
  }
  
  setCategory(categoryName, enabled) {
    if (enabled && !this.categories[categoryName]) {
      this.categories[categoryName] = true;
      this.addCategoryToQueue(categoryName);
    } else if (!enabled && this.categories[categoryName]) {
      this.categories[categoryName] = false;
      this.removeCategoryFromQueue(categoryName);
    }
    
    this.saveState();
  }
  
  getNextTest() {
    if (this.queue.length === 0) {
      return null;
    }
    
    if (this.currentTestIndex >= this.queue.length) {
      this.currentTestIndex = 0;
    }
    
    const test = this.queue[this.currentTestIndex];
    return {
      source: test.source,
      target: test.target,
      inertia: test.inertia,
      category: test.category,
      recentResults: test.recentResults || [] // Include history in response
    };
  }
  
  scoreCurrentTest(score) {
    if (this.queue.length === 0 || this.currentTestIndex >= this.queue.length) {
      return;
    }
    
    const currentTest = this.queue.splice(this.currentTestIndex, 1)[0];
    
    // Update binary algorithm with memory
    if (!currentTest.recentResults) {
      currentTest.recentResults = [];
    }
    
    // Add new result (1 for pass, 0 for fail)
    const passed = score >= this.options.passThreshold;
    currentTest.recentResults.push(passed ? 1 : 0);
    
    // Keep only last N results
    const memoryLength = this.options.memoryLength;
    if (currentTest.recentResults.length > memoryLength) {
      currentTest.recentResults = currentTest.recentResults.slice(-memoryLength);
    }
    
    // Calculate success rate
    const successCount = currentTest.recentResults.reduce((sum, result) => sum + result, 0);
    const successRate = currentTest.recentResults.length > 0 ? successCount / currentTest.recentResults.length : 0;
    
    // Calculate movement based on success rate and repetitiveness factor
    const repetitivenessFactor = this.options.repetitivenessFactor;
    const power = 2 + (repetitivenessFactor - 1) * 0.2; // Maps 1-10 to 2.0-3.8
    const movement = Math.pow(successRate, power);
    
    // Calculate new position in queue
    const newPosition = Math.min(Math.floor(movement * this.queue.length), this.queue.length);
    
    this.queue.splice(newPosition, 0, currentTest);
    
    this.currentTestIndex = 0;
    
    this.saveState();
  }
  
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }
  
  saveState() {
    const state = {
      categories: this.categories,
      queue: this.queue
    };
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving state to localStorage:', error);
    }
  }
  
  getQueueLength() {
    return this.queue.length;
  }
  
  getTopQueueItems(count = null) {
    const itemsToShow = count ? Math.min(count, this.queue.length) : this.queue.length;
    return this.queue.slice(0, itemsToShow).map((item, index) => {
      const successCount = item.recentResults ? item.recentResults.reduce((sum, result) => sum + result, 0) : 0;
      const successRate = item.recentResults && item.recentResults.length > 0 ? successCount / item.recentResults.length : 0;
      
      return {
        position: index + 1,
        source: item.source,
        target: item.target,
        inertia: item.inertia,
        category: item.category,
        recentResults: item.recentResults || [],
        successRate: successRate
      };
    });
  }
  
  reset() {
    console.log('🔄 Resetting LearningQueue to initial state');
    this.queue = [];
    this.categories = {};
    this.currentTestIndex = 0;
    localStorage.removeItem(this.storageKey);
    this.initializeAllCategories();
    console.log('✅ LearningQueue reset complete');
  }
  
  getQueueStats() {
    const stats = {
      totalItems: this.queue.length,
      categories: {},
      inertiaDistribution: {
        negative: 0,
        neutral: 0,
        positive: 0
      }
    };
    
    // Count items by category and success rate
    this.queue.forEach(item => {
      // Category stats
      if (!stats.categories[item.category]) {
        stats.categories[item.category] = 0;
      }
      stats.categories[item.category]++;
      
      // Success rate distribution (using recentResults for binary algorithm)
      const successCount = item.recentResults ? item.recentResults.reduce((sum, result) => sum + result, 0) : 0;
      const successRate = item.recentResults && item.recentResults.length > 0 ? successCount / item.recentResults.length : 0;
      
      if (successRate < 0.3) {
        stats.inertiaDistribution.negative++;
      } else if (successRate > 0.7) {
        stats.inertiaDistribution.positive++;
      } else {
        stats.inertiaDistribution.neutral++;
      }
    });
    
    return stats;
  }
}
