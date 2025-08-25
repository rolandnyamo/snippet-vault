import React, { useState, useEffect, useRef } from 'react';
import { ItemType } from '../types';
import { useAutosize } from '../hooks/useAutosize';

interface SmartAddModalProps {
  onSave: (itemData: { type: ItemType; description: string; payload: string }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

type Step = 'payload' | 'type-selection' | 'description';

const SmartAddModal: React.FC<SmartAddModalProps> = ({ onSave, onCancel, isSaving = false }) => {
  const [step, setStep] = useState<Step>('payload');
  const [payload, setPayload] = useState('');
  const [description, setDescription] = useState('');
  const [detectedType, setDetectedType] = useState<ItemType | null>(null);
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  
  const payloadRef = useAutosize<HTMLTextAreaElement>();
  const descriptionRef = useRef<HTMLInputElement>(null);

  const detectContentType = (content: string): ItemType | null => {
    const trimmed = content.trim();
    
    // URL detection - more comprehensive regex
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}(\/.*)?$/;
    
    if (urlRegex.test(trimmed) || domainRegex.test(trimmed)) {
      return 'link';
    }
    
    // KQL detection - look for common KQL patterns
    const kqlPatterns = [
      /\b(let|datatable|union|join|where|project|extend|summarize|order by|take|limit|sort by)\b/i,
      /\b(ago|now|startofday|endofday|bin)\s*\(/i,
      /\b(count|sum|avg|min|max|dcount|percentile)\s*\(/i,
      /\|\s*(where|project|extend|summarize|order|take|limit|sort)/i,
      /^[a-zA-Z][a-zA-Z0-9_]*\s*\|/,  // Table name followed by pipe
    ];
    
    const hasKqlPattern = kqlPatterns.some(pattern => pattern.test(trimmed));
    
    // If it has KQL patterns and is multi-line or has pipes, likely KQL
    if (hasKqlPattern || trimmed.includes('|')) {
      return 'kusto_query';
    }
    
    // If it's a single line without obvious URL markers, could be either
    if (trimmed.split('\n').length === 1 && trimmed.length < 200) {
      return null; // Ambiguous, ask user
    }
    
    // Multi-line text without URL patterns is likely KQL
    return 'kusto_query';
  };

  const handlePayloadSubmit = () => {
    if (!payload.trim()) return;
    
    const detected = detectContentType(payload);
    setDetectedType(detected);
    
    if (detected === null) {
      setShowTypeSelection(true);
      setStep('type-selection');
    } else {
      setStep('description');
      // Auto-focus description input after a short delay
      setTimeout(() => {
        descriptionRef.current?.focus();
      }, 100);
    }
  };

  const handleTypeSelection = (type: ItemType) => {
    setDetectedType(type);
    setShowTypeSelection(false);
    setStep('description');
    setTimeout(() => {
      descriptionRef.current?.focus();
    }, 100);
  };

  const handleDescriptionSubmit = async () => {
    if (!description.trim() || !detectedType || isSaving) return;
    
    try {
      await onSave({
        type: detectedType,
        description: description.trim(),
        payload: payload.trim()
      });
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Error saving item:', error);
    }
  };

  const handleCancel = () => {
    if (isSaving) return; // Prevent closing while saving
    
    const hasContent = payload.trim() || description.trim();
    if (hasContent) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSaving) return; // Prevent keyboard actions while saving
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (step === 'payload') {
        handlePayloadSubmit();
      } else if (step === 'description') {
        handleDescriptionSubmit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      handleCancel();
    }
  };

  // Auto-focus payload input when modal opens
  useEffect(() => {
    if (payloadRef.current) {
      payloadRef.current.focus();
    }
  }, []);

  const getPlaceholder = () => {
    switch (step) {
      case 'payload':
        return 'Paste your Azure Data Explorer URL and KQL query, or just a KQL query...';
      case 'description':
        return 'Enter a description...';
      default:
        return '';
    }
  };

  const getInstructionText = () => {
    switch (step) {
      case 'payload':
        return 'Paste or type your content, then press Enter';
      case 'type-selection':
        return 'What type of content is this?';
      case 'description':
        return 'Add a description, then press Enter to save';
      default:
        return '';
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content smart-add-modal" role="dialog" aria-modal="true">
        <div className="smart-add-header">
          <h2 className="modal-title">Add New Item</h2>
          <p className="instruction-text">{getInstructionText()}</p>
        </div>

        {step === 'payload' && (
          <div className="smart-add-step">
            <textarea
              ref={payloadRef}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              className="smart-input payload-input"
              rows={3}
              disabled={isSaving}
            />
            <div className="step-actions">
              <button 
                type="button" 
                className="action-button secondary"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="action-button primary"
                onClick={handlePayloadSubmit}
                disabled={!payload.trim() || isSaving}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'type-selection' && (
          <div className="smart-add-step">
            <div className="payload-preview">
              <strong>Content:</strong>
              <div className="preview-text">{payload}</div>
            </div>
            <div className="type-selection">
              <button 
                className={`type-option ${isSaving ? 'disabled' : ''}`}
                onClick={() => !isSaving && handleTypeSelection('link')}
                disabled={isSaving}
              >
                <div className="type-icon">🔗</div>
                <div className="type-label">Link/URL</div>
                <div className="type-description">A web link or URL</div>
              </button>
              <button 
                className={`type-option ${isSaving ? 'disabled' : ''}`}
                onClick={() => !isSaving && handleTypeSelection('kusto_query')}
                disabled={isSaving}
              >
                <div className="type-icon">📊</div>
                <div className="type-label">KQL Query</div>
                <div className="type-description">Kusto Query Language</div>
              </button>
            </div>
          </div>
        )}

        {step === 'description' && (
          <div className="smart-add-step">
            <div className="payload-preview">
              <div className="type-badge">
                {detectedType === 'link' ? '🔗 Link' : '📊 KQL Query'}
              </div>
              <div className="preview-text">{payload}</div>
            </div>
            
            <input
              ref={descriptionRef}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              className="smart-input description-input"
              disabled={isSaving}
            />
            <div className="step-actions">
              <button 
                type="button" 
                className="action-button secondary"
                onClick={() => setStep('payload')}
                disabled={isSaving}
              >
                Back
              </button>
              <button 
                type="button" 
                className={`action-button primary ${isSaving ? 'loading' : ''}`}
                onClick={handleDescriptionSubmit}
                disabled={!description.trim() || isSaving}
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
        )}
      </div>
    </div>
  );
};

export default SmartAddModal;
