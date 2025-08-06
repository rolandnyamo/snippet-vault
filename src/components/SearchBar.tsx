import React from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  value: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, value }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const handleClear = () => {
    onSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      // Trigger smart add modal by dispatching a custom event
      const event = new CustomEvent('openSmartAdd');
      window.dispatchEvent(event);
    }
  };

  return (
    <div className="search-bar">
      <div className="search-input-container">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search…"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
        {value && (
          <button 
            className="clear-button"
            onClick={handleClear}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
