# Kusto Snippet Vault – Product & UX Requirements

_A lightweight, entirely‑offline desktop utility for storing and semantically searching Kusto queries, URLs, and (later) other artifacts._

---

## 1 · Core Entities

| Entity | Mandatory Fields | Notes |
|--------|-----------------|-------|
| **Item** | • `id` (UUID)  <br>• `type` (`link` \| `kusto_query`) <br>• `payload` (URL string **or** KQL text) <br>• `description` (free text) <br>• `created_at` (ISO timestamp) <br>• `last_accessed_at` (ISO timestamp) <br>• `embedding_model` (name + version) | Future types (e.g., screenshots) can be added without schema rewrite. |
| **Config** | • `storage_path` (absolute path chosen by user) | Stored in a small JSON/INI file outside the vector DB. |

---

## 2 · Critical User Flows

1. **First Launch**  
   - Prompt for a local folder (`storage_path`).  
   - Initialize LanceDB files in that folder.

2. **Add Item**  
   1. User chooses **+ New** (or keyboard shortcut).  
   2. Form fields: *Type*, *Description*, *Payload*.  
   3. On save:  
      - Embed `payload + description` via Xenova WASM model.  
      - Insert record into LanceDB; persist `embedding_model`.  
      - Set `created_at` and `last_accessed_at` to now.

3. **Search / Recall**  
   - Single search box.  
   - As user types, perform **vector + keyword** search; update list ≤ 200 ms.  
   - Selecting an item opens a **detail panel**; copy or edit from there.

4. **Edit Item**  
   - Opens same modal as Add, pre‑filled.  
   - Payload textarea auto‑grows until 40 % of window height.

---

## 3 · Functional Requirements (F)

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
| **F‑9** | Default view shows **last 5 items** ordered by `last_accessed_at` desc. |

---

## 4 · Non‑Functional Requirements (NF)

| Category | Requirement |
|----------|-------------|
| **NF‑Perf** | Insert ≤ 500 ms for 1 KB KQL; search top‑10 ≤ 200 ms. |
| **NF‑Portability** | Single installer per OS (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`). |
| **NF‑Security** | No telemetry; recommend code‑signing for production. |
| **NF‑Reliability** | Detect/mend moved or corrupted DB with clear prompts. |
| **NF‑Extensibility** | Adding new item types must not break existing DB schema. |

---

## 5 · Technical Stack Constraints

| Layer | Choice |
|-------|--------|
| UI/Runtime | Electron + React (TypeScript) |
| Vector DB | **LanceDB** (local Parquet/DuckDB) |
| Embeddings | `@xenova/transformers` WASM model (ships with app) |
| Packaging | `electron-builder` targets: NSIS (.exe), DMG, AppImage |

---

## 6 · ASCII Wireframes & Interaction Notes

### 6.1 List View (Default – “Recent” tab)

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Recent │ All │ + New │ ⚙︎                                            │
├────────────────────────────────────────────────────────────────────────┤
│  🔍 Search… _______________________________________________________    │
│                                                                        │
│  • [KQL] Investigations from ServiceNow                  2 h ago ▸     │
│    SecurityIncident | where Title has "ServiceNow" …                  │
│                                                                        │
│  • [URL] Azure Health Dashboard                         Yesterday ▸    │
│    https://status.azure.com …                                         │
│                                                                        │
│  • [KQL] Daily ingestion breakdown                       3 d ago ▸     │
│    Logs | summarize count() by bin(_Time, 1h) …                       │
│                                                                        │
│  • [URL] Internal RFC (Kusto best‑practices)              1 w ago ▸     │
│    https://contoso.sharepoint.com/…                                      │
└────────────────────────────────────────────────────────────────────────┘
```

*Typing in the search bar filters this list live.*

---

### 6.2 Search Results State

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Recent │ All │ + New │ ⚙︎                                            │
├────────────────────────────────────────────────────────────────────────┤
│  🔍 investigations ______________________________________________ ✕    │
│                                                                        │
│  • [KQL] Investigations from ServiceNow                  2 h ago ▸     │
│    (vector score 92 %)                                                 │
│                                                                        │
│  • [KQL] High‑severity Investigations last 7 d             5 d ago ▸     │
│    (vector score 81 %)                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 6.3 Selected Item View (Split Panel)

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Recent │ All │ + New │ ⚙︎                                            │
├────────────────────────────────────────────────────────────────────────┤
│  [Left: List]                                   │ [Right: Detail]      │
│  • Investigations from SN   2 h ago ▸           │                      │
│                                                │  Investigations from  │
│  • Azure Health Dashboard  Yesterday ▸         │  ServiceNow          │
│                                                │  Type: KQL           │
│  …                                            │  Added: Aug 6         │
│                                                │  Last used: 2 h ago   │
│                                                │                      │
│                                                │  ╔══════════════════╗ │
│                                                │  ║ SecurityIncident │ │
│                                                │  ║ | where Title…   │ │
│                                                │  ║ | summarize…     │ │
│                                                │  ╚══════════════════╝ │
│                                                │                      │
│                                                │  [ Copy ] [ Edit ]   │
└────────────────────────────────────────────────────────────────────────┘
```

*`Copy` places the payload on clipboard. `Edit` opens the modal.*

---

### 6.4 Add / Edit Item Modal

```text
┌────────────────────────── Add / Edit Item ─────────────────────────┐
│  Type:   (•) Link   ( ) Kusto Query                                 │
│                                                                     │
│  Description:  _________________________________________________    │
│                                                                     │
│  Payload (URL or KQL):                                              │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ (auto‑grows with content up to 40 % of window height)        │    │
│  │                                                              │    │
│  │ ↲                                                            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                     │
│                                     [ Cancel ]   [ Save ]           │
└─────────────────────────────────────────────────────────────────────┘
```

**Auto‑growing text area logic**

```ts
const ref = useAutosize<HTMLTextAreaElement>(); // grows ≤ 40 % viewport
```

---

## 7 · Component Map (for React)

| Component | Purpose |
|-----------|---------|
| `AppShell` | Tab bar routing & layout grid |
| `SearchBar` | Input + clear button |
| `ItemList / ItemRow` | Renders recent or filtered items |
| `DetailPanel` | Shows selected item + copy/edit/delete |
| `ItemModal` | Re‑usable for Add **and** Edit |
| `useAutosize` | Custom hook for textarea growth |

---

## 8 · Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + F` | Focus search bar |
| `Ctrl/Cmd + N` | Open Add Item modal |
| `Shift + Enter` (in search bar) | Add Item modal |
| `Enter` (on list row) | Copy payload |
| `↑ / ↓` | Navigate list |

---

## 9 · Optional Enhancements (Defer)

- Tagging & filter chips  
- Drag‑and‑drop URL insertion  
- Dark / Light theme toggle  

---

> **Deliverable for coding agent:** Start with this document; scaffold Electron + React project, implement components in the order listed, wire data layer with LanceDB, and satisfy all Functional (F) and Non‑Functional (NF) requirements above.
