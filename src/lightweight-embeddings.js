// Lightweight embedding alternative using simpler text processing
// This is significantly smaller than TensorFlow.js but less accurate

class LightweightEmbeddingPipeline {
  constructor() {
    this.model = null;
  }

  async initialize() {
    // No model loading needed for lightweight approach
    this.model = { ready: true };
    return this.model;
  }

  // Simple TF-IDF like approach with word vectors
  async generateEmbedding(text) {
    const words = this.tokenize(text.toLowerCase());
    const embedding = new Array(256).fill(0); // Smaller than 512-dim
    
    // Hash words to embedding dimensions
    for (let word of words) {
      const hash = this.hashString(word) % 256;
      embedding[hash] += 1 / words.length; // Normalized frequency
    }
    
    // Add some semantic features
    this.addSemanticFeatures(text, embedding);
    
    return embedding;
  }

  tokenize(text) {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  addSemanticFeatures(text, embedding) {
    const semanticKeywords = {
      'database': [50, 51, 52],
      'query': [53, 54, 55],
      'connection': [56, 57, 58],
      'server': [59, 60, 61],
      'api': [62, 63, 64],
      'function': [65, 66, 67],
      'method': [68, 69, 70],
      'class': [71, 72, 73],
      'variable': [74, 75, 76],
      'error': [77, 78, 79],
      'fix': [80, 81, 82],
      'debug': [83, 84, 85]
    };

    const lowerText = text.toLowerCase();
    for (let [keyword, indices] of Object.entries(semanticKeywords)) {
      if (lowerText.includes(keyword)) {
        indices.forEach(idx => {
          embedding[idx] += 0.5;
        });
      }
    }
  }

  // Calculate cosine similarity between embeddings
  calculateSimilarity(embedding1, embedding2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

export { LightweightEmbeddingPipeline };
