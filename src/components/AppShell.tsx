import React, { useState, useEffect } from 'react';
import { Item, ItemType } from '../types';
import SearchBar from './SearchBar';
import ItemList from './ItemList';
import DetailPanel from './DetailPanel';
import ItemModal from './ItemModal';
import SmartAddModal from './SmartAddModal';
import SettingsModal from './SettingsModal';

const { ipcRenderer } = window.require('electron');

type Tab = 'recent' | 'all';

const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmartAddOpen, setIsSmartAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      if (!searchQuery && activeTab === 'recent') {
        setFilteredItems(recentItems);
      }
    };

    const handleAllItems = (event: any, allItems: Item[]) => {
      setAllItems(allItems);
      if (!searchQuery && activeTab === 'all') {
        setFilteredItems(allItems);
      }
    };

    const handleItemDeleted = (event: any, deletedItemId: string) => {
      // Remove from both lists and clear selection if deleted item was selected
      setItems(prev => prev.filter(item => item.id !== deletedItemId));
      setAllItems(prev => prev.filter(item => item.id !== deletedItemId));
      setFilteredItems(prev => prev.filter(item => item.id !== deletedItemId));
      
      if (selectedItem?.id === deletedItemId) {
        setSelectedItem(null);
      }
      
      // Close modal if we're deleting the currently edited item
      if (editingItem?.id === deletedItemId) {
        setIsModalOpen(false);
        setEditingItem(null);
      }
      
      // Refresh the current tab
      if (activeTab === 'recent') {
        ipcRenderer.send('get-recent-items');
      } else {
        ipcRenderer.send('get-all-items');
      }
    };

    const handleItemDeleteError = (event: any, error: string) => {
      console.error('Error deleting item:', error);
      alert(`Failed to delete item: ${error}`);
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
    ipcRenderer.on('all-items', handleAllItems);
    ipcRenderer.on('item-added', handleItemAdded);
    ipcRenderer.on('item-add-error', handleItemAddError);
    ipcRenderer.on('item-deleted', handleItemDeleted);
    ipcRenderer.on('item-delete-error', handleItemDeleteError);

    return () => {
      ipcRenderer.removeListener('search-results', handleSearchResults);
      ipcRenderer.removeListener('recent-items', handleRecentItems);
      ipcRenderer.removeListener('all-items', handleAllItems);
      ipcRenderer.removeListener('item-added', handleItemAdded);
      ipcRenderer.removeListener('item-add-error', handleItemAddError);
      ipcRenderer.removeListener('item-deleted', handleItemDeleted);
      ipcRenderer.removeListener('item-delete-error', handleItemDeleteError);
    };
  }, [searchQuery, activeTab]);

  useEffect(() => {
    if (searchQuery.trim()) {
      ipcRenderer.send('search-items', searchQuery);
    } else {
      // Show items based on active tab
      if (activeTab === 'recent') {
        setFilteredItems(items);
      } else {
        setFilteredItems(allItems);
      }
    }
  }, [searchQuery, items, allItems, activeTab]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchQuery(''); // Clear search when switching tabs
    
    if (tab === 'recent') {
      ipcRenderer.send('get-recent-items');
    } else {
      ipcRenderer.send('get-all-items');
    }
  };

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

  const handleDeleteItem = (itemId: string) => {
    ipcRenderer.send('delete-item', itemId);
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSettings = () => {
    setIsSettingsOpen(true);
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
            onClick={() => handleTabChange('recent')}
          >
            Recent
          </button>
          <button 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            All
          </button>
          <button className="add-button" onClick={handleAddItem}>
            + New
          </button>
          <button className="settings-button" onClick={handleSettings}>
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
            onItemDelete={handleDeleteItem}
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
              searchQuery={searchQuery}
            />
          </div>
        )}
      </main>

      {isModalOpen && (
        <ItemModal
          item={editingItem}
          onSave={handleSaveItem}
          onDelete={handleDeleteItem}
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

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};

export default AppShell;
