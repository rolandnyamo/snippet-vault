import React from 'react';
import { Item } from '../types';

interface DetailPanelProps {
  item: Item;
  onEdit: (item: Item) => void;
  onCopy: (item: Item) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ item, onEdit, onCopy }) => {
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'kusto_query': return 'Kusto Query';
      case 'link': return 'Link';
      default: return type;
    }
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
    // Could show a toast notification here
  };

  const handleEdit = () => {
    onEdit(item);
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h3 className="detail-title">{item.description}</h3>
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
        <div className="payload-container">
          <pre className="payload-text">{item.payload}</pre>
        </div>
      </div>

      <div className="detail-actions">
        <button 
          className="action-button primary" 
          onClick={handleCopy}
        >
          Copy
        </button>
        <button 
          className="action-button secondary" 
          onClick={handleEdit}
        >
          Edit
        </button>
      </div>
    </div>
  );
};

export default DetailPanel;
