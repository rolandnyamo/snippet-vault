# Snippet Vault

A lightweight, entirely-offline desktop utility for storing and semantically searching Kusto queries, URLs, and other code snippets. Built with Electron, React, and TensorFlow.js for privacy-focused, intelligent search capabilities.

## Features

- 🔍 **Dual Search Engine**: Choose between Fast (built-in TF-IDF) or Smart (AI Universal Sentence Encoder) models
- ⚡ **Instant Startup**: Fast model provides immediate functionality, Smart model downloads on-demand (~20MB)
- 🔒 **100% Offline**: No data ever leaves your machine - all processing happens locally
- 🧠 **Model Selection**: Runtime switching between search engines with preference persistence
- 📁 **Smart Organization**: Recent and All views with real-time item count display
- ✏️ **Full CRUD Operations**: Add, edit, delete individual items with confirmation dialogs
- 🗑️ **Safe Data Management**: Custom confirmation modals for destructive operations
- 📤 **Advanced Import/Export**: JSON/CSV support with real-time progress tracking
- 📋 **Copy Functionality**: One-click copying of file paths and item content
- 🔄 **Intelligent Model Versioning**: Automatic embedding regeneration with corruption recovery
- 💾 **Robust Architecture**: Dual-table design preserves raw data separately from embeddings
- 🎯 **Enhanced Search**: Real-time highlighting, hybrid semantic + keyword matching
- 🚨 **Error Recovery**: Database corruption detection with automatic rebuilding

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
- **Dual Embedding System**: Fast model (built-in TF-IDF 256-dim) + Smart model (TensorFlow.js Universal Sentence Encoder 512-dim)
- **Runtime Model Selection**: Users choose search engine on first launch or anytime in Settings
- **Dynamic Downloads**: TensorFlow model downloads only when selected (~20MB one-time download)
- **Browser-Compatible**: TensorFlow.js web backend avoids native dependencies
- **Modern Modules**: ES modules throughout for better compatibility and tree-shaking
- **Vector Database**: LanceDB for efficient vector storage and similarity search
- **Nuclear Rebuild System**: Complete database reconstruction with corruption recovery
- **Enhanced IPC**: Comprehensive error handling and progress tracking for all operations

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
Snippet Vault offers two search engines you can choose from:

1. **⚡ Fast Model (Built-in, Default)**
   - **Instant startup**: No downloads, immediately available
   - **Lightweight**: Built-in TF-IDF algorithm with 256-dimensional embeddings
   - **Good performance**: Effective keyword and basic semantic matching
   - **Perfect for**: Quick searches, simple queries, immediate productivity
   - **Size**: < 1KB (built into the app)

2. **🧠 Smart Model (AI-Powered)**
   - **Advanced AI**: Google's Universal Sentence Encoder
   - **One-time download**: ~20MB download on first selection
   - **Superior understanding**: 512-dimensional embeddings with deep semantic comprehension
   - **Best for**: Complex queries, multi-language content, nuanced search
   - **Context awareness**: Understands relationships and meaning beyond keywords

**Model Selection:**
- **First Launch**: Starts with Fast Model for instant usability
- **Runtime Switching**: Change models anytime in Settings → "Choose Model"
- **Preference Persistence**: Your choice is remembered across app restarts
- **Progressive Enhancement**: Start fast, upgrade to smart when needed

**Dynamic Model Loading:**
- Smart model downloads automatically when first selected
- Progress tracking shows download status in real-time
- Once downloaded, switching between models is instant
- Downloaded models are cached locally for offline use

### First Launch & Model Selection

When you first launch Snippet Vault, you'll see a model selection screen:

1. **Choose Your Search Engine**: Select between Fast (instant) or Smart (AI-powered) models
2. **Automatic Setup**: Your choice determines the initial search capabilities
3. **No Lock-in**: You can change models anytime later in Settings
4. **Smart Downloads**: If you choose Smart model, it downloads automatically with progress tracking

