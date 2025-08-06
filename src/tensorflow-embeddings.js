// Real TensorFlow.js-based embedding implementation (browser-compatible for Electron)
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

class TensorFlowEmbeddingPipeline {
  constructor() {
    this.model = null;
    this.isLoading = false;
    this.loadPromise = null;
  }

  async initialize() {
    if (this.model) {
      return this.model;
    }

    if (this.isLoading) {
      return this.loadPromise;
    }

    this.isLoading = true;
    console.log('Loading Universal Sentence Encoder...');
    
    this.loadPromise = use.load().then(model => {
      this.model = model;
      this.isLoading = false;
      console.log('✅ Universal Sentence Encoder loaded successfully');
      return model;
    }).catch(error => {
      this.isLoading = false;
      console.error('❌ Failed to load Universal Sentence Encoder:', error);
      throw error;
    });

    return this.loadPromise;
  }

  async generateEmbedding(text) {
    await this.initialize();
    
    try {
      // Generate embedding
      const embeddings = await this.model.embed([text]);
      
      // Convert to regular array
      const embeddingArray = await embeddings.data();
      
      // Clean up tensor
      embeddings.dispose();
      
      // Convert to regular array for LanceDB compatibility
      return Array.from(embeddingArray);
      
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  // Compatibility method to match transformers.js interface
  async __call__(text, options = {}) {
    const embedding = await this.generateEmbedding(text);
    return embedding;
  }
}

// Create singleton instance
let embeddingPipeline = null;

export async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = new TensorFlowEmbeddingPipeline();
  }
  return embeddingPipeline;
}

export { TensorFlowEmbeddingPipeline };
