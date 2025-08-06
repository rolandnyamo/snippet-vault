import { pipeline } from '@xenova/transformers';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadModel() {
  console.log('Downloading Xenova/all-MiniLM-L6-v2 model...');
  
  // Set the cache directory to a local folder
  process.env.TRANSFORMERS_CACHE = path.join(__dirname, '../models');
  
  try {
    // This will download and cache the model locally
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      cache_dir: path.join(__dirname, '../models'),
      local_files_only: false // Allow download
    });
    
    console.log('Model downloaded successfully!');
    console.log('Cache directory:', path.join(__dirname, '../models'));
    
    // Test the model
    const test = await embedder('test text', { pooling: 'mean', normalize: true });
    console.log('Model test successful, embedding size:', test.data.length);
    
  } catch (error) {
    console.error('Error downloading model:', error);
    process.exit(1);
  }
}

downloadModel();
