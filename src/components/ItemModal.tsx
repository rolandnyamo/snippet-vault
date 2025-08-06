import React, { useState, useEffect, useCallback } from 'react';
import { Item, ItemType } from '../types';
import { useAutosize } from '../hooks/useAutosize';

interface ItemModalProps {
  item?: Item | null;
  onSave: (itemData: { type: ItemType; description: string; payload: string }) => void;
  onCancel: () => void;
}

const ItemModal: React.FC<ItemModalProps> = ({ item, onSave, onCancel }) => {
  const [type, setType] = useState<ItemType>('link');
  const [description, setDescription] = useState('');
  const [payload, setPayload] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const textareaRef = useAutosize<HTMLTextAreaElement>();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSave({
      type,
      description: description.trim(),
      payload: payload.trim()
    });
  };

  const handleCancel = useCallback(() => {
    const hasUnsavedChanges = description.trim() || payload.trim();
    
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    
    onCancel();
  }, [description, payload, onCancel]);

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
                />
                Kusto Query
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
            />
            {errors.description && (
              <span className="error-message">{errors.description}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="payload" className="form-label">
              Payload ({type === 'link' ? 'URL' : 'KQL'})
            </label>
            <textarea
              id="payload"
              ref={textareaRef}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className={`form-textarea ${errors.payload ? 'error' : ''}`}
              placeholder={type === 'link' ? 'https://...' : 'Enter your KQL query...'}
              rows={3}
            />
            {errors.payload && (
              <span className="error-message">{errors.payload}</span>
            )}
            {errors.payload === 'Please fill out this field.' && (
              <div className="error-tooltip">Please fill out this field.</div>
            )}
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="action-button secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="action-button primary"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemModal;
