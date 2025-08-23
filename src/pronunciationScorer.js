/**
 * PronunciationScorer - A class for scoring pronunciation accuracy
 * 
 * This class compares a reference pronunciation with user input and provides
 * scores for syllable accuracy and emphasis accuracy.
 * 
 * Usage:
 *   import { PronunciationScorer } from './pronunciationScorer.js';
 *   const scorer = new PronunciationScorer();
 *   const result = scorer.score(reference, userInput);
 *   console.log(`Score: ${result.finalScore}/10`);
 * 
 * Dependencies:
 *   - Requires either fast-levenshtein library (preferred) or uses built-in fallback
 *   - If using fast-levenshtein, ensure it's loaded before this class
 */
export class PronunciationScorer {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {number} options.syllableWeight - Weight for syllable accuracy (0-1, default: 0.7)
     * @param {number} options.emphasisWeight - Weight for emphasis accuracy (0-1, default: 0.3)
     * @param {boolean} options.autoNormalizeWeights - Auto-normalize weights to sum to 1 (default: true)
     */
    constructor(options = {}) {
        this.syllableWeight = options.syllableWeight || 0.8;
        this.emphasisWeight = options.emphasisWeight || 0.2;
        this.autoNormalizeWeights = options.autoNormalizeWeights !== false;
        
        // Normalize weights if requested
        if (this.autoNormalizeWeights) {
            this._normalizeWeights();
        }
        
        // Initialize Levenshtein function
        this._initializeLevenshtein();
    }
    
    /**
     * Set scoring weights
     * @param {number} syllableWeight - Weight for syllable accuracy (0-1)
     * @param {number} emphasisWeight - Weight for emphasis accuracy (0-1)
     */
    setWeights(syllableWeight, emphasisWeight) {
        this.syllableWeight = syllableWeight;
        this.emphasisWeight = emphasisWeight;
        
        if (this.autoNormalizeWeights) {
            this._normalizeWeights();
        }
    }
    
    /**
     * Score pronunciation accuracy
     * @param {string} reference - Reference pronunciation with emphasis (case-sensitive)
     * @param {string} userInput - User's pronunciation attempt
     * @returns {Object} Scoring results
     */
    score(reference, userInput) {
        // Validate inputs
        if (typeof reference !== 'string' || typeof userInput !== 'string') {
            throw new Error('Both reference and userInput must be strings');
        }
        
        // Normalize both strings: replace non-alpha with spaces, collapse multiple spaces
        const normalizedReference = this._normalizeString(reference);
        const normalizedUserInput = this._normalizeString(userInput);
        
        if (normalizedReference.length === 0 || normalizedUserInput.length === 0) {
            return this._createResult(0, {
                syllableDistance: Math.max(normalizedReference.length, normalizedUserInput.length),
                emphasisDistance: Math.max(normalizedReference.length, normalizedUserInput.length),
                emphasisDifference: 0,
                syllableScore: 1,
                emphasisScore: 0
            }, reference, userInput);
        }
        
        // Calculate both distances using normalized strings
        const syllableDistance = this._levenshtein(normalizedReference.toLowerCase(), normalizedUserInput.toLowerCase());
        const emphasisDistance = this._levenshtein(normalizedReference, normalizedUserInput);
        
        // Calculate maximum possible distances for normalization
        const totalLength = normalizedReference.length + normalizedUserInput.length;
        const maxSyllableDistance = totalLength;
        const maxEmphasisDifference = Math.min(normalizedReference.length, normalizedUserInput.length);
        
        // Calculate normalized scores (0 = perfect, 1 = worst possible)
        const syllableScore = maxSyllableDistance > 0 ? syllableDistance / maxSyllableDistance : 0;
        
        // Emphasis score is based on the difference between the two distances
        const emphasisDifference = Math.abs(emphasisDistance - syllableDistance);
        const emphasisScore = maxEmphasisDifference > 0 ? emphasisDifference / maxEmphasisDifference : 0;
        
        // Combine scores with weighting
        const combinedScore = (syllableScore * this.syllableWeight) + (emphasisScore * this.emphasisWeight);
        
        // Convert to 0-10 scale (10 = perfect, 0 = terrible)
        // Square the distance because the scores felt a bit top-heavy (it was giving heigh scores too often)
        let finalScore = Math.max(0, 10 * ( (1 - combinedScore) ** 2));
        
        // Length-based leniency: shorter phrases get a score boost
        const referenceLength = normalizedReference.length;
        if (referenceLength <= 8) {
            // Apply progressively more generous scoring for very short phrases
            const lengthBonus = Math.max(0, (8 - referenceLength) * 0.5); // Up to 4 point bonus for very short phrases
            finalScore = Math.min(10, finalScore + lengthBonus);
        }
        
        return this._createResult(finalScore, {
            syllableDistance,
            emphasisDistance,
            emphasisDifference,
            syllableScore,
            emphasisScore
        }, reference, userInput);
    }
    
    /**
     * Batch score multiple pronunciation attempts
     * @param {string} reference - Reference pronunciation
     * @param {string[]} userInputs - Array of user pronunciation attempts
     * @returns {Object[]} Array of scoring results
     */
    batchScore(reference, userInputs) {
        if (!Array.isArray(userInputs)) {
            throw new Error('userInputs must be an array');
        }
        
        return userInputs.map(input => this.score(reference, input));
    }
    
