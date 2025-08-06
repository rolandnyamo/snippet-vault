# Snippet Vault

A lightweight, entirely-offline desktop utility for storing and semantically searching Kusto queries, URLs, and other artifacts.

## Development Setup

For developers working on this project:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rolandnyamo/snippet-vault.git
   cd snippet-vault
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   
   Note: The `postinstall` script will automatically stub problematic native dependencies (onnxruntime-node, sharp) that aren't needed for our web-based implementation.

3. **Download models** (required for offline operation):
   ```bash
   npm run download-models
   ```

4. **Start development**:
   ```bash
   npm start
   ```

5. **Package for distribution**:
   ```bash
   npm run package
   ```

### Architecture Notes

- **Fully Offline**: Uses locally downloaded embedding models (Xenova/all-MiniLM-L6-v2) for semantic search
- **Web Backend**: Forces @xenova/transformers to use web backend to avoid native ONNX dependencies
- **ES Modules**: Converted to ES modules for better compatibility
- **Local Database**: Uses LanceDB with local storage for vector search

## First Launch

When you first launch Snippet Vault, you will be prompted to select a folder on your local machine. This folder will be used to store all of your data, including the search index and any saved items. This ensures that all of your information is kept private and secure on your own computer.

## Adding New Items

To add a new item to your vault, simply fill out the form and click "Save". You can add two types of items:

*   **Links**: Save a URL for later reference.
*   **Kusto Queries**: Store your Kusto queries for easy access and reuse.

When you save an item, Snippet Vault will automatically generate a semantic embedding of the content. This allows you to search for items based on their meaning, not just keywords.

## Searching for Items

To search for an item, simply type in the search box. Snippet Vault will perform a hybrid search, combining semantic and keyword matching to find the most relevant results. The search results will update in real-time as you type.