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

  const handleImageDrop = async (files: FileList) => {
    const file = files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const { ipcRenderer } = window.require('electron');
        // Convert file to buffer for IPC
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const savedPath = await ipcRenderer.invoke('save-dropped-image', {
          buffer,
          name: file.name,
          type: file.type
        });
        setPayload(savedPath);
        setDetectedType('image');
        setStep('description');
        // Auto-focus description input after a short delay
        setTimeout(() => {
          descriptionRef.current?.focus();
        }, 100);
      } catch (error) {
        console.error('Error handling dropped image:', error);
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const { ipcRenderer } = window.require('electron');
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const savedPath = await ipcRenderer.invoke('save-pasted-image', {
              buffer,
              name: `pasted-image-${Date.now()}.png`,
              type: file.type
            });
            setPayload(savedPath);
            setDetectedType('image');
            setStep('description');
            // Auto-focus description input after a short delay
            setTimeout(() => {
              descriptionRef.current?.focus();
            }, 100);
          } catch (error) {
            console.error('Error handling pasted image:', error);
          }
        }
        return;
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageDrop(files);
    }
  };

  const detectContentType = (content: string): ItemType => {
    const trimmed = content.trim();
    
    // Check if it's an image file path
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|heic|heif)$/i;
    if (imageExtensions.test(trimmed)) {
      return 'image';
    }
    
    // URL detection - more comprehensive regex
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}(\/.*)?$/;
    
    if (urlRegex.test(trimmed) || domainRegex.test(trimmed)) {
      return 'link';
    }
    
    // KQL detection - look for strong KQL signals
    // We try to avoid false positives so generic text becomes a 'prompt'
    const kqlStrongOps = /(where|project|extend|summarize|order\s+by|take|limit|sort\s+by)/i;
    const hasKqlPipeWithOp = /\|\s*(where|project|extend|summarize|order\s+by|take|limit|sort\s+by)/i.test(trimmed);
    const hasKqlFuncs = /(ago|now|startofday|endofday|bin)\s*\(/i.test(trimmed);
    const hasAggFuncs = /(count|sum|avg|min|max|dcount|percentile)\s*\(/i.test(trimmed);
    const looksLikeTableThenPipe = /^[a-zA-Z][a-zA-Z0-9_]*\s*\|/.test(trimmed);

    const kqlKeywordHits = [hasKqlPipeWithOp, hasKqlFuncs, hasAggFuncs, looksLikeTableThenPipe]
      .filter(Boolean).length;

    // Classify as KQL if we have a strong operator after a pipe,
    // or multiple independent KQL cues
    if (hasKqlPipeWithOp || kqlKeywordHits >= 2) {
      return 'kusto_query';
    }

    // Default: treat as a natural-language prompt
    return 'prompt';
  };

  const handlePayloadSubmit = () => {
    if (!payload.trim()) return;
    
    const detected = detectContentType(payload);
    setDetectedType(detected);
    
    // Always proceed with detected type (link, kusto_query, or prompt)
    setStep('description');
    // Auto-focus description input after a short delay
    setTimeout(() => {
      descriptionRef.current?.focus();
    }, 100);
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
        return 'Paste your content here. URL, KQL query, or prompt...';
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
    <div 
      className="modal-backdrop" 
      onClick={handleBackdropClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
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
              <button 
                className={`type-option ${isSaving ? 'disabled' : ''}`}
                onClick={() => !isSaving && handleTypeSelection('prompt')}
                disabled={isSaving}
              >
                <div className="type-icon">💬</div>
                <div className="type-label">Prompt</div>
                <div className="type-description">Natural-language prompt text</div>
              </button>
              <button 
                className={`type-option ${isSaving ? 'disabled' : ''}`}
                onClick={() => !isSaving && handleTypeSelection('image')}
                disabled={isSaving}
              >
                <div className="type-icon">📷</div>
                <div className="type-label">Image</div>
                <div className="type-description">Image file or screenshot</div>
              </button>
            </div>
          </div>
        )}

        {step === 'description' && (
          <div className="smart-add-step">
            <div className="payload-preview">
              <div className="type-badge">
                {detectedType === 'link' ? '🔗 Link' : 
                 detectedType === 'kusto_query' ? '📊 KQL Query' : 
                 detectedType === 'image' ? '� Image' : '�💬 Prompt'}
              </div>
              {detectedType === 'image' ? (
                <img 
                  src={`file://${payload}`} 
                  alt="Preview"
                  style={{ 
                    maxWidth: '200px', 
                    maxHeight: '150px', 
                    objectFit: 'contain',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              ) : (
                <div className="preview-text">{payload}</div>
              )}
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
