// Hybrid embedding system that supports both lightweight and TensorFlow models
import { LightweightEmbeddingPipeline } from './lightweight-embeddings.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for preferences file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple preferences manager (avoiding electron-store for now)
class PreferencesManager {
  constructor() {
    this.prefsPath = path.join(__dirname, '..', 'user-preferences.json');
  }

  loadPreferences() {
    try {
      if (fs.existsSync(this.prefsPath)) {
        const data = fs.readFileSync(this.prefsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error.message);
    }
    return { modelType: 'lightweight' }; // Default
  }

  savePreferences(prefs) {
    try {
      fs.writeFileSync(this.prefsPath, JSON.stringify(prefs, null, 2));
    } catch (error) {
      console.warn('Failed to save preferences:', error.message);
    }
  }
}

// Dynamically import TensorFlow only when needed
let TensorFlowEmbeddingPipeline = null;
const preferencesManager = new PreferencesManager();

const EMBEDDING_MODELS = {
  LIGHTWEIGHT: 'lightweight',
  TENSORFLOW: 'tensorflow'
};

class HybridEmbeddingManager {
  constructor() {
    this.currentModel = null;
    this.modelType = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.preferences = preferencesManager.loadPreferences();
  }

  // Get current model type (with persistence)
  getCurrentModelType() {
    return this.modelType || this.preferences.modelType || EMBEDDING_MODELS.LIGHTWEIGHT;
  }

  // Initialize with saved preference
  async initialize() {
    const savedModelType = this.preferences.modelType || EMBEDDING_MODELS.LIGHTWEIGHT;
    return this.setModelType(savedModelType);
  }

  async setModelType(modelType) {
    if (this.modelType === modelType && this.currentModel) {
      return this.currentModel;
    }

    // Save preference
    this.preferences.modelType = modelType;
    preferencesManager.savePreferences(this.preferences);

    this.modelType = modelType;
    this.currentModel = null;

    if (this.isInitializing) {
      return this.initPromise;
    }

    this.isInitializing = true;

    try {
      this.initPromise = this._initializeModel(modelType);
      await this.initPromise;
    } finally {
      this.isInitializing = false;
    }

    return this.currentModel;
  }

  async _initializeModel(modelType) {
    switch (modelType) {
      case EMBEDDING_MODELS.LIGHTWEIGHT:
        console.log('🚀 Initializing lightweight embedding model...');
        this.currentModel = new LightweightEmbeddingPipeline();
        await this.currentModel.initialize();
        console.log('✅ Lightweight model ready - instant startup, good for basic search');
        break;

      case EMBEDDING_MODELS.TENSORFLOW:
        console.log('📥 Loading TensorFlow Universal Sentence Encoder...');
        console.log('⏳ This may take a moment on first run (downloading ~20MB model)...');
        
        try {
          // Dynamic import to avoid loading TensorFlow unless needed
          if (!TensorFlowEmbeddingPipeline) {
            const { TensorFlowEmbeddingPipeline: TFPipeline } = await import('./tensorflow-embeddings.js');
            TensorFlowEmbeddingPipeline = TFPipeline;
          }
          
          this.currentModel = new TensorFlowEmbeddingPipeline();
          await this.currentModel.initialize();
          console.log('✅ TensorFlow model ready - advanced semantic search enabled');
        } catch (error) {
          console.warn('⚠️  Failed to load TensorFlow model, falling back to lightweight:', error.message);
          // Fallback to lightweight model
          this.currentModel = new LightweightEmbeddingPipeline();
          await this.currentModel.initialize();
          this.modelType = EMBEDDING_MODELS.LIGHTWEIGHT;
        }
        break;

      default:
        throw new Error(`Unknown model type: ${modelType}`);
    }
  }

  async generateEmbedding(text) {
    if (!this.currentModel) {
      throw new Error('No embedding model initialized. Call setModelType() first.');
    }
    
    return await this.currentModel.generateEmbedding(text);
  }

  getModelInfo() {
    return {
      type: this.modelType,
      isReady: !!this.currentModel,
      description: this._getModelDescription(this.modelType),
      estimatedSize: this._getModelSize(this.modelType),
      features: this._getModelFeatures(this.modelType)
    };
  }

  _getModelDescription(modelType) {
    switch (modelType) {
      case EMBEDDING_MODELS.LIGHTWEIGHT:
        return 'Fast, lightweight model built into the app. Good for basic keyword and simple semantic matching.';
      case EMBEDDING_MODELS.TENSORFLOW:
        return 'Advanced Google Universal Sentence Encoder. Best semantic understanding, handles complex queries.';
      default:
        return 'Unknown model';
    }
  }

  // Get vector dimensions for current model
  getCurrentDimensions() {
    switch (this.getCurrentModelType()) {
      case EMBEDDING_MODELS.LIGHTWEIGHT:
        return 256;
      case EMBEDDING_MODELS.TENSORFLOW:
        return 512;
      default:
        return 256; // Default to lightweight
    }
  }

  _getModelSize(modelType) {
    switch (modelType) {
      case EMBEDDING_MODELS.LIGHTWEIGHT:
        return '< 1KB (built-in)';
      case EMBEDDING_MODELS.TENSORFLOW:
        return '~20MB (downloads once)';
      default:
        return 'Unknown';
    }
  }

  _getModelFeatures(modelType) {
    switch (modelType) {
      case EMBEDDING_MODELS.LIGHTWEIGHT:
        return [
          'Instant startup',
          'No downloads',
          'Basic semantic matching',
          'Keyword-based search',
          'Good for simple queries'
        ];
      case EMBEDDING_MODELS.TENSORFLOW:
        return [
          'Advanced semantic understanding',
          'Context-aware search',
          'Handles complex queries',
          'Multi-language support',
          'State-of-the-art accuracy'
        ];
      default:
        return [];
    }
  }

  // Method to check if TensorFlow can be loaded (for UI)
  async canLoadTensorFlow() {
    try {
      // Try to dynamically import without actually loading
      await import('./tensorflow-embeddings.js');
      return true;
    } catch (error) {
      console.warn('TensorFlow not available:', error.message);
      return false;
    }
  }
}

// Export singleton instance
const embeddingManager = new HybridEmbeddingManager();

export { embeddingManager, EMBEDDING_MODELS };
