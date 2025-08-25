import React, { useState, useEffect } from 'react';
import { Item, ItemType } from '../types';
import SearchBar from './SearchBar';
import ItemList from './ItemList';
import DetailPanel from './DetailPanel';
import ItemModal from './ItemModal';
import SmartAddModal from './SmartAddModal';
import SettingsModal from './SettingsModal';
import ModelSelectionModal from './ModelSelectionModal';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelSelectionOpen, setIsModelSelectionOpen] = useState(false);
  const [currentEmbeddingModel, setCurrentEmbeddingModel] = useState<string>('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState({ current: 0, total: 0, success: 0, errors: 0 });
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);

  const showToastNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000); // Hide after 3 seconds
  };

  useEffect(() => {
    // Load recent items and all items on mount
    ipcRenderer.send('get-recent-items');
    ipcRenderer.send('get-all-items');
    
    // Get current embedding model
    ipcRenderer.send('get-current-model-type');
    
    // Check if it's first time using the app
    ipcRenderer.send('is-first-time');

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
      
      // Refresh both recent and all items after successful delete
      ipcRenderer.send('get-recent-items');
      ipcRenderer.send('get-all-items');
      showToastNotification('✅ Item deleted successfully!');
    };

    const handleItemDeleteError = (event: any, error: string) => {
      console.error('Error deleting item:', error);
      showToastNotification('❌ Failed to delete item: ' + error);
    };

    const handleItemAdded = (event: any, addedItem: any) => {
      // Refresh both recent and all items after successful add
      ipcRenderer.send('get-recent-items');
      ipcRenderer.send('get-all-items');
      showToastNotification('✅ Item added successfully!');
    };

    const handleItemAddError = (event: any, error: string) => {
      console.error('Error adding item:', error);
      showToastNotification('❌ Failed to add item: ' + error);
    };

    const handleModelTypeSet = (event: any, result: any) => {
      setCurrentEmbeddingModel(result.modelType);
    };

    const handleModelTypeError = (event: any, error: string) => {
      console.error('Error setting model type:', error);
    };

    const handleCurrentModelTypeResult = (event: any, modelType: string) => {
      setCurrentEmbeddingModel(modelType);
    };

    const handleCurrentModelTypeError = (event: any, error: string) => {
      console.error('Error getting current model type:', error);
    };

    const handleIsFirstTimeResult = (event: any, isFirstTime: boolean) => {
      if (isFirstTime) {
        setCurrentEmbeddingModel('lightweight'); // Preselect lightweight for first time
        setIsModelSelectionOpen(true);
      }
    };

    const handleRebuildStarted = (event: any, data: any) => {
      setIsRebuilding(true);
      setRebuildProgress({ current: 0, total: 0, success: 0, errors: 0 });
    };

    const handleRebuildProgress = (event: any, progress: any) => {
      setRebuildProgress(progress);
    };

    const handleRebuildComplete = (event: any, result: any) => {
      setIsRebuilding(false);
      setRebuildProgress({ current: 0, total: 0, success: 0, errors: 0 });
      // Refresh the current items
      ipcRenderer.send('get-recent-items');
      if (activeTab === 'all') {
        ipcRenderer.send('get-all-items');
      }
    };

    const handleRebuildError = (event: any, error: any) => {
      console.error('Rebuild error:', error);
      setIsRebuilding(false);
      setRebuildProgress({ current: 0, total: 0, success: 0, errors: 0 });
    };

    ipcRenderer.on('search-results', handleSearchResults);
    ipcRenderer.on('recent-items', handleRecentItems);
    ipcRenderer.on('all-items', handleAllItems);
    ipcRenderer.on('item-added', handleItemAdded);
    ipcRenderer.on('item-add-error', handleItemAddError);
    ipcRenderer.on('item-deleted', handleItemDeleted);
    ipcRenderer.on('item-delete-error', handleItemDeleteError);
    ipcRenderer.on('model-type-set', handleModelTypeSet);
    ipcRenderer.on('model-type-error', handleModelTypeError);
    ipcRenderer.on('current-model-type-result', handleCurrentModelTypeResult);
    ipcRenderer.on('current-model-type-error', handleCurrentModelTypeError);
    ipcRenderer.on('is-first-time-result', handleIsFirstTimeResult);
    ipcRenderer.on('rebuild-started', handleRebuildStarted);
    ipcRenderer.on('rebuild-progress', handleRebuildProgress);
    ipcRenderer.on('rebuild-complete', handleRebuildComplete);
    ipcRenderer.on('rebuild-error', handleRebuildError);

    return () => {
      ipcRenderer.removeListener('search-results', handleSearchResults);
      ipcRenderer.removeListener('recent-items', handleRecentItems);
      ipcRenderer.removeListener('all-items', handleAllItems);
      ipcRenderer.removeListener('item-added', handleItemAdded);
      ipcRenderer.removeListener('item-add-error', handleItemAddError);
      ipcRenderer.removeListener('item-deleted', handleItemDeleted);
      ipcRenderer.removeListener('item-delete-error', handleItemDeleteError);
      ipcRenderer.removeListener('model-type-set', handleModelTypeSet);
      ipcRenderer.removeListener('model-type-error', handleModelTypeError);
      ipcRenderer.removeListener('current-model-type-result', handleCurrentModelTypeResult);
      ipcRenderer.removeListener('current-model-type-error', handleCurrentModelTypeError);
      ipcRenderer.removeListener('is-first-time-result', handleIsFirstTimeResult);
      ipcRenderer.removeListener('rebuild-started', handleRebuildStarted);
      ipcRenderer.removeListener('rebuild-progress', handleRebuildProgress);
      ipcRenderer.removeListener('rebuild-complete', handleRebuildComplete);
      ipcRenderer.removeListener('rebuild-error', handleRebuildError);
    };
  }, [searchQuery, activeTab]);

  // Handle model selection modal
  useEffect(() => {
    const handleOpenModelSelection = (event: any) => {
      const { currentModel } = event.detail || {};
      setCurrentEmbeddingModel(currentModel || '');
      setIsModelSelectionOpen(true);
    };

    window.addEventListener('openModelSelection', handleOpenModelSelection);

    return () => {
      window.removeEventListener('openModelSelection', handleOpenModelSelection);
    };
  }, []);

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

  const handleSaveItem = async (itemData: { type: ItemType; description: string; payload: string }) => {
    setIsSaving(true);
    try {
      if (editingItem) {
        // Handle edit - update the existing item
        await ipcRenderer.invoke('update-item', editingItem.id, itemData);
        showToastNotification('✅ Item updated successfully!');
      } else {
        // Handle add
        await ipcRenderer.invoke('add-item', itemData);
        // The 'item-added' event will be sent from backend and handled by handleItemAdded
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Frontend error in handleSaveItem:', error);
      showToastNotification(`❌ Failed to save item: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSmartAddSave = async (itemData: { type: ItemType; description: string; payload: string }) => {
    setIsSaving(true);
    try {
      await ipcRenderer.invoke('add-item', itemData);
      // The 'item-added' event will be sent from backend and handled by handleItemAdded
      setIsSmartAddOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Frontend error in handleSmartAddSave:', error);
      showToastNotification(`❌ Failed to add item: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSmartAddCancel = () => {
    setIsSmartAddOpen(false);
    setIsSaving(false); // Reset saving state on cancel
  };

  const handleModelSelected = (modelType: string) => {
    // Send IPC message to update the embedding model
    ipcRenderer.send('set-model-type', modelType);
    setCurrentEmbeddingModel(modelType);
    setIsModelSelectionOpen(false);
    
    // Mark that user has selected a model (for first-time flow)
    ipcRenderer.send('mark-model-selected', modelType);
  };

  const handleModelSelectionClose = () => {
    setIsModelSelectionOpen(false);
  };

  const handleCopyItem = (item: Item) => {
    navigator.clipboard.writeText(item.payload);
  };

  const handleImportSuccess = () => {
    // Refresh both recent and all items after successful import
    ipcRenderer.send('get-recent-items');
    ipcRenderer.send('get-all-items');
    showToastNotification('✅ Items imported and lists refreshed!');
  };

  const handleDeleteAllSuccess = () => {
    // Clear all items from state and refresh lists
    setItems([]);
    setAllItems([]);
    setFilteredItems([]);
    setSelectedItem(null);
    // Also refresh from backend to be sure
    ipcRenderer.send('get-recent-items');
    ipcRenderer.send('get-all-items');
    showToastNotification('✅ All items deleted successfully!');
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
            All ({allItems.length})
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
              onDelete={handleDeleteItem}
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
            setIsSaving(false); // Reset saving state on cancel
          }}
          isSaving={isSaving}
        />
      )}

      {isSmartAddOpen && (
        <SmartAddModal
          onSave={handleSmartAddSave}
          onCancel={handleSmartAddCancel}
          isSaving={isSaving}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onImportSuccess={handleImportSuccess}
          onDeleteAllSuccess={handleDeleteAllSuccess}
        />
      )}

      {isModelSelectionOpen && (
        <ModelSelectionModal
          isOpen={isModelSelectionOpen}
          onClose={handleModelSelectionClose}
          onModelSelected={handleModelSelected}
          currentModel={currentEmbeddingModel}
        />
      )}

      {isRebuilding && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '18px',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>🔄 Rebuilding database for model change...</div>
          {rebuildProgress.total > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div>Progress: {rebuildProgress.current} / {rebuildProgress.total}</div>
              <div>✅ Success: {rebuildProgress.success} | ❌ Errors: {rebuildProgress.errors}</div>
              <div style={{
                width: '300px',
                height: '10px',
                backgroundColor: '#333',
                borderRadius: '5px',
                overflow: 'hidden',
                margin: '10px 0'
              }}>
                <div style={{
                  width: `${(rebuildProgress.current / rebuildProgress.total) * 100}%`,
                  height: '100%',
                  backgroundColor: '#007AFF',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default AppShell;
