# Snippet Vault – Product Requirements

_A lightweight, entirely‑offline desktop utility for storing and semantically searching Kusto queries, URLs, and (later) other artifacts._

---

## 1 · Core Entities

| Entity | Mandatory Fields | Notes |
|--------|-----------------|-------|
| **Item** | • `id` (UUID)  <br>• `type` (`link` \| `kusto_query`) <br>• `payload` (URL string **or** KQL text) <br>• `description` (free text) <br>• `created_at` (ISO timestamp) <br>• `last_accessed_at` (ISO timestamp) <br>• `embedding_model` (name + version) | Future types (e.g., screenshots) can be added without schema rewrite. |
| **Config** | • `storage_path` (absolute path chosen by user) | Saved in a small JSON/INI file outside the vector DB. |

---

## 2 · Critical User Flows

1. **First Launch**  
   - Prompt for a local folder (`storage_path`).  
   - Initialize LanceDB files in that folder.

2. **Add Item**  
   1. User chooses **New → link / kusto_query**.  
   2. Fields shown: *payload*, *description*.  
   3. On save:  
      - Embed `payload + description` via Xenova WASM model.  
      - Insert record into LanceDB; persist `embedding_model`.  
      - Set both `created_at` and `last_accessed_at` to now.  

3. **Search / Recall**  
   - Single search box.  
   - As user types, perform **vector + keyword** search; update list in ≤ 200 ms.  
   - Selecting an item copies/opens payload and updates `last_accessed_at`.

---

## 3 · UI Specification (MVP)

```text
┌─────────────────────────────────────────────────────────────┐
│  Snippet Vault (no branding yet)                      │
├─────────────────────────────────────────────────────────────┤
│  Recent Items  (last 5 added OR accessed, newest first)     │
│  ─────────────────────────────────────────────────────────  │
│  • [KQL] Investigations from ServiceNow        2 h ago      │
│    Preview: SecurityIncident | where Title …                │
│  • [URL]  Azure Health Dashboard             yesterday      │
│    Preview: https://status.azure.com …                      │
│  …                                                         │
├─────────────────────────────────────────────────────────────┤
│  ▹ Search or add…  _____________________________________   │
└─────────────────────────────────────────────────────────────┘
```

*Behaviour*  
- **Recent Items Pane**: Always shows the five most‑recently *accessed* or *added* items.  
- **Search/Add Input**:  
  - Typing triggers live search.  
  - Pressing **Enter** on an empty query opens the “Add Item” dialog.  

_No additional branding, theming, or window chrome customization in MVP._

---

## 4 · Functional Requirements

| ID | Requirement |
|----|-------------|
| **F‑1** | Runs 100 % offline; no external API calls. |
| **F‑2** | Supports item types `link`, `kusto_query` only (MVP). |
| **F‑3** | Embeds `payload + description`; stores vector in LanceDB. |
| **F‑4** | Persists `embedding_model` per item; old items remain searchable after model upgrades. |
| **F‑5** | Combines vector similarity **and** exact keyword search. |
| **F‑6** | Search results update in ≤ 200 ms on typical hardware. |
| **F‑7** | User can change `storage_path`; app migrates DB safely. |
| **F‑8** | All data lives under `storage_path`; no leaks elsewhere. |
| **F‑9** | Default view shows **last 5 items** ordered by `last_accessed_at` desc. |

---

## 5 · Non‑Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Insert ≤ 500 ms for 1 KB KQL; search top‑10 ≤ 200 ms. |
| **Portability** | Single installer per OS (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`). |
| **Security** | No telemetry; recommend code‑signing for production. |
| **Reliability** | Detect/mend moved or corrupted DB with clear prompts. |
| **Extensibility** | Adding new item types must not break existing DB schema. |

---

## 6 · Technical Stack Constraints

| Layer | Choice |
|-------|--------|
| UI/Runtime | Electron + React (or minimal vanilla JS) |
| Vector DB | **LanceDB** (local, Parquet + DuckDB) |
| Embeddings | `@xenova/transformers` WASM model (ships with app) |
| Packaging | `electron-builder` targets: NSIS (.exe), DMG, AppImage |

---

## 7 · Optional Enhancements (Defer)

1. **Tags** for manual grouping.  
2. **Auto‑detect type** on paste (URL regex, KQL keywords).  
3. **Import/Export** JSON.  
4. **Dark mode** toggle.

---