The app then creates a database in your system's user data directory, ensuring all data stays local.

### Adding Items

Click the **"+ New"** button or use the **"Smart Add"** feature to add items:

- **Links**: Save URLs with descriptions for later reference
- **Kusto Queries**: Store KQL queries with descriptions for reuse  
- **Code Snippets**: Any text-based content you want to search
- **Smart Add**: AI-powered categorization automatically detects item type and suggests descriptions

When you save an item, Snippet Vault generates embeddings using your selected model (Fast or Smart). This enables intelligent search based on meaning and context.

### Browsing Your Items

- **Recent Tab**: Shows your 5 most recently accessed items with timestamps
- **All Tab**: Displays all items with live count updates, sorted by creation date
- **Real-time Updates**: Counts and listings update immediately after any changes
- **Search Highlighting**: Matched terms are highlighted in yellow in both list and detail views
- **Smart Navigation**: Recently accessed items automatically move to top of Recent tab

### Searching for Items

Type in the search box to perform intelligent hybrid search:

1. **Semantic Search**: Finds items with similar meaning using AI embeddings
2. **Keyword Search**: Matches exact text in descriptions and content
3. **Real-time Results**: Updates as you type with highlighted matches

### Managing Items

**View & Copy**: Click any item to view details with copy buttons for both content and file paths

**Edit Items**: Click the "Edit" button in the detail view to modify descriptions or content with auto-save

**Delete Items**: 
- Hover over items in the list to see the delete (🗑️) button
- Use the delete button in the detail view for individual items  
- Professional confirmation dialogs prevent accidental deletions

### Data Management

Access advanced features through the **Settings** button (⚙︎):

#### Export Data
- **JSON Format**: Complete structured export of all items with metadata
- **CSV Format**: Spreadsheet-compatible export for analysis and external tools
- **Automatic Download**: Files saved to your Downloads folder with timestamps

#### Import Data
- **Progressive Import**: Real-time progress tracking with item count and percentage
- **Append Mode**: Imports add to existing data without replacement
- **Format Support**: JSON and CSV file imports with validation
- **Error Recovery**: Detailed error messages for invalid data with line numbers
- **Post-Import Updates**: Item counts refresh automatically after successful import

#### Model Management
- **Current Model Display**: Shows active search engine (Fast/Smart) with details
- **Runtime Switching**: Change between Fast and Smart models instantly
- **Download Management**: Smart model downloads with progress tracking
- **Version Tracking**: Each embedding tracks its model version for consistency
- **Performance Testing**: Test current model performance with sample queries

#### Advanced Operations
- **Regenerate Embeddings**: Force regenerate all embeddings with current model
- **Database Reset**: Complete database reconstruction ("Nuclear Rebuild")
- **Corruption Recovery**: Automatic detection and recovery from database corruption
- **Path Management**: View and access database location with "Show in Folder"

#### Danger Zone
- **Delete All Data**: Complete data wipe requiring "delete" text confirmation
- **Custom Confirmation**: Professional modal dialogs replace browser prompts
- **Triple Safety**: Multiple confirmations prevent accidental data loss
- **Backup Reminders**: Clear warnings to export data before destructive operations

### Model Updates & Versioning

Snippet Vault's dual embedding architecture handles model updates intelligently:

#### Automatic Model Management
1. **Version Detection**: Each embedding tracks its model version and type (Fast/Smart)
2. **Smart Migration**: When switching models, embeddings regenerate automatically in background
3. **Seamless Updates**: Model updates trigger automatic re-embedding with progress tracking
4. **Zero Data Loss**: Raw data is always preserved during model transitions

#### Model Switching Workflow
1. **Runtime Selection**: Choose Fast or Smart model anytime in Settings
2. **Progress Tracking**: Visual progress bars for model downloads and embedding generation
3. **Background Processing**: Embeddings regenerate while you continue working
4. **Instant Availability**: Switch models immediately, optimization happens in background

