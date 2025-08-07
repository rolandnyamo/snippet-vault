# Snippet Vault

A lightweight, entirely-offline desktop utility for storing and semantically searching Kusto queries, URLs, and other code snippets. Built with Electron, React, and TensorFlow.js for privacy-focused, intelligent search capabilities.

## Features

- 🔍 **Intelligent Search**: Hybrid semantic + keyword search using TensorFlow.js Universal Sentence Encoder
- 🔒 **100% Offline**: No data ever leaves your machine - all processing happens locally
- 📁 **Organized Storage**: Recent and All views with item count display
- 🗑️ **Item Management**: Add, edit, delete individual items or clear all data
- 📤 **Export/Import**: Backup and restore your data in JSON or CSV format
- 🔄 **Model Versioning**: Automatic embedding regeneration when models are updated
- 💾 **Reliable Backup**: Dual-table architecture preserves raw data separately from embeddings
- 🎯 **Search Highlighting**: Visual highlighting of search terms in results

## Development Setup

For developers working on this project:

**Prerequisites:**
- Node.js 22 or later
- npm 10 or later
- Git

**Setup Steps:**

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rolandnyamo/snippet-vault.git
   cd snippet-vault
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development**:
   ```bash
   npm start
   ```

4. **Package for distribution**:
   ```bash
   npm run package
   ```

### Architecture Notes

- **Node.js 22+**: Built and tested on Node.js 22 for latest language features and performance
- **Semantic Search**: Uses TensorFlow.js Universal Sentence Encoder (tensorflow/universal-sentence-encoder@3.3.0) for 512-dimensional embeddings
- **Browser-Compatible**: Uses TensorFlow.js web backend to avoid native dependencies
- **ES Modules**: Modern module system for better compatibility
- **Vector Database**: LanceDB for efficient vector storage and similarity search
- **Dual Storage**: Separate raw data and embeddings tables for backup resilience

### Development Workflow

This project uses semantic versioning with conventional commits for automated releases.

**Branch Strategy:**
- `dev`: Development branch where features are developed and version bumps happen
- `main`: Production branch that triggers releases

**Commit Guidelines:**
Use the interactive commit tool to ensure proper formatting:
```bash
npm run commit
```

This will guide you through creating commits that follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New features (triggers minor version bump)
- `fix:` - Bug fixes (triggers patch version bump)
- `docs:` - Documentation changes
- `style:` - Code formatting, no logic changes
- `refactor:` - Code refactoring without feature changes
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks, dependency updates

**Breaking Changes:**
Add `!` after the type or add `BREAKING CHANGE:` in the footer for major version bumps:
```
feat!: change API signature
fix(api)!: remove deprecated endpoint
```

**Release Process:**

1. **Development**: Work on the `dev` branch with conventional commits
2. **Pull Request**: Open PR from `dev` to `main` (triggers build validation and package artifacts)
3. **Release**: Merge PR to `main` (triggers automatic version bump and release with built packages)

The release process:
- Automatically determines version bump based on commit types
- Generates changelog from commit messages
- Creates GitHub release with multi-platform packages (macOS, Windows, Linux)
- Tags the release appropriately

**Local Validation:**
Git hooks validate your commits locally before pushing:
```bash
# This will fail if commit message doesn't follow conventions
git commit -m "invalid commit message"

# Use the interactive tool instead
npm run commit
```

## Getting Started

### Installation

#### macOS Users
If you encounter the error **"Snippet Vault" is damaged and can't be opened**, this is due to macOS Gatekeeper restrictions on unsigned applications. To resolve this:

