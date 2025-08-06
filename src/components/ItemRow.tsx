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
      default: return type.toUpperCase();
    }
  };

  const truncatePayload = (payload: string, maxLength: number = 60): string => {
    if (payload.length <= maxLength) return payload;
    return payload.substring(0, maxLength) + '…';
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
          <span className="item-description">{item.description}</span>
          <span className="item-time">{timeAgo}</span>
          {onDelete && (
            <button 
              className="item-delete-btn"
              onClick={handleDelete}
              title="Delete item"
            >
              ×
            </button>
          )}
          <span className="item-arrow">▸</span>
        </div>
        <div className="item-payload">
          {truncatePayload(item.payload)}
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