#### Corruption Recovery
- **Auto-Detection**: Identifies corrupted embeddings and missing model data
- **Nuclear Rebuild**: Complete database reconstruction from raw data when needed
- **Recovery Logging**: Detailed recovery process tracking for transparency
- **Data Integrity**: Dual-table architecture ensures raw data survival through any corruption

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

### How does the dual search system work?

Snippet Vault offers two complementary search approaches:

**Fast Model (TF-IDF):**
- Built-in algorithm similar to traditional search engines
- Creates 256-dimensional vectors from term frequency analysis
- Excellent for exact matches and keyword-based searches
- Instant startup with no downloads required

**Smart Model (Universal Sentence Encoder):**
- Google's advanced neural network model for understanding text meaning
- Generates 512-dimensional embeddings that capture semantic relationships
- Finds content based on meaning, not just keywords
- Example: Searching "database connection" finds "SQL server setup" because they're semantically related

Both models run completely offline for maximum privacy. You can switch between them anytime based on your needs.

### Can I backup my data?

Yes! Use the Export feature in Settings to download all your data as JSON or CSV files. The export includes all raw content and can be imported back into Snippet Vault or used with other tools.

### What happens if I delete the app?

Your data files remain in the user data directory and won't be deleted. If you reinstall Snippet Vault, it will find and use your existing data. To completely remove everything, you'd need to manually delete the database folder shown in Settings.

### Can I use this on multiple computers?

Each installation maintains its own local database. To sync data between computers:

1. **Export**: Use Settings → Export Data to create a backup file
2. **Transfer**: Move the JSON/CSV file to your other computer
3. **Import**: Use Settings → Import Data with real-time progress tracking
4. **Model Sync**: Choose the same search model on both computers for consistency

There's no automatic synchronization to maintain privacy and offline operation, but the import/export process is streamlined with progress feedback.

### What file formats can I import?

- **JSON**: Complete structured data with all fields
- **CSV**: Spreadsheet format with columns for id, type, description, payload, created_at, last_accessed_at

Required fields for import: `type`, `description`, `payload`

### How do I recover if something goes wrong?

Snippet Vault has multiple recovery mechanisms:

**Database Corruption:**
- **Auto-Detection**: Identifies corruption issues automatically
- **Nuclear Rebuild**: Complete database reconstruction from raw data
- **Progress Tracking**: Visual feedback during recovery process
- **Zero Data Loss**: Raw content always preserved in backup table

**Model Issues:**
- **Model Switching**: Try switching between Fast and Smart models
- **Re-download**: Smart model can be re-downloaded if corrupted
- **Embedding Regeneration**: Force regenerate all embeddings from Settings

**Data Recovery:**
- **Export First**: Always export your data before major operations
- **Dual Storage**: Raw data and embeddings stored separately for redundancy
- **Import Recovery**: Restore from previous exports with progress tracking

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
• Fast Model: Built-in TF-IDF style embeddings for instant startup (256-dimensional)
• Smart Model: TensorFlow.js Universal Sentence Encoder for advanced AI search (512-dimensional)
• Runtime Selection: Users choose model type in Settings with instant switching
• Dynamic Loading: TensorFlow model downloads only when selected (~20MB one-time)
• Preference Persistence: Model choice saved locally and restored on restart
• Background Optimization: Embedding generation happens while you continue working

Enhanced Data Management:
• Progressive Import: Real-time progress tracking for large data imports
• Custom Confirmations: Professional modal dialogs for all destructive operations
• Copy Functionality: File path and content copying with one-click access
• Auto-Save: Changes saved immediately with visual feedback
• Error Recovery: Database corruption detection with nuclear rebuild capability

Privacy & Offline Design:
• All processing happens locally - no network calls except for optional model downloads
• Both models run entirely offline after initial setup for maximum privacy
• LanceDB provides efficient vector search without external services
• Dual-table architecture ensures data recovery if embeddings corrupted
• Model downloads cached locally for complete offline operation
```

## License

MIT License - see LICENSE file for details.