import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [dataPath, setDataPath] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Get data path when modal opens
    ipcRenderer.send('get-data-path');

    const handleDataPath = (event: any, path: string) => {
      setDataPath(path || 'Not found');
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

    ipcRenderer.on('data-path', handleDataPath);
    ipcRenderer.on('export-data-result', handleExportResult);
    ipcRenderer.on('export-data-error', handleExportError);

    return () => {
      ipcRenderer.removeListener('data-path', handleDataPath);
      ipcRenderer.removeListener('export-data-result', handleExportResult);
      ipcRenderer.removeListener('export-data-error', handleExportError);
    };
  }, []);

  const handleExport = (format: 'json' | 'csv') => {
    setIsExporting(true);
    ipcRenderer.send('export-data', format);
  };

  const handleShowInFolder = () => {
    if (dataPath && dataPath !== 'Not found') {
      ipcRenderer.send('show-item-in-folder', dataPath);
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
            <h3>About</h3>
            <p className="settings-description">
              Snippet Vault - Your offline code and text snippet manager with semantic search.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
