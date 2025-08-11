import { embeddingManager } from '../../embeddings/index.js';
import { ensureEmbeddingInitialized } from './model.js';

/**
 * Generate embeddings for text using the current model (lightweight or TensorFlow)
 * @param {string} text - Text to embed
 * @param {object} db - LanceDB connection (optional)
 * @param {string} configPath - Path to config file (required if db provided)
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text, db = null, configPath = null) {
  await ensureEmbeddingInitialized();

  // Only check compatibility if not already rebuilding (avoid infinite loops)
  if (db && configPath && !globalThis.isRebuilding) {
    const { ensureEmbeddingTableCompatible } = await import('./maintenance.js');
    await ensureEmbeddingTableCompatible(db, configPath);
  }

  return await embeddingManager.generateEmbedding(text);
}