    /**
     * Get the current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return {
            syllableWeight: this.syllableWeight,
            emphasisWeight: this.emphasisWeight,
            autoNormalizeWeights: this.autoNormalizeWeights,
            levenshteinSource: this._levenshteinSource
        };
    }
    
    /**
     * Create a detailed result object
     * @private
     */
    _createResult(finalScore, details, originalReference = '', originalUserInput = '') {
        return {
            finalScore: Math.round(finalScore * 10) / 10,
            grade: this._getGrade(finalScore),
            originalReference: originalReference,
            originalUserInput: originalUserInput,
            details: {
                syllableDistance: details.syllableDistance,
                emphasisDistance: details.emphasisDistance,
                emphasisDifference: details.emphasisDifference,
                syllableScore: Math.round(details.syllableScore * 1000) / 1000,
                emphasisScore: Math.round(details.emphasisScore * 1000) / 1000,
                syllableScoreOut10: Math.round(10 * (1 - details.syllableScore) * 10) / 10,
                emphasisScoreOut10: Math.round(10 * (1 - details.emphasisScore) * 10) / 10
            },
            weights: {
                syllable: this.syllableWeight,
                emphasis: this.emphasisWeight
            }
        };
    }
    
    /**
     * Get letter grade based on score
     * @private
     */
    _getGrade(score) {
        if (score >= 9) return 'A+';
        if (score >= 8) return 'A';
        if (score >= 7) return 'B';
        if (score >= 6) return 'C';
        if (score >= 5) return 'D';
        return 'F';
    }
    
    /**
     * Normalize weights to sum to 1
     * @private
     */
    _normalizeWeights() {
        const total = this.syllableWeight + this.emphasisWeight;
        if (total > 0) {
            this.syllableWeight = this.syllableWeight / total;
            this.emphasisWeight = this.emphasisWeight / total;
        }
    }
    
    /**
     * Normalize input string by replacing non-alpha characters with spaces
     * and collapsing multiple spaces into single spaces
     * @private
     */
    _normalizeString(text) {
        return text
            .replace(/[^a-zA-Z]/g, ' ')  // Replace non-alphabetic characters with spaces
            .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
            .trim();                     // Remove leading/trailing whitespace
    }
    
    /**
     * Initialize Levenshtein distance function
     * @private
     */
    _initializeLevenshtein() {
        // Try to use fast-levenshtein if available
        if (typeof levenshtein !== 'undefined' && levenshtein.get) {
            this._levenshtein = levenshtein.get;
            this._levenshteinSource = 'fast-levenshtein';
        }
        // Try alternative global names
        else if (typeof fastLevenshtein !== 'undefined' && fastLevenshtein.get) {
            this._levenshtein = fastLevenshtein.get;
            this._levenshteinSource = 'fast-levenshtein (fastLevenshtein)';
        }
        // Try window.Levenshtein (from levenshtein.min.js)
        else if (typeof window !== 'undefined' && typeof window.Levenshtein !== 'undefined' && window.Levenshtein.get) {
            this._levenshtein = window.Levenshtein.get;
            this._levenshteinSource = 'fast-levenshtein (window.Levenshtein)';
        }
        // Try global Levenshtein
        else if (typeof Levenshtein !== 'undefined' && Levenshtein.get) {
            this._levenshtein = Levenshtein.get;
            this._levenshteinSource = 'fast-levenshtein (Levenshtein)';
        }
        // Fallback to built-in implementation
        else {
            this._levenshtein = this._builtinLevenshtein;
            this._levenshteinSource = 'built-in';
        }
    }
    
    /**
     * Built-in Levenshtein distance implementation
     * @private
     */
    _builtinLevenshtein(a, b) {
        const matrix = [];
        
        // Initialize first row and column
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        // Fill the matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[b.length][a.length];
    }
    
    /**
     * Static helper method to create a scorer with common presets
     */
    static createPreset(preset = 'balanced') {
        const presets = {
            'syllable-focused': { syllableWeight: 0.8, emphasisWeight: 0.2 },
            'balanced': { syllableWeight: 0.7, emphasisWeight: 0.3 },
            'emphasis-focused': { syllableWeight: 0.5, emphasisWeight: 0.5 },
            'equal': { syllableWeight: 0.5, emphasisWeight: 0.5 }
        };
        
        if (!presets[preset]) {
            throw new Error(`Unknown preset: ${preset}. Available: ${Object.keys(presets).join(', ')}`);
        }
        
        return new PronunciationScorer(presets[preset]);
    }
}

// Example usage and tests (can be removed in production)
// Now using ES6 exports - import with: import { PronunciationScorer } from './pronunciationScorer.js';

// Example usage:
/*
// Basic usage
const scorer = new PronunciationScorer();
const result = scorer.score("DOH-veh POS-soh", "DOH-veh pos-soh");
console.log(`Score: ${result.finalScore}/10 (${result.grade})`);

// Custom weights
const customScorer = new PronunciationScorer({
    syllableWeight: 0.8,
    emphasisWeight: 0.2
});

// Using presets
const balancedScorer = PronunciationScorer.createPreset('balanced');
const emphasisScorer = PronunciationScorer.createPreset('emphasis-focused');

// Batch scoring
const attempts = ["DOH-veh pos-soh", "doh-VEH pos-SOH", "DOH-veh POS-soh"];
const results = scorer.batchScore("DOH-veh POS-soh", attempts);
*/
