import { embeddingManager, EMBEDDING_MODELS } from '../../embeddings/index.js';

// Initialize embedding system
let isEmbeddingInitialized = false;

export function getCurrentEmbeddingModel() {
  const modelType = embeddingManager.getCurrentModelType();
  return modelType === EMBEDDING_MODELS.TENSORFLOW ?
    'tensorflow/universal-sentence-encoder@3.3.0' :
    'lightweight-embeddings@1.0.0';
}

export function getCurrentDimensions() {
  return embeddingManager.getCurrentDimensions();
}

export function createZeroVector() {
  return new Array(getCurrentDimensions()).fill(0.0);
}

export async function ensureEmbeddingInitialized() {
  if (!isEmbeddingInitialized) {
    await embeddingManager.initialize();
    isEmbeddingInitialized = true;
  }
}

export function getAvailableModels() {
  return {
    [EMBEDDING_MODELS.LIGHTWEIGHT]: {
      id: EMBEDDING_MODELS.LIGHTWEIGHT,
      name: 'Fast (Built-in)',
      description: 'Instant startup, basic semantic matching',
      features: [
        'Instant startup',
        'No downloads',
        'Basic semantic matching',
        'Keyword-based search',
        'Good for simple queries'
      ]
    },
    [EMBEDDING_MODELS.TENSORFLOW]: {
      id: EMBEDDING_MODELS.TENSORFLOW,
      name: 'Smart (AI Download)',
      description: 'Advanced semantic understanding (~20MB download)',
      features: [
        'Advanced semantic understanding',
        'Context-aware search',
        'Handles complex queries',
        'Multi-language support',
        'State-of-the-art accuracy'
      ]
    }
  };
}

export async function setEmbeddingModelType(modelType) {
  await embeddingManager.setModelType(modelType);
  return {
    success: true,
    currentModel: getCurrentEmbeddingModel(),
    modelType
  };
}

export function getCurrentModelType() {
  return embeddingManager.getCurrentModelType();
}

export async function canLoadTensorFlow() {
  return await embeddingManager.canLoadTensorFlow();
}
