import React from 'react';
import { Item } from '../types';

interface ItemRowProps {
  item: Item;
  isSelected: boolean;
  timeAgo: string;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDelete?: (itemId: string) => void;
  searchQuery: string;
}

const ItemRow: React.FC<ItemRowProps> = ({ 
  item, 
  isSelected, 
  timeAgo, 
  onClick, 
  onKeyDown,
  onDelete,
  searchQuery 
}) => {
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'kusto_query': return 'KQL';
      case 'link': return 'URL';
      case 'prompt': return 'PRM';
      case 'image': return 'IMG';
      default: return type.toUpperCase();
    }
  };

  const truncatePayload = (payload: string, maxLength: number = 60): string => {
    if (payload.length <= maxLength) return payload;
    return payload.substring(0, maxLength) + '…';
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row selection
    if (onDelete) {
      const confirmed = window.confirm('Are you sure you want to delete this item?');
      if (confirmed) {
        onDelete(item.id);
      }
    }
  };

  return (
    <div 
      className={`item-row ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
    >
      <div className="item-content">
        <div className="item-header">
          <span className="item-type">[{getTypeLabel(item.type)}]</span>
          <span className="item-description">
            {searchQuery ? highlightText(item.description, searchQuery) : item.description}
          </span>
          <span className="item-time">{timeAgo}</span>
          {onDelete && (
            <button 
              className="item-delete-btn"
              onClick={handleDelete}
              title="Delete item"
            >
              🗑️
            </button>
          )}
          <span className="item-arrow">▸</span>
        </div>
        <div className="item-payload">
          {item.type === 'image' ? (
            <div className="image-thumbnail-container">
              <img 
                src={`file://${item.payload}`} 
                alt={item.description}
                className="image-thumbnail"
                onError={(e) => {
                  // If image fails to load, show the file path instead
                  const container = (e.target as HTMLImageElement).parentElement;
                  if (container) {
                    container.innerHTML = `<span class="image-path-fallback">${truncatePayload(item.payload)}</span>`;
                  }
                }}
              />
            </div>
          ) : (
            searchQuery ? highlightText(truncatePayload(item.payload), searchQuery) : truncatePayload(item.payload)
          )}
        </div>
        {searchQuery && (
          <div className="item-score">
            {/* This would show vector score if available */}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemRow;
