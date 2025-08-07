import React, { useState, useEffect } from 'react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const { ipcRenderer } = window.require('electron');

interface SettingsModalProps {
  onClose: () => void;
  onImportSuccess?: () => void;
  onDeleteAllSuccess?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onImportSuccess, onDeleteAllSuccess }) => {
  const [dataPath, setDataPath] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; success: number; errors: number }>({ current: 0, total: 0, success: 0, errors: 0 });
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [embeddingModel, setEmbeddingModel] = useState<string>('');
  const [currentModelType, setCurrentModelType] = useState<string>('');
  const [isRegeneratingEmbeddings, setIsRegeneratingEmbeddings] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  useEffect(() => {
    // Get data path and embedding model when modal opens
    ipcRenderer.send('get-data-path');
    ipcRenderer.send('get-embedding-model');
    ipcRenderer.send('get-current-model-type');

    const handleDataPath = (event: any, path: string) => {
      setDataPath(path || 'Not found');
    };

    const handleEmbeddingModel = (event: any, model: string) => {
      setEmbeddingModel(model);
    };

    const handleCurrentModelType = (event: any, modelType: string) => {
      setCurrentModelType(modelType);
    };

    const handleExportResult = (event: any, data: string, format: string) => {
      setIsExporting(false);
      // Create and download file
      const blob = new Blob([data], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snippet-vault-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const handleExportError = (event: any, error: string) => {
      setIsExporting(false);
      alert(`Export failed: ${error}`);
    };

    const handleImportResult = (event: any, result: any) => {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0, success: 0, errors: 0 });
      alert(result.message);
      if (result.errors && result.errors.length > 0) {
        console.log('Import errors:', result.errors);
      }
      // Notify parent component to refresh items
      if (onImportSuccess) {
        onImportSuccess();
      }
    };

    const handleImportError = (event: any, error: string) => {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0, success: 0, errors: 0 });
      alert(`Import failed: ${error}`);
    };

    const handleImportProgress = (event: any, progress: any) => {
      setImportProgress(progress);
    };

    const handleDeleteAllResult = (event: any, result: any) => {
      setIsDeletingAll(false);
      alert(result.message);
      // Notify parent component to refresh items
      if (onDeleteAllSuccess) {
        onDeleteAllSuccess();
      }
    };

    const handleDeleteAllError = (event: any, error: string) => {
      setIsDeletingAll(false);
      alert(`Delete all failed: ${error}`);
    };

    const handleRegenerateEmbeddingsResult = (event: any, result: any) => {
      setIsRegeneratingEmbeddings(false);
      alert(result.message);
    };

    const handleRegenerateEmbeddingsError = (event: any, error: string) => {
      setIsRegeneratingEmbeddings(false);
      alert(`Regenerate embeddings failed: ${error}`);
    };

    ipcRenderer.on('data-path', handleDataPath);
    ipcRenderer.on('embedding-model', handleEmbeddingModel);
    ipcRenderer.on('current-model-type-result', handleCurrentModelType);
    ipcRenderer.on('export-data-result', handleExportResult);
    ipcRenderer.on('export-data-error', handleExportError);
    ipcRenderer.on('import-data-result', handleImportResult);
    ipcRenderer.on('import-data-error', handleImportError);
    ipcRenderer.on('import-data-progress', handleImportProgress);
    ipcRenderer.on('delete-all-data-result', handleDeleteAllResult);
    ipcRenderer.on('delete-all-data-error', handleDeleteAllError);
    ipcRenderer.on('regenerate-embeddings-result', handleRegenerateEmbeddingsResult);
    ipcRenderer.on('regenerate-embeddings-error', handleRegenerateEmbeddingsError);

    return () => {
      ipcRenderer.removeListener('data-path', handleDataPath);
      ipcRenderer.removeListener('embedding-model', handleEmbeddingModel);
      ipcRenderer.removeListener('current-model-type-result', handleCurrentModelType);
      ipcRenderer.removeListener('export-data-result', handleExportResult);
      ipcRenderer.removeListener('export-data-error', handleExportError);
      ipcRenderer.removeListener('import-data-result', handleImportResult);
      ipcRenderer.removeListener('import-data-error', handleImportError);
      ipcRenderer.removeListener('import-data-progress', handleImportProgress);
      ipcRenderer.removeListener('delete-all-data-result', handleDeleteAllResult);
      ipcRenderer.removeListener('delete-all-data-error', handleDeleteAllError);
      ipcRenderer.removeListener('regenerate-embeddings-result', handleRegenerateEmbeddingsResult);
      ipcRenderer.removeListener('regenerate-embeddings-error', handleRegenerateEmbeddingsError);
    };
  }, []);

  const handleExport = (format: 'json' | 'csv') => {
    setIsExporting(true);
    ipcRenderer.send('export-data', format);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const data = e.target.result;
          const format = file.name.endsWith('.csv') ? 'csv' : 'json';
          setIsImporting(true);
          ipcRenderer.send('import-data', { data, format });
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDeleteAll = () => {
    setShowDeleteConfirmation(true);
  };

  const handleDeleteConfirmed = () => {
    setShowDeleteConfirmation(false);
    setIsDeletingAll(true);
    ipcRenderer.send('delete-all-data');
  };

  const handleDeleteCancelled = () => {
    setShowDeleteConfirmation(false);
  };

  const handleRegenerateEmbeddings = () => {
    const confirmed = confirm(
      'This will regenerate all embeddings with the current model. This may take some time. Continue?'
    );
    
    if (confirmed) {
      setIsRegeneratingEmbeddings(true);
      ipcRenderer.send('regenerate-embeddings');
    }
  };

  const handleShowInFolder = () => {
    if (dataPath && dataPath !== 'Not found') {
      ipcRenderer.send('show-item-in-folder', dataPath);
    }
  };

  const handleCopyPath = async () => {
    if (dataPath && dataPath !== 'Not found') {
      try {
        // Quote the path to handle spaces properly
        const quotedPath = `"${dataPath}"`;
        await navigator.clipboard.writeText(quotedPath);
        // You could add a toast notification here if desired
        console.log('Quoted path copied to clipboard:', quotedPath);
      } catch (error) {
        console.error('Failed to copy path:', error);
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="settings-section">
            <h3>Data Location</h3>
            <p className="settings-description">
              Your snippets are stored in the following location:
            </p>
            <div className="data-path-container">
              <input 
                type="text" 
                value={dataPath} 
                readOnly 
                className="data-path-input"
              />
              <button 
                onClick={handleShowInFolder}
                disabled={!dataPath || dataPath === 'Not found'}
                className="show-folder-button"
              >
                Show in Folder
              </button>
              <button 
                onClick={handleCopyPath}
                disabled={!dataPath || dataPath === 'Not found'}
                className="copy-path-button"
                title="Copy path to clipboard"
              >
                Copy Path
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>Export Data</h3>
            <p className="settings-description">
              Export all your snippets to a file for backup or migration purposes.
            </p>
            <div className="export-buttons">
              <button 
                onClick={() => handleExport('json')}
                disabled={isExporting}
                className="export-button"
              >
                {isExporting ? 'Exporting...' : 'Export as JSON'}
              </button>
              <button 
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="export-button"
              >
                {isExporting ? 'Exporting...' : 'Export as CSV'}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>Import Data</h3>
            <p className="settings-description">
              Import snippets from a JSON or CSV file. Data will be added to your existing snippets.
            </p>
            <div className="import-buttons">
              <button 
                onClick={handleImport}
                disabled={isImporting}
                className="import-button"
              >
                {isImporting ? 'Importing...' : 'Import from File'}
              </button>
            </div>
            
            {/* Import Progress Display */}
            {isImporting && importProgress.total > 0 && (
              <div className="progress-container" style={{ marginTop: '15px' }}>
                <div className="progress-header">
                  <span>Progress: {importProgress.current} / {importProgress.total}</span>
                  <span>✅ Success: {importProgress.success} | ❌ Errors: {importProgress.errors}</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  margin: '8px 0'
                }}>
                  <div style={{
                    width: `${(importProgress.current / importProgress.total) * 100}%`,
                    height: '100%',
                    backgroundColor: '#007AFF',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>Search Engine</h3>
            <p className="settings-description">
              Choose how Snippet Vault understands and searches your content.
            </p>
            <div className="model-info">
              <input 
                type="text" 
                value={embeddingModel} 
                readOnly 
                className="model-input"
                placeholder="Click 'Choose Model' to select search engine"
              />
              <button 
                onClick={() => {
                  // This will be handled by the parent component
                  window.dispatchEvent(new CustomEvent('openModelSelection', { 
                    detail: { currentModel: currentModelType }
                  }));
                }}
                className="choose-model-button"
                title="Choose between Fast (built-in) or Smart (AI download) search"
              >
                Choose Model
              </button>
              <button 
                onClick={handleRegenerateEmbeddings}
                disabled={isRegeneratingEmbeddings}
                className="regenerate-button"
                title="Regenerate all embeddings with current model (for testing)"
              >
                {isRegeneratingEmbeddings ? 'Regenerating...' : 'Force Regenerate All'}
              </button>
            </div>
          </div>

          <div className="settings-section danger-section">
            <h3>Danger Zone</h3>
            <p className="settings-description">
              Permanently delete all your snippets. This action cannot be undone.
            </p>
            <div className="danger-buttons">
              <button 
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="delete-all-button"
              >
                {isDeletingAll ? '🗑️ Deleting All Items...' : 'Delete All Data'}
              </button>
            </div>
            
            {/* Delete All Loading Display */}
            {isDeletingAll && (
              <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                backgroundColor: '#ffebee', 
                border: '1px solid #ffcdd2', 
                borderRadius: '4px',
                textAlign: 'center',
                color: '#c62828'
              }}>
                🗑️ Deleting all items... This may take a moment.
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>About</h3>
            <p className="settings-description">
              Snippet Vault - Your offline code and text snippet manager with semantic search.
            </p>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteConfirmation}
        onConfirm={handleDeleteConfirmed}
        onCancel={handleDeleteCancelled}
      />
    </div>
  );
};

export default SettingsModal;
