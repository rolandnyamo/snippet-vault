# Zip Export/Import Testing Guide

## What's Been Implemented

1. **Updated Export Functionality:**
   - `exportData()` now only creates ZIP files containing:
     - `data.json` with all item data (image paths are converted to relative paths)
     - `images/` folder containing all image files
   - Removed CSV and standalone JSON export options

2. **Updated Import Functionality:**
   - `importData()` now supports:
     - ZIP files (primary format) - automatically extracts images and restores them
     - Legacy JSON/CSV files (backward compatibility)
   - Smart format detection for legacy files
   - Image files are extracted to the app's images directory

3. **Updated UI (SettingsModal):**
   - Export section now shows single "Export as ZIP" button
   - Import section accepts .zip, .json, and .csv files
   - Updated descriptions to reflect new functionality

## Testing Steps

1. **Add some image items:**
   - Use drag-and-drop or copy-paste to add image files
   - Add some text-based items (links, Kusto queries, prompts)

2. **Export data:**
   - Open Settings
   - Click "Export as ZIP"
   - Verify a .zip file is downloaded

3. **Inspect the ZIP:**
   - Extract the ZIP file
   - Should contain:
     - `data.json` with all items (image items have relative paths like `images/filename.jpg`)
     - `images/` folder with all image files

4. **Test import:**
   - Delete some items or use a fresh installation
   - Import the ZIP file
   - Verify all items are restored including images

5. **Test legacy import:**
   - Try importing old JSON/CSV files
   - Should work as before (backward compatibility)

## Key Changes Made

- `src/store/items.js`: Complete rewrite of export/import functions
- `src/index.js`: Updated IPC handlers for new signatures
- `src/components/SettingsModal.tsx`: Updated UI and handlers
- Added `adm-zip` dependency for ZIP file handling
- Image embeddings now only use descriptions (not file paths)
