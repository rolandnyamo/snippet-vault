// TensorFlow.js model download script
// Universal Sentence Encoder downloads automatically, so this just validates the setup

import { getEmbeddingPipeline } from '../src/tensorflow-embeddings.js';

async function downloadModel() {
  console.log('Initializing Universal Sentence Encoder...');
  
  try {
    // This will download and cache the Universal Sentence Encoder model automatically
    const pipeline = await getEmbeddingPipeline();
    
    // Test with a simple embedding
    const testEmbedding = await pipeline.generateEmbedding('test text for validation');
    
    console.log('✅ Universal Sentence Encoder initialized successfully!');
    console.log(`✅ Model produces ${testEmbedding.length}-dimensional embeddings`);
    console.log('✅ No manual model download required - TensorFlow.js handles this automatically');
    
  } catch (error) {
    console.error('❌ Error initializing Universal Sentence Encoder:', error);
    process.exit(1);
  }
}

downloadModel();
