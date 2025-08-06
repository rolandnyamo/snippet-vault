// Test Universal Sentence Encoder - a true TensorFlow.js model
import * as tf from '@tensorflow/tfjs-node';
import * as use from '@tensorflow-models/universal-sentence-encoder';

console.log('Testing Universal Sentence Encoder (native TensorFlow.js)...');

async function testUSE() {
  try {
    // Load the model
    console.log('Loading Universal Sentence Encoder...');
    const model = await use.load();
    
    // Test embedding
    const sentences = ['This is a test sentence'];
    const embeddings = await model.embed(sentences);
    
    console.log('✅ Universal Sentence Encoder works!');
    console.log('Embedding shape:', embeddings.shape);
    console.log('Embedding size:', embeddings.shape[1]);
    
    // Clean up
    embeddings.dispose();
    
    return true;
  } catch (error) {
    console.log('❌ Universal Sentence Encoder failed:', error.message);
    return false;
  }
}

testUSE();
