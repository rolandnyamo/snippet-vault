import React, { useMemo, useState } from 'react';
import { Item } from '../types';

interface DetailPanelProps {
  item: Item;
  onEdit: (item: Item) => void;
  onCopy: (item: Item) => void;
  onDelete: (itemId: string) => void;
  searchQuery?: string;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ item, onEdit, onCopy, onDelete, searchQuery }) => {
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showUrlCopySuccess, setShowUrlCopySuccess] = useState(false);
  
  // Electron shell is available because nodeIntegration is true in webPreferences
  let shell: any | undefined;
  try {
    // @ts-ignore - window.require is available in Electron renderer with nodeIntegration
    shell = window.require?.('electron')?.shell;
  } catch {}

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'kusto_query': return 'Kusto Query';
      case 'link': return 'Link';
      default: return type;
    }
  };

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query || !text) return text;
    
    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return <mark key={index} className="search-highlight">{part}</mark>;
      }
      return part;
    });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const itemTime = new Date(timestamp);
    const diffMs = now.getTime() - itemTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} d ago`;
    return `${Math.floor(diffDays / 7)} w ago`;
  };

  const handleCopy = () => {
    onCopy(item);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 1500);
  };

  const copyText = async (text: string, kind: 'query' | 'url' = 'query') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback to Electron clipboard if available
        // @ts-ignore
        const electronClipboard = window.require?.('electron')?.clipboard;
        electronClipboard?.writeText?.(text);
      }
      if (kind === 'url') {
        setShowUrlCopySuccess(true);
        setTimeout(() => setShowUrlCopySuccess(false), 1500);
      } else {
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 1500);
      }
    } catch (e) {
      console.error('Failed to copy text:', e);
    }
  };

  // Heuristically parse Kusto payloads that include a URL on the first non-empty line
  const parsed = useMemo(() => {
    const res: { url?: string; query?: string } = {};
    if (!item?.payload) return res;
    const raw = item.payload.trim();
    const lines = raw.split(/\r?\n/);
    // find first non-empty line
    const firstContentIdx = lines.findIndex(l => l.trim().length > 0);
    if (firstContentIdx >= 0) {
      const firstLine = lines[firstContentIdx].trim();
      const looksLikeUrl = /^https?:\/\//i.test(firstLine);
      if (looksLikeUrl) {
        res.url = firstLine;
        // query is everything after the first non-empty line
        const rest = lines.slice(firstContentIdx + 1).join('\n').trim();
        if (rest.length > 0) res.query = rest;
      }
    }
    // If no explicit URL detected, treat whole payload as query text
    if (!res.query) {
      res.query = item.payload;
    }
    return res;
  }, [item]);

  const isKustoQuery = item.type === 'kusto_query';
  const isLink = item.type === 'link';
  const hasUrl = Boolean(parsed.url || (isLink && item.payload));
  const effectiveUrl = parsed.url || (isLink ? item.payload : undefined);
  const isAdxUrl = effectiveUrl ? /dataexplorer\.azure\.com/i.test(effectiveUrl) : false;

  // Extract cluster and database from ADX URL if present
  const kustoMeta = useMemo(() => {
    if (!isKustoQuery || !effectiveUrl) return {} as { cluster?: string; database?: string };
    try {
      const url = new URL(effectiveUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      const clusterIdx = parts.findIndex(p => p.toLowerCase() === 'clusters');
      const databaseIdx = parts.findIndex(p => p.toLowerCase() === 'databases');
      const cluster = clusterIdx >= 0 && parts[clusterIdx + 1] ? parts[clusterIdx + 1] : undefined;
      const database = databaseIdx >= 0 && parts[databaseIdx + 1] ? parts[databaseIdx + 1] : undefined;
      return { cluster, database };
    } catch {
      return {} as { cluster?: string; database?: string };
    }
  }, [isKustoQuery, effectiveUrl]);

  const handleOpenExternal = (url?: string) => {
    if (!url) return;
    try {
      if (shell?.openExternal) {
        shell.openExternal(url);
      } else {
        // Fallback: open via window
        window.open(url, '_blank', 'noopener');
      }
    } catch (e) {
      console.error('Failed to open external URL:', e);
    }
  };

  const handleEdit = () => {
    onEdit(item);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${item.description}"?`)) {
      onDelete(item.id);
    }
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h3 className="detail-title">
          {searchQuery ? highlightText(item.description, searchQuery) : item.description}
        </h3>
        <div className="detail-meta">
          <div className="meta-row">
            <span className="meta-label">Type:</span>
            <span className="meta-value">{getTypeLabel(item.type)}</span>
          </div>
          {/* Link: show full URL field with copy control */}
          {isLink && hasUrl && (
            <div className="meta-row">
              <span className="meta-label">Full URL:</span>
              <span className="meta-value" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <input
                  type="text"
                  value={effectiveUrl}
                  disabled
                  className="readonly-input"
                  style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  readOnly
                />
                <button 
                  className="action-button secondary" 
                  onClick={() => effectiveUrl && copyText(effectiveUrl, 'url')}
                  style={{ flexShrink: 0 }}
                >
                  {showUrlCopySuccess ? 'Copied!' : 'Copy'}
                </button>
              </span>
            </div>
          )}
          <div className="meta-row">
            <span className="meta-label">Added:</span>
            <span className="meta-value">{formatDate(item.created_at)}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Last used:</span>
            <span className="meta-value">{formatTimeAgo(item.last_accessed_at)}</span>
          </div>
          {/* Kusto query: show cluster/database if we can parse them */}
          {isKustoQuery && hasUrl && (kustoMeta.cluster || kustoMeta.database) && (
            <>
              {kustoMeta.cluster && (
                <div className="meta-row">
                  <span className="meta-label">Cluster:</span>
                  <span className="meta-value">{kustoMeta.cluster}</span>
                </div>
              )}
              {kustoMeta.database && (
                <div className="meta-row">
                  <span className="meta-label">Database:</span>
                  <span className="meta-value">{kustoMeta.database}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="detail-content">
        <div className="edit-section" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <button 
            className="action-button secondary" 
            onClick={handleEdit}
          >
            Edit
          </button>
          <button 
            className="action-button danger" 
            onClick={handleDelete}
            style={{ marginLeft: '8px' }}
          >
            Delete
          </button>
          {/* Contextual actions for links and queries */}
          {isKustoQuery && (
            <>
              {hasUrl && (
                <>
                  <button className="action-button" onClick={() => handleOpenExternal(effectiveUrl)} title={'Open in Web'}>
                    Open in Web
                  </button>
                </>
              )}
              {hasUrl && (
                <button className="action-button secondary" onClick={() => effectiveUrl && copyText(effectiveUrl, 'url')}>
                  {showUrlCopySuccess ? 'URL Copied!' : 'Copy URL'}
                </button>
              )}
            </>
          )}
          {isLink && (
            <>
              <button className="action-button" onClick={() => handleOpenExternal(effectiveUrl)} title="Open">
                Open
              </button>
            </>
          )}
        </div>
        
        <div className="payload-container">
          <div className="payload-header">
            {/* Context-aware copy button in header for quick access */}
            {isKustoQuery ? (
              <button 
                className={`copy-icon-button ${showCopySuccess ? 'success' : ''}`}
                onClick={() => parsed.query && copyText(parsed.query, 'query')}
                title={showCopySuccess ? 'Copied!' : 'Copy query to clipboard'}
              >
                {showCopySuccess ? 'Copied!' : 'Copy Query'}
              </button>
            ) : isLink ? (
              // For links, we no longer show copy in the payload header; copy is near the Full URL field
              <></>
            ) : (
              <button 
                className={`copy-icon-button ${showCopySuccess ? 'success' : ''}`}
                onClick={handleCopy}
                title={showCopySuccess ? 'Copied!' : 'Copy to clipboard'}
              >
                {showCopySuccess ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          {/* Render a clean query box for Kusto queries. For links, omit raw long URL text */}
          {isKustoQuery ? (
            <pre className="payload-text">
              {searchQuery ? highlightText(parsed.query || '', searchQuery) : (parsed.query || '')}
            </pre>
          ) : isLink ? (
            <div className="payload-text" style={{ whiteSpace: 'normal' }}>
              <span style={{ color: '#666' }}>This item is a link. Use the Open button or copy from the Full URL field above.</span>
            </div>
          ) : (
            <pre className="payload-text">
              {searchQuery ? highlightText(item.payload, searchQuery) : item.payload}
            </pre>
          )}
        </div>
      </div>

    </div>
  );
};

export default DetailPanel;
