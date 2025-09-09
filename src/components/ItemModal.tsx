import React, { useState, useEffect, useCallback } from 'react';
import { Item, ItemType } from '../types';
import { useAutosize } from '../hooks/useAutosize';

interface ItemModalProps {
  item?: Item | null;
  onSave: (itemData: { type: ItemType; description: string; payload: string }) => Promise<void>;
  onCancel: () => void;
  onDelete?: (itemId: string) => void;
  isSaving?: boolean;
}

const ItemModal: React.FC<ItemModalProps> = ({ item, onSave, onCancel, onDelete, isSaving = false }) => {
  const [type, setType] = useState<ItemType>('link');
  const [description, setDescription] = useState('');
  const [payload, setPayload] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const textareaRef = useAutosize<HTMLTextAreaElement>();

  const handleImageSelect = async () => {
    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('select-image-file');
      if (result && !result.canceled) {
        setPayload(result.filePath);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
    }
  };

  useEffect(() => {
    if (item) {
      setType(item.type);
      setDescription(item.description);
      setPayload(item.payload);
    } else {
      setType('link');
      setDescription('');
      setPayload('');
    }
    setErrors({});
  }, [item]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!payload.trim()) {
      newErrors.payload = 'Please fill out this field.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || isSaving) {
      return;
    }

    try {
      await onSave({
        type,
        description: description.trim(),
        payload: payload.trim()
      });
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Error saving item:', error);
    }
  };

  const handleDelete = () => {
    if (!item || !onDelete) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to delete this item? This action cannot be undone.'
    );
    
    if (confirmed) {
      onDelete(item.id);
    }
  };

  const handleCancel = useCallback(() => {
    if (isSaving) return; // Prevent closing while saving
    
    // Check if there are unsaved changes by comparing with original values
    const originalDescription = item?.description || '';
    const originalPayload = item?.payload || '';
    
    const hasUnsavedChanges = (
      description.trim() !== originalDescription.trim() || 
      payload.trim() !== originalPayload.trim()
    );
    
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    
    onCancel();
  }, [description, payload, item, onCancel, isSaving]);

  // Handle ESC key globally when modal is open
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [handleCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} onKeyDown={handleKeyDown}>
      <div className="modal-content" role="dialog" aria-modal="true">
        <h2 className="modal-title">
          {item ? 'Edit Item' : 'Add Item'}
        </h2>
        
        <form onSubmit={handleSubmit} className="item-form">
          <div className="form-group">
            <label className="form-label">Type</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="type"
                  value="link"
                  checked={type === 'link'}
                  onChange={(e) => setType(e.target.value as ItemType)}
                  disabled={isSaving}
                />
                Link
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="type"
                  value="kusto_query"
                  checked={type === 'kusto_query'}
                  onChange={(e) => setType(e.target.value as ItemType)}
                  disabled={isSaving}
                />
                Kusto Query
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="type"
                  value="prompt"
                  checked={type === 'prompt'}
                  onChange={(e) => setType(e.target.value as ItemType)}
                  disabled={isSaving}
                />
                Prompt
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="type"
                  value="image"
                  checked={type === 'image'}
                  onChange={(e) => setType(e.target.value as ItemType)}
                  disabled={isSaving}
                />
                Image
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`form-input ${errors.description ? 'error' : ''}`}
              placeholder="Enter a description..."
              disabled={isSaving}
            />
            {errors.description && (
              <span className="error-message">{errors.description}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="payload" className="form-label">
              {type === 'link' ? 'Payload (URL)' : type === 'kusto_query' ? 'Payload (KQL)' : type === 'image' ? 'Image File' : 'Payload (Prompt)'}
            </label>
            {type === 'image' ? (
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <button 
                    type="button" 
                    className="action-button secondary"
                    onClick={handleImageSelect}
                    disabled={isSaving}
                  >
                    Select Image
                  </button>
                  {payload && (
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {payload.split('/').pop()}
                    </span>
                  )}
                </div>
                {payload && (
                  <img 
                    src={`file://${payload}`} 
                    alt="Preview"
                    style={{ 
                      maxWidth: '200px', 
                      maxHeight: '200px', 
                      objectFit: 'contain',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                )}
              </div>
            ) : (
              <textarea
                id="payload"
                ref={textareaRef}
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className={`form-textarea ${errors.payload ? 'error' : ''}`}
                placeholder={type === 'link' ? 'https://...' : type === 'kusto_query' ? 'Enter your KQL query...' : 'Enter your prompt...'}
                rows={3}
                disabled={isSaving}
              />
            )}
            {errors.payload && (
              <span className="error-message">{errors.payload}</span>
            )}
            {errors.payload === 'Please fill out this field.' && (
              <div className="error-tooltip">Please fill out this field.</div>
            )}
          </div>

          <div className="form-actions">
            <div className="left-actions">
              {item && onDelete && (
                <button 
                  type="button" 
                  className="action-button danger"
                  onClick={handleDelete}
                >
                  Delete
                </button>
              )}
            </div>
            <div className="right-actions">
              <button 
                type="button" 
                className="action-button secondary"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={`action-button primary ${isSaving ? 'loading' : ''}`}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="loading-spinner"></span>
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemModal;
