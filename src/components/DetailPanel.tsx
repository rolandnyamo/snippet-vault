import React, { useState } from 'react';
import { Item } from '../types';

interface DetailPanelProps {
  item: Item;
  onEdit: (item: Item) => void;
  onCopy: (item: Item) => void;
  searchQuery?: string;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ item, onEdit, onCopy, searchQuery }) => {
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'kusto_query': return 'Kusto Query';
      case 'link': return 'Link';
      default: return type;
    }
  };

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query || !text) return text;
    
    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return <mark key={index} className="search-highlight">{part}</mark>;
      }
      return part;
    });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const itemTime = new Date(timestamp);
    const diffMs = now.getTime() - itemTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} d ago`;
    return `${Math.floor(diffDays / 7)} w ago`;
  };

  const handleCopy = () => {
    onCopy(item);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 1500);
  };

  const handleEdit = () => {
    onEdit(item);
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h3 className="detail-title">
          {searchQuery ? highlightText(item.description, searchQuery) : item.description}
        </h3>
        <div className="detail-meta">
          <div className="meta-row">
            <span className="meta-label">Type:</span>
            <span className="meta-value">{getTypeLabel(item.type)}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Added:</span>
            <span className="meta-value">{formatDate(item.created_at)}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Last used:</span>
            <span className="meta-value">{formatTimeAgo(item.last_accessed_at)}</span>
          </div>
        </div>
      </div>

      <div className="detail-content">
        <div className="edit-section">
          <button 
            className="action-button secondary" 
            onClick={handleEdit}
          >
            Edit
          </button>
        </div>
        
        <div className="payload-container">
          <div className="payload-header">
            <button 
              className={`copy-icon-button ${showCopySuccess ? 'success' : ''}`}
              onClick={handleCopy}
              title={showCopySuccess ? 'Copied!' : 'Copy to clipboard'}
            >
              {showCopySuccess ? '✓' : '�'}
            </button>
          </div>
          <pre className="payload-text">
            {searchQuery ? highlightText(item.payload, searchQuery) : item.payload}
          </pre>
        </div>
      </div>

    </div>
  );
};

export default DetailPanel;
