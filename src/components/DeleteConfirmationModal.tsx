import React, { useState } from 'react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  const [inputValue, setInputValue] = useState('');
  
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (inputValue === 'delete') {
      onConfirm();
      setInputValue(''); // Reset for next time
    }
  };

  const handleCancel = () => {
    setInputValue(''); // Reset input
    onCancel();
  };

  const isConfirmEnabled = inputValue === 'delete';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '500px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            fontSize: '24px',
            marginRight: '12px'
          }}>⚠️</div>
          <h3 style={{
            margin: 0,
            color: '#d32f2f',
            fontSize: '18px',
            fontWeight: 600
          }}>
            Delete All Data
          </h3>
        </div>
        
        <p style={{
          margin: '0 0 20px 0',
          lineHeight: '1.5',
          color: '#333'
        }}>
          This will permanently delete <strong>ALL</strong> your snippets and cannot be undone.
        </p>
        
        <p style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          color: '#666'
        }}>
          Type <strong>"delete"</strong> (lowercase) to confirm:
        </p>
        
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type 'delete' to confirm"
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '2px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            marginBottom: '20px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isConfirmEnabled) {
              handleConfirm();
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
        />
        
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isConfirmEnabled ? '#d32f2f' : '#ccc',
              color: 'white',
              cursor: isConfirmEnabled ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 500,
              opacity: isConfirmEnabled ? 1 : 0.6
            }}
          >
            Delete All Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
