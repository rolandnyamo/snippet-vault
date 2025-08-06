import React, { useState, useEffect, useRef } from 'react';
import { ItemType } from '../types';
import { useAutosize } from '../hooks/useAutosize';

interface SmartAddModalProps {
  onSave: (itemData: { type: ItemType; description: string; payload: string }) => void;
  onCancel: () => void;
}

type Step = 'payload' | 'type-selection' | 'description';

const SmartAddModal: React.FC<SmartAddModalProps> = ({ onSave, onCancel }) => {
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

  const handleDescriptionSubmit = () => {
    if (!description.trim() || !detectedType) return;
    
    onSave({
      type: detectedType,
      description: description.trim(),
      payload: payload.trim()
    });
  };

  const handleCancel = () => {
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
    if (e.target === e.currentTarget) {
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
        return 'Paste your URL or KQL query here...';
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
            />
            <div className="step-actions">
              <button 
                type="button" 
                className="action-button secondary"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="action-button primary"
                onClick={handlePayloadSubmit}
                disabled={!payload.trim()}
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
                className="type-option"
                onClick={() => handleTypeSelection('link')}
              >
                <div className="type-icon">🔗</div>
                <div className="type-label">Link/URL</div>
                <div className="type-description">A web link or URL</div>
              </button>
              <button 
                className="type-option"
                onClick={() => handleTypeSelection('kusto_query')}
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
            />
            <div className="step-actions">
              <button 
                type="button" 
                className="action-button secondary"
                onClick={() => setStep('payload')}
              >
                Back
              </button>
              <button 
                type="button" 
                className="action-button primary"
                onClick={handleDescriptionSubmit}
                disabled={!description.trim()}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartAddModal;
