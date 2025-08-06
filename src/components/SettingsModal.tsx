import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [dataPath, setDataPath] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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

    const handleImportResult = (event: any, result: any) => {
      setIsImporting(false);
      alert(result.message);
      if (result.errors && result.errors.length > 0) {
        console.log('Import errors:', result.errors);
      }
    };

    const handleImportError = (event: any, error: string) => {
      setIsImporting(false);
      alert(`Import failed: ${error}`);
    };

    const handleDeleteAllResult = (event: any, result: any) => {
      setIsDeletingAll(false);
      alert(result.message);
    };

    const handleDeleteAllError = (event: any, error: string) => {
      setIsDeletingAll(false);
      alert(`Delete all failed: ${error}`);
    };

    ipcRenderer.on('data-path', handleDataPath);
    ipcRenderer.on('export-data-result', handleExportResult);
    ipcRenderer.on('export-data-error', handleExportError);
    ipcRenderer.on('import-data-result', handleImportResult);
    ipcRenderer.on('import-data-error', handleImportError);
    ipcRenderer.on('delete-all-data-result', handleDeleteAllResult);
    ipcRenderer.on('delete-all-data-error', handleDeleteAllError);

    return () => {
      ipcRenderer.removeListener('data-path', handleDataPath);
      ipcRenderer.removeListener('export-data-result', handleExportResult);
      ipcRenderer.removeListener('export-data-error', handleExportError);
      ipcRenderer.removeListener('import-data-result', handleImportResult);
      ipcRenderer.removeListener('import-data-error', handleImportError);
      ipcRenderer.removeListener('delete-all-data-result', handleDeleteAllResult);
      ipcRenderer.removeListener('delete-all-data-error', handleDeleteAllError);
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
    const confirmFirst = confirm(
      'Are you absolutely sure you want to delete ALL your snippets? This action cannot be undone!'
    );
    
    if (confirmFirst) {
      const confirmSecond = confirm(
        'This will permanently delete all your data. Type "DELETE ALL" to confirm:'
      );
      
      if (confirmSecond) {
        const userInput = prompt('Type "DELETE ALL" to confirm:');
        if (userInput === 'DELETE ALL') {
          setIsDeletingAll(true);
          ipcRenderer.send('delete-all-data');
        } else {
          alert('Delete cancelled - text did not match.');
        }
      }
    }
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
                {isDeletingAll ? 'Deleting...' : 'Delete All Data'}
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
