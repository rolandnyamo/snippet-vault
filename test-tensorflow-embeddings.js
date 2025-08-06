// Test the new TensorFlow.js embedding implementation
import { getEmbeddingPipeline } from './src/tensorflow-embeddings.js';

async function testTensorFlowEmbeddings() {
  try {
    console.log('Testing TensorFlow.js embeddings...');
    
    const pipeline = await getEmbeddingPipeline();
    
    // Test embedding generation
    const text1 = "This is a test sentence about programming";
    const text2 = "This is a test sentence about cooking";
    const text3 = "This is a test sentence about programming";
    
    console.log('\nGenerating embeddings...');
    const embedding1 = await pipeline.generateEmbedding(text1);
    const embedding2 = await pipeline.generateEmbedding(text2);
    const embedding3 = await pipeline.generateEmbedding(text3);
    
    console.log('✅ Embeddings generated successfully!');
    console.log('Embedding dimensions:', embedding1.length);
    console.log('Embedding type:', embedding1.constructor.name);
    
    // Test similarity (cosine similarity)
    function cosineSimilarity(a, b) {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    
    const sim1_2 = cosineSimilarity(embedding1, embedding2);
    const sim1_3 = cosineSimilarity(embedding1, embedding3);
    
    console.log('\nSimilarity Test:');
    console.log(`Programming vs Cooking: ${sim1_2.toFixed(4)}`);
    console.log(`Programming vs Programming: ${sim1_3.toFixed(4)}`);
    console.log(sim1_3 > sim1_2 ? '✅ Same topic more similar!' : '❌ Similarity not working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTensorFlowEmbeddings();
