# Language Tutor

An AI-powered language learning application built with Svelte that combines real-time speech recognition, pronunciation scoring, and adaptive spaced repetition for optimal vocabulary retention.

## 🚀 Features

- **AI-Powered Pronunciation Scoring** - Uses OpenAI's Realtime API for accurate speech assessment
- **Adaptive Spaced Repetition** - Binary learning algorithm with 20-item memory for optimal retention
- **Intelligent Pre-pronunciation** - Smart audio playback based on learning history
- **Speed-Adaptive Audio** - Pre-generated TTS with native and learning speeds
- **Multi-Category Learning** - Organize vocabulary by topics (travel, food, health, etc.)
- **Progress Analytics** - Detailed statistics and learning insights
- **Multi-Level Support** - Basic, intermediate, and advanced difficulty levels
- **Real-time Feedback** - Instant pronunciation scoring with detailed commentary

## 📋 Quick Start

### Prerequisites

- Node.js 14+ and npm
- Modern web browser with microphone access
- OpenAI API key with Realtime API access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd languageTutor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure OpenAI API**
   ```bash
   # Copy and edit the config file
   cp config/config.php.example config/config.php
   # Add your OpenAI API key to config/config.php
   ```

4. **Generate audio files**
   ```bash
   # Run the TTS generation script for your language pairs
   php scripts/generate_tts_audio.php
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   Navigate to `http://localhost:5000`

## 🏗️ Architecture

### Core Technologies

- **Frontend**: Svelte 3 with component-based architecture
- **Build System**: Rollup with live reload and CSS processing
- **Backend**: PHP scripts for OpenAI API integration and audio generation
- **Audio**: Pre-generated TTS files organized by language and speed
- **State Management**: Reactive Svelte stores with localStorage persistence

### Key Components

```
src/
├── App.svelte                 # Main orchestrator
├── settingsStore.js          # Centralized state management
├── LanguageTutor.js          # AI scoring and audio system
├── LearningQueue.js          # Spaced repetition algorithm
├── LanguageSettings.svelte   # Language pair selection
├── DisplaySettings.svelte    # UI preferences
├── AlgorithmSettings.svelte  # Learning algorithm tuning
├── CategoryManager.svelte    # Learning category selection
├── LearningSession.svelte    # Current phrase display
└── QueueDisplay.svelte       # Learning queue visualization
```

### Audio System

```
public/audio/
├── English/
│   ├── native/               # Normal speed for native speakers
│   └── learning/             # Slow/clear speed for learners
├── Italian/
│   ├── native/
│   └── learning/
└── Spanish/
    ├── native/
    └── learning/
```

## 🎓 Learning Algorithm

### Binary Spaced Repetition

The app uses a sophisticated binary pass/fail algorithm:

- **Pass Threshold**: Configurable score threshold (default: 7/10)
- **Memory System**: Tracks last 20 attempts per phrase
- **Success Rate**: Movement based on mathematical curves
- **Dynamic Positioning**: Phrases move through queue based on performance

### Learning Flow

1. **New Phrases**: Start with full audio introduction
2. **Practice Mode**: Standard testing with pronunciation feedback
3. **Struggling**: Extra repetition and slower audio
4. **Mastered**: Infrequent review to maintain retention

## 📊 Usage

### Basic Learning Session

1. **Select Languages**: Choose your native and target languages
2. **Configure Categories**: Enable learning topics of interest
3. **Start Session**: Begin with adaptive pronunciation practice
4. **Track Progress**: Monitor success rates and queue statistics

### Advanced Features

- **Developer Mode**: Long-press settings cog for advanced controls
- **Algorithm Tuning**: Adjust pass threshold and repetitiveness
- **Progress Analytics**: View detailed learning statistics
- **Queue Inspection**: See complete learning queue state

## 🔧 Configuration

### Settings Store

All user preferences are managed through a centralized reactive store:

```javascript
// Default settings
{
  nativeLanguage: 'English',
  learningLanguage: 'Italian',
  showExpectedOutput: 'always',
  passThreshold: 7,
  repetitivenessFactor: 5,
  loggingVerbosity: 5,
  enabledCategories: {}
}
```

### OpenAI Integration

```php
// config/config.php
<?php
$openai_api_key = "your-openai-api-key-here";
?>
```

### Learning Data Format

```json
// public/learning/English-Italian-basic.json
{
  "travel": [
    { "source": "Good morning", "target": "Buongiorno" },
    { "source": "Where is the station?", "target": "Dove è la stazione?" }
  ],
  "food": [
    { "source": "I would like a coffee", "target": "Vorrei un caffè" }
  ]
}
```

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server with live reload
npm run build        # Build for production
npm start            # Serve production build
```

### Adding New Languages

1. Create language data file: `public/learning/Source-Target-level.json`
2. Generate audio files: `php scripts/generate_tts_audio.php`
3. Test language pair in the application

### Component Development

Follow established patterns:
- Props down, events up
- Use shared CSS classes from `global.css`
- Implement logging with verbosity levels
- Handle edge cases gracefully

## 📈 Performance

- **Pre-generated Audio**: Zero TTS latency during learning
- **Efficient Algorithm**: O(1) queue operations
- **Minimal Storage**: Binary history arrays with 20-item limit
- **Component Isolation**: Focused, reusable components

## 🔒 Security

- **Ephemeral Tokens**: OpenAI session keys refresh every 60 seconds
- **Server-side API Keys**: No sensitive data in client code
- **Local Storage**: Only user preferences stored locally
- **CORS Headers**: Configured for secure local development

## 🐛 Troubleshooting

### Common Issues

**Audio not playing**
- Check that audio files exist in expected directory structure
- Verify MIME types for MP3 files
- Ensure proper permissions for audio files

**OpenAI connection issues**
- Verify API key is valid and has Realtime API access
- Check session token generation in browser network tab
- Monitor WebSocket connection status in console

**Learning algorithm not working**
- Adjust pass threshold if progression is too slow/fast
- Check that categories are enabled
- Use developer mode for verbose logging

### Debug Mode

Access developer mode by long-pressing (2 seconds) the settings cog:
- Advanced logging controls
- Algorithm parameter tuning
- System diagnostics
- Queue state inspection

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- OpenAI for the Realtime API
- Svelte team for the excellent framework
- Contributors and language learning enthusiasts

## 📞 Support

For support, issues, or feature requests, please open an issue on GitHub.

---

*Built with ❤️ for effective language learning through AI and spaced repetition*