import React, { useState, useEffect } from 'react';
import { Item, ItemType } from '../types';
import SearchBar from './SearchBar';
import ItemList from './ItemList';
import DetailPanel from './DetailPanel';
import ItemModal from './ItemModal';
import SmartAddModal from './SmartAddModal';

const { ipcRenderer } = window.require('electron');

type Tab = 'recent' | 'all';

const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmartAddOpen, setIsSmartAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  useEffect(() => {
    // Load recent items on mount
    ipcRenderer.send('get-recent-items');

    // Set up IPC listeners
    const handleSearchResults = (event: any, results: Item[]) => {
      setFilteredItems(results);
    };

    const handleRecentItems = (event: any, recentItems: Item[]) => {
      setItems(recentItems);
      if (!searchQuery) {
        setFilteredItems(recentItems);
      }
    };

    const handleItemAdded = (event: any, addedItem: any) => {
      // Refresh recent items immediately after successful add
      ipcRenderer.send('get-recent-items');
    };

    const handleItemAddError = (event: any, error: string) => {
      console.error('Error adding item:', error);
      // You could show a toast notification here
    };

    ipcRenderer.on('search-results', handleSearchResults);
    ipcRenderer.on('recent-items', handleRecentItems);
    ipcRenderer.on('item-added', handleItemAdded);
    ipcRenderer.on('item-add-error', handleItemAddError);

    return () => {
      ipcRenderer.removeListener('search-results', handleSearchResults);
      ipcRenderer.removeListener('recent-items', handleRecentItems);
      ipcRenderer.removeListener('item-added', handleItemAdded);
      ipcRenderer.removeListener('item-add-error', handleItemAddError);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      ipcRenderer.send('search-items', searchQuery);
    } else {
      setFilteredItems(items);
    }
  }, [searchQuery, items]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    // Update last_accessed_at
    const updatedItem = {
      ...item,
      last_accessed_at: new Date().toISOString()
    };
    // You might want to send an IPC to update this in the database
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setIsSmartAddOpen(true);
  };

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = (itemData: { type: ItemType; description: string; payload: string }) => {
    if (editingItem) {
      // Handle edit - you'd send an IPC to update the item
      console.log('Editing item:', editingItem.id, itemData);
    } else {
      // Handle add
      ipcRenderer.send('add-item', itemData);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSmartAddSave = (itemData: { type: ItemType; description: string; payload: string }) => {
    ipcRenderer.send('add-item', itemData);
    setIsSmartAddOpen(false);
  };

  const handleSmartAddCancel = () => {
    setIsSmartAddOpen(false);
  };

  const handleCopyItem = (item: Item) => {
    navigator.clipboard.writeText(item.payload);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      // Focus search bar
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      searchInput?.focus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      handleAddItem();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    // Listen for smart add modal trigger from search bar
    const handleOpenSmartAdd = () => {
      handleAddItem();
    };
    
    window.addEventListener('openSmartAdd', handleOpenSmartAdd);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('openSmartAdd', handleOpenSmartAdd);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="tab-bar">
          <button 
            className={`tab ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => setActiveTab('recent')}
          >
            Recent
          </button>
          <button 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button className="add-button" onClick={handleAddItem}>
            + New
          </button>
          <button className="settings-button">
            ⚙︎
          </button>
        </div>
        <SearchBar onSearch={handleSearch} value={searchQuery} />
      </header>

      <main className="app-main">
        <div className="left-panel">
          <ItemList 
            items={filteredItems}
            onItemSelect={handleItemSelect}
            selectedItem={selectedItem}
            searchQuery={searchQuery}
          />
        </div>
        {selectedItem && (
          <div className="right-panel">
            <DetailPanel 
              item={selectedItem}
              onEdit={handleEditItem}
              onCopy={handleCopyItem}
            />
          </div>
        )}
      </main>

      {isModalOpen && (
        <ItemModal
          item={editingItem}
          onSave={handleSaveItem}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
        />
      )}

      {isSmartAddOpen && (
        <SmartAddModal
          onSave={handleSmartAddSave}
          onCancel={handleSmartAddCancel}
        />
      )}
    </div>
  );
};

export default AppShell;
