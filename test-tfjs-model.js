// Test if we can find a TensorFlow.js compatible embedding model
import { pipeline, env } from '@xenova/transformers';

// Force TensorFlow.js backend
env.backends.onnx = false;
env.backends.tfjs = true;

console.log('Testing TensorFlow.js models...');

// Try some known TensorFlow.js compatible models
const models = [
  'Xenova/all-distilroberta-v1',
  'Xenova/all-MiniLM-L12-v2',
  'sentence-transformers/all-MiniLM-L6-v2',
];

async function testModel(modelName) {
  try {
    console.log(`\nTesting ${modelName}...`);
    const embedder = await pipeline('feature-extraction', modelName, {
      device: 'cpu',
      dtype: 'fp32'
    });
    
    const test = await embedder('test', { pooling: 'mean', normalize: true });
    console.log(`✅ ${modelName} works! Embedding size:`, test.data.length);
    return true;
  } catch (error) {
    console.log(`❌ ${modelName} failed:`, error.message);
    return false;
  }
}

// Test models sequentially
for (const model of models) {
  await testModel(model);
}
