const { ipcRenderer } = require('electron');

document.getElementById('add-item-form').addEventListener('submit', (evt) => {
  evt.preventDefault();

  const type = document.getElementById('item-type').value;
  const payload = document.getElementById('item-payload').value;
  const description = document.getElementById('item-description').value;

  ipcRenderer.send('add-item', { type, payload, description });

  // Clear the form
  document.getElementById('item-type').value = 'text';
  document.getElementById('item-payload').value = '';
  document.getElementById('item-description').value = '';

  // Refresh the recent items
  ipcRenderer.send('get-recent-items');
});

document.getElementById('search-box').addEventListener('input', (evt) => {
  const query = evt.target.value;
  ipcRenderer.send('search-items', query);
});

ipcRenderer.on('search-results', (event, results) => {
  const resultsDiv = document.getElementById('search-results');
  resultsDiv.innerHTML = '';
  results.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.textContent = `[${item.type}] ${item.description}`;
    resultsDiv.appendChild(itemDiv);
  });
});

ipcRenderer.on('recent-items', (event, items) => {
  const recentItemsDiv = document.getElementById('recent-items');
  recentItemsDiv.innerHTML = '';
  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.textContent = `[${item.type}] ${item.description}`;
    recentItemsDiv.appendChild(itemDiv);
  });
});

// Request recent items on load
ipcRenderer.send('get-recent-items');