1. **Download the latest release** from the [GitHub Releases page](https://github.com/rolandnyamo/snippet-vault/releases)
2. **Extract the ZIP file** to your Applications folder or desired location
3. **Remove the quarantine attribute** by running this command in Terminal:
   ```bash
   xattr -d com.apple.quarantine "/path/to/Snippet Vault.app"
   ```
   Or if you placed it in Applications:
   ```bash
   xattr -d com.apple.quarantine "/Applications/Snippet Vault.app"
   ```
4. **Alternative method**: Right-click the app → "Open" → Click "Open" when prompted

This is a one-time setup required for unsigned macOS applications.

#### Windows & Linux Users
Download and run the installer from the [GitHub Releases page](https://github.com/rolandnyamo/snippet-vault/releases). No additional steps needed.

**Download Sizes:**
- macOS: ~25-35MB (x64 build, includes both search engines)
- Windows: ~30-40MB (installer, includes both search engines)  
- Linux: ~25-35MB (DEB/RPM, includes both search engines)

**Search Engine Options:**
Snippet Vault offers two search engines you can choose from in Settings:

1. **⚡ Fast Model (Built-in)**
   - Instant startup, no downloads
   - Good for basic keyword and simple semantic matching
   - Perfect for quick searches and simple queries
   - Size: < 1KB (built into the app)

2. **🧠 Smart Model (AI Download)**
   - Advanced Google Universal Sentence Encoder
   - Downloads ~20MB on first use (one-time only)
   - Best semantic understanding and context awareness
   - Handles complex queries and multi-language content

**First Launch Model Selection:**
On first launch, Snippet Vault starts with the Fast Model for instant usability. You can switch to the Smart Model anytime in Settings → "Choose Model" for enhanced search capabilities.

### First Launch

When you first launch Snippet Vault, it will automatically create a database in your system's user data directory. All of your data, including the search index and saved items, is stored locally on your computer for complete privacy.

### Adding Items

Click the **"+ New"** button to add items to your vault. You can store:

- **Links**: Save URLs with descriptions for later reference
- **Kusto Queries**: Store KQL queries with descriptions for reuse
- **Code Snippets**: Any text-based content you want to search semantically

When you save an item, Snippet Vault automatically generates a semantic embedding using the Universal Sentence Encoder. This enables intelligent search based on meaning, not just keyword matching.

### Browsing Your Items

- **Recent Tab**: Shows your 5 most recently accessed items
- **All Tab**: Displays all items with total count, sorted by creation date
- **Search Highlighting**: Matched terms are highlighted in yellow in both list and detail views

### Searching for Items

Type in the search box to perform intelligent hybrid search:

1. **Semantic Search**: Finds items with similar meaning using AI embeddings
2. **Keyword Search**: Matches exact text in descriptions and content
3. **Real-time Results**: Updates as you type with highlighted matches

### Managing Items

**View & Copy**: Click any item to view details with a copy button in the upper right corner

**Edit Items**: Click the "Edit" button in the detail view to modify descriptions or content

**Delete Items**: Hover over items in the list to see the delete (🗑️) button, or use the delete button in the edit modal

### Data Management

Access advanced features through the **Settings** button (⚙︎):

#### Export Data
- **JSON Format**: Complete structured export of all items
- **CSV Format**: Spreadsheet-compatible export for analysis
- **Automatic Download**: Files saved to your Downloads folder

#### Import Data
- **Append Mode**: Imports add to existing data without replacement
- **Format Support**: JSON and CSV file imports
- **Validation**: Ensures required fields are present before import

#### Model Information
- **Current Model**: View the embedding model in use
- **Version Tracking**: Each embedding tracks its model version
- **Test Regeneration**: Force regenerate all embeddings for testing

#### Danger Zone
- **Delete All Data**: Complete data wipe with triple confirmation
- **Backup Reminder**: Always export your data before using this option

### Model Updates & Versioning

Snippet Vault automatically handles model updates:

1. **Version Detection**: Each embedding tracks its model version
2. **Auto-Regeneration**: When opening items created with older models, embeddings are automatically updated
3. **Seamless Migration**: Raw data is preserved, only embeddings are regenerated
4. **No Data Loss**: Original content is always maintained in the backup table

## FAQ

### Where are my files stored?

Your data is stored locally in your system's user data directory:
- **macOS**: `~/Library/Application Support/snippet-vault/database/`
- **Windows**: `%APPDATA%/snippet-vault/database/`
- **Linux**: `~/.config/snippet-vault/database/`

You can see the exact path in Settings. Use "Show in Folder" to open the location in your file manager.

### What does Snippet Vault do exactly?

Snippet Vault is a smart storage and search tool for code snippets, queries, and links. It uses AI (TensorFlow.js Universal Sentence Encoder) to understand the meaning of your content, allowing you to find items by describing what you're looking for rather than remembering exact keywords.

For example, searching for "database connection" might find a snippet about "SQL server setup" because the AI understands they're semantically related.

### Does it share my data anywhere?

**Absolutely not.** Snippet Vault is designed with privacy as the top priority:

- ✅ **100% Offline**: All processing happens on your machine
- ✅ **No Network Calls**: No data is ever transmitted to external servers
- ✅ **Local AI Models**: The TensorFlow.js models run entirely in your browser
- ✅ **Local Database**: All storage is local LanceDB files on your computer
- ✅ **No Telemetry**: No usage tracking or analytics

### How does the AI search work?

Snippet Vault uses Google's Universal Sentence Encoder, a machine learning model that converts text into mathematical vectors (embeddings) that represent meaning. When you search, your query is converted to the same format and compared against stored embeddings to find semantically similar content.

### Can I backup my data?

Yes! Use the Export feature in Settings to download all your data as JSON or CSV files. The export includes all raw content and can be imported back into Snippet Vault or used with other tools.

### What happens if I delete the app?

Your data files remain in the user data directory and won't be deleted. If you reinstall Snippet Vault, it will find and use your existing data. To completely remove everything, you'd need to manually delete the database folder shown in Settings.

### Can I use this on multiple computers?

Each installation maintains its own local database. To sync data between computers, export from one machine and import to another. There's no automatic synchronization to maintain privacy and offline operation.

### What file formats can I import?

- **JSON**: Complete structured data with all fields
- **CSV**: Spreadsheet format with columns for id, type, description, payload, created_at, last_accessed_at

Required fields for import: `type`, `description`, `payload`

### How do I recover if something goes wrong?

Snippet Vault maintains dual storage:
1. **Raw Table**: Clean backup of your original content
2. **Embeddings Table**: AI-generated vectors for search

If embeddings become corrupted, they can be regenerated from the raw data without losing content. Always export your data before major operations like "Delete All Data".

### Can I add custom item types?

Currently, the UI supports "Links" and "Kusto Queries", but you can store any text content. The `type` field is flexible and you can use custom types when importing data programmatically.

## Notes

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Snippet Vault App                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)                                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   Search Bar    │ │   Item List     │ │  Detail Panel   │    │
│  │                 │ │                 │ │                 │    │
│  │ Real-time       │ │ Recent/All      │ │ View/Edit/Copy  │    │
│  │ search input    │ │ with highlights │ │ item content    │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│           │                    │                    │            │
│           └────────────────────┼────────────────────┘            │
│                                │                                 │
├────────────────────────────────┼─────────────────────────────────┤
│  Main Process (Electron)       │                                 │
│  ┌─────────────────────────────▼─────────────────────────────┐   │
│  │                Store (store.js)                          │   │
│  │  ┌─────────────────┐ ┌─────────────────┐                │   │
│  │  │  Search Logic   │ │  Data Manager   │                │   │
│  │  │                 │ │                 │                │   │
│  │  │ • Semantic      │ │ • CRUD ops      │                │   │
│  │  │ • Keyword       │ │ • Export/Import │                │   │
│  │  │ • Hybrid match  │ │ • Validation    │                │   │
│  │  └─────────────────┘ └─────────────────┘                │   │
│  └─────────────────────────────┬─────────────────────────────┘   │
│                                │                                 │
├────────────────────────────────┼─────────────────────────────────┤
│  AI Processing Layer           │                                 │
│  ┌─────────────────────────────▼─────────────────────────────┐   │
│  │            TensorFlow.js Engine                           │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │        Universal Sentence Encoder                   │  │   │
│  │  │        (tensorflow/universal-sentence-encoder)      │  │   │
│  │  │                                                     │  │   │
│  │  │  Text Input → 512-dimensional vector embeddings    │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────┬─────────────────────────────┘   │
│                                │                                 │
├────────────────────────────────┼─────────────────────────────────┤
│  Data Storage Layer            │                                 │
│  ┌─────────────────────────────▼─────────────────────────────┐   │
│  │                   LanceDB                                 │   │
│  │  ┌─────────────────────┐ ┌─────────────────────────────┐  │   │
│  │  │    Raw Data Table   │ │    Embeddings Table         │  │   │
│  │  │                     │ │                             │  │   │
│  │  │ • ID                │ │ • ID                        │  │   │
│  │  │ • Type              │ │ • Vector (512 dimensions)   │  │   │
│  │  │ • Description       │ │ • Model Version             │  │   │
│  │  │ • Payload           │ │ • Timestamps                │  │   │
│  │  │ • Timestamps        │ │                             │  │   │
│  │  └─────────────────────┘ └─────────────────────────────┘  │   │
│  └─────────────────────────────┬─────────────────────────────┘   │
│                                │                                 │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                    Local File System                             │
│                                                                  │
│  macOS: ~/Library/Application Support/snippet-vault/database/   │
│  Windows: %APPDATA%/snippet-vault/database/                     │
│  Linux: ~/.config/snippet-vault/database/                       │
│                                                                  │
│  • snippet_vault.lance/ (vector database files)                 │
│  • Model cache (TensorFlow.js model files)                      │
└──────────────────────────────────────────────────────────────────┘

Build Architecture:
• macOS: x64 native build (no universal binary for compatibility)
• Windows: x64 build with MSI installer
• Linux: x64 build with DEB/RPM packages

Data Flow:
1. User inputs search query or adds new item
2. Frontend sends request to Main Process store
3. For new items: Text is processed by current embedding model to generate embeddings
4. Data stored in both Raw Data and Embeddings tables in LanceDB
5. For searches: Query is embedded using current model and compared against stored vectors
6. Results ranked by semantic similarity + keyword matching
7. UI updates with highlighted results in real-time

Dual Embedding Architecture:
• Fast Model: Built-in TF-IDF style embeddings for instant startup
• Smart Model: TensorFlow.js Universal Sentence Encoder for advanced AI search
• Runtime Selection: Users choose model type in Settings with instant switching
• Dynamic Loading: TensorFlow model downloads only when selected (~20MB)
• Preference Persistence: Model choice saved locally and restored on restart

Privacy & Offline Design:
• All processing happens locally - no network calls
• Both models run entirely offline for maximum privacy
• LanceDB provides efficient vector search without external services
• Dual-table architecture ensures data recovery if embeddings corrupted
```

## License

MIT License - see LICENSE file for details.