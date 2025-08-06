import React from 'react';
import { Item } from '../types';
import ItemRow from './ItemRow';

interface ItemListProps {
  items: Item[];
  onItemSelect: (item: Item) => void;
  onItemDelete?: (itemId: string) => void;
  selectedItem: Item | null;
  searchQuery: string;
}

const ItemList: React.FC<ItemListProps> = ({ 
  items, 
  onItemSelect, 
  onItemDelete,
  selectedItem, 
  searchQuery 
}) => {
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

  const handleKeyDown = (e: React.KeyboardEvent, item: Item) => {
    if (e.key === 'Enter') {
      // Copy payload on Enter
      navigator.clipboard.writeText(item.payload);
    }
  };

  if (items.length === 0) {
    return (
      <div className="item-list empty">
        {searchQuery ? (
          <p>No items found for "{searchQuery}"</p>
        ) : (
          <p>No items yet. Click "+ New" to add your first snippet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="item-list">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          isSelected={selectedItem?.id === item.id}
          timeAgo={formatTimeAgo(item.last_accessed_at)}
          onClick={() => onItemSelect(item)}
          onKeyDown={(e) => handleKeyDown(e, item)}
          onDelete={onItemDelete}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  );
};

export default ItemList;
