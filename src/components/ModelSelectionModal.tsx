import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

// Define embedding models here since we can't import from main process
const EMBEDDING_MODELS = {
  LIGHTWEIGHT: 'lightweight',
  TENSORFLOW: 'tensorflow'
};

interface ModelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelSelected: (model: string) => void;
  currentModel?: string;
}

const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({ isOpen, onClose, onModelSelected, currentModel }) => {
  const [selectedModel, setSelectedModel] = useState(currentModel || EMBEDDING_MODELS.LIGHTWEIGHT);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [canUseTensorFlow, setCanUseTensorFlow] = useState(true);
  const [availableModels, setAvailableModels] = useState<any>({});

  useEffect(() => {
    if (isOpen) {
      // Get available models from main process
      ipcRenderer.send('get-available-models');
      ipcRenderer.send('can-load-tensorflow');

      const handleAvailableModels = (event: any, models: any) => {
        setAvailableModels(models);
      };

      const handleCanLoadTensorFlow = (event: any, canLoad: boolean) => {
        setCanUseTensorFlow(canLoad);
      };

      ipcRenderer.on('available-models-result', handleAvailableModels);
      ipcRenderer.on('can-load-tensorflow-result', handleCanLoadTensorFlow);

      return () => {
        ipcRenderer.removeListener('available-models-result', handleAvailableModels);
        ipcRenderer.removeListener('can-load-tensorflow-result', handleCanLoadTensorFlow);
      };
    }
  }, [isOpen]);

  // Update selectedModel when currentModel prop changes
  useEffect(() => {
    if (currentModel) {
      setSelectedModel(currentModel);
    }
  }, [currentModel]);

  const handleModelChange = (modelType: string) => {
    setSelectedModel(modelType);
  };

  const handleApply = async () => {
    setIsLoading(true);
    setLoadingProgress('Initializing model...');

    try {
      // Use IPC to set model type
      ipcRenderer.send('set-model-type', selectedModel);
      
      // Listen for the response
      const handleModelTypeSet = (event: any, result: any) => {
        console.log('Model type set successfully:', result);
        onModelSelected(selectedModel);
        onClose();
        setIsLoading(false);
        setLoadingProgress('');
        ipcRenderer.removeListener('model-type-set', handleModelTypeSet);
        ipcRenderer.removeListener('model-type-error', handleModelTypeError);
      };

      const handleModelTypeError = (event: any, error: string) => {
        console.error('Failed to set model:', error);
        setLoadingProgress(`Error: ${error}`);
        setTimeout(() => {
          setIsLoading(false);
          setLoadingProgress('');
        }, 3000);
        ipcRenderer.removeListener('model-type-set', handleModelTypeSet);
        ipcRenderer.removeListener('model-type-error', handleModelTypeError);
      };

      ipcRenderer.once('model-type-set', handleModelTypeSet);
      ipcRenderer.once('model-type-error', handleModelTypeError);

    } catch (error) {
      console.error('Failed to load model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLoadingProgress(`Error: ${errorMessage}`);
      setTimeout(() => {
        setIsLoading(false);
        setLoadingProgress('');
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content model-selection-modal">
        <div className="modal-header">
          <h2>Choose Search Engine</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <p className="model-selection-description">
            Choose how you want Snippet Vault to understand and search your content:
          </p>

          <div className="model-options">
            {/* Lightweight Model Option */}
            <div className={`model-option ${selectedModel === EMBEDDING_MODELS.LIGHTWEIGHT ? 'selected' : ''}`}>
              <label>
                <input
                  type="radio"
                  name="model"
                  value={EMBEDDING_MODELS.LIGHTWEIGHT}
                  checked={selectedModel === EMBEDDING_MODELS.LIGHTWEIGHT}
                  onChange={(e) => handleModelChange(e.target.value)}
                />
                <div className="model-info">
                  <div className="model-title">
                    <span className="model-name">⚡ Fast Model</span>
                    <span className="model-size">Built-in</span>
                  </div>
                  <div className="model-description">
                    Perfect for quick searches and basic semantic matching. Works instantly with no downloads.
                  </div>
                  <div className="model-features">
                    <span className="feature">✓ Instant startup</span>
                    <span className="feature">✓ No downloads</span>
                    <span className="feature">✓ Good for simple queries</span>
                  </div>
                </div>
              </label>
            </div>

            {/* TensorFlow Model Option */}
            <div className={`model-option ${selectedModel === EMBEDDING_MODELS.TENSORFLOW ? 'selected' : ''} ${!canUseTensorFlow ? 'disabled' : ''}`}>
              <label>
                <input
                  type="radio"
                  name="model"
                  value={EMBEDDING_MODELS.TENSORFLOW}
                  checked={selectedModel === EMBEDDING_MODELS.TENSORFLOW}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={!canUseTensorFlow}
                />
                <div className="model-info">
                  <div className="model-title">
                    <span className="model-name">🧠 Smart Model</span>
                    <span className="model-size">~20MB download</span>
                  </div>
                  <div className="model-description">
                    Advanced AI from Google that understands context and meaning. Best search quality.
                  </div>
                  <div className="model-features">
                    <span className="feature">✓ Advanced semantic search</span>
                    <span className="feature">✓ Context understanding</span>
                    <span className="feature">✓ Handles complex queries</span>
                  </div>
                  {!canUseTensorFlow && (
                    <div className="model-warning">
                      ⚠️ Advanced model not available in this build
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {selectedModel === EMBEDDING_MODELS.TENSORFLOW && canUseTensorFlow && (
            <div className="download-notice">
              <p><strong>First-time setup:</strong> The Smart Model will download automatically (~20MB). This happens once and enables the best search experience.</p>
            </div>
          )}

          {isLoading && (
            <div className="loading-status">
              <div className="loading-spinner"></div>
              <p>{loadingProgress}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleApply}
            disabled={isLoading || (!canUseTensorFlow && selectedModel === EMBEDDING_MODELS.TENSORFLOW)}
          >
            {isLoading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
        }

        .model-selection-modal {
          width: 600px;
          max-width: 90vw;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #666;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: #f0f0f0;
          color: #333;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }

        .btn {
          padding: 10px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          min-width: 80px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
          border: 1px solid #ddd;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e0e0e0;
        }

        .btn-primary {
          background: #007AFF;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .model-selection-description {
          margin-bottom: 20px;
          color: #666;
        }

        .model-options {
          display: flex;
          flex-direction: column;
          gap: 15px;
          margin-bottom: 20px;
        }

        .model-option {
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          padding: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .model-option:hover {
          border-color: #007AFF;
        }

        .model-option.selected {
          border-color: #007AFF;
          background: #f8fbff;
        }

        .model-option.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .model-option label {
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .model-option input[type="radio"] {
          margin-top: 2px;
        }

        .model-info {
          flex: 1;
        }

        .model-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .model-name {
          font-weight: 600;
          font-size: 16px;
        }

        .model-size {
          font-size: 12px;
          background: #e0e0e0;
          padding: 2px 8px;
          border-radius: 12px;
          color: #666;
        }

        .model-description {
          color: #666;
          margin-bottom: 10px;
          line-height: 1.4;
        }

        .model-features {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .feature {
          font-size: 12px;
          color: #007AFF;
          background: #e8f4ff;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .model-warning {
          color: #e67e22;
          font-size: 12px;
          margin-top: 8px;
          font-style: italic;
        }

        .download-notice {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          padding: 12px;
          color: #856404;
          font-size: 14px;
        }

        .loading-status {
          text-align: center;
          padding: 20px;
        }

        .loading-spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #007AFF;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin: 0 auto 10px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ModelSelectionModal;
