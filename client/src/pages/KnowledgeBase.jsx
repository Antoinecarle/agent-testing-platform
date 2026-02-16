import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, X, Check,
  Database, FileText, Globe, Upload, Brain,
  AlertCircle, Users, ArrowLeft, Link2, Unlink,
  BookOpen, ChevronRight, Sparkles, Type, File
} from 'lucide-react';
import { api, getToken, getUser } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  cyan: '#06b6d4', cyanM: 'rgba(6,182,212,0.15)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const inputStyle = {
  width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
  borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color 0.2s ease',
};

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const { id: kbId } = useParams();
  const user = getUser();

  // List view state
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Detail view state
  const [activeKB, setActiveKB] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isLinkAgentOpen, setIsLinkAgentOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUrlOpen, setIsUrlOpen] = useState(false);
  const [isCsvOpen, setIsCsvOpen] = useState(false);

  // Form state
  const [kbForm, setKbForm] = useState({ name: '', description: '' });
  const [entryForm, setEntryForm] = useState({ title: '', content: '' });
  const [urlForm, setUrlForm] = useState({ url: '', title: '' });
  const [saving, setSaving] = useState(false);
  const [editingKB, setEditingKB] = useState(null);

  // Agent linking
  const [agents, setAgents] = useState([]);
  const [linkedAgents, setLinkedAgents] = useState([]);
  const [agentSearch, setAgentSearch] = useState('');

  // Semantic search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Entry detail
  const [viewEntry, setViewEntry] = useState(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ---- Data loading ----
  const fetchKBs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/api/knowledge');
      setKnowledgeBases(data.knowledgeBases || []);
    } catch (err) {
      setError('Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKBs(); }, [fetchKBs]);

  useEffect(() => {
    if (kbId) {
      loadKBDetail(kbId);
    } else {
      setActiveKB(null);
      setEntries([]);
    }
  }, [kbId]);

  const loadKBDetail = async (id) => {
    try {
      setEntriesLoading(true);
      const [kbData, entriesData] = await Promise.all([
        api(`/api/knowledge/${id}`),
        api(`/api/knowledge/${id}/entries?limit=100`),
      ]);
      setActiveKB(kbData);
      setEntries(entriesData.entries || []);
      setLinkedAgents(kbData.agents || []);
    } catch (err) {
      setError('Failed to load knowledge base');
      navigate('/knowledge');
    } finally {
      setEntriesLoading(false);
    }
  };

  // ---- KB CRUD ----
  const handleCreateKB = async () => {
    if (!kbForm.name.trim()) return setError('Name is required');
    try {
      setSaving(true);
      if (editingKB) {
        await api(`/api/knowledge/${editingKB.id}`, { method: 'PUT', body: JSON.stringify(kbForm) });
      } else {
        const kb = await api('/api/knowledge', { method: 'POST', body: JSON.stringify(kbForm) });
        navigate(`/knowledge/${kb.id}`);
      }
      setIsCreateOpen(false);
      setEditingKB(null);
      fetchKBs();
      if (kbId) loadKBDetail(kbId);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  const handleDeleteKB = async (id) => {
    if (!window.confirm('Delete this knowledge base and all its entries?')) return;
    try {
      await api(`/api/knowledge/${id}`, { method: 'DELETE' });
      fetchKBs();
      if (kbId === id) navigate('/knowledge');
    } catch (err) { setError(err.message); }
  };

  // ---- Entry CRUD ----
  const handleAddEntry = async () => {
    if (!entryForm.title.trim() || !entryForm.content.trim()) return setError('Title and content required');
    try {
      setSaving(true);
      await api(`/api/knowledge/${kbId}/entries`, { method: 'POST', body: JSON.stringify(entryForm) });
      setIsEntryOpen(false);
      setEntryForm({ title: '', content: '' });
      loadKBDetail(kbId);
      fetchKBs();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleAddUrl = async () => {
    if (!urlForm.url.trim()) return setError('URL is required');
    try {
      setSaving(true);
      await api(`/api/knowledge/${kbId}/entries/from-url`, { method: 'POST', body: JSON.stringify(urlForm) });
      setIsUrlOpen(false);
      setUrlForm({ url: '', title: '' });
      loadKBDetail(kbId);
      fetchKBs();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/knowledge/${kbId}/entries/from-file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
      loadKBDetail(kbId);
      fetchKBs();
    } catch (err) { setError(err.message); }
    e.target.value = '';
  };

  const handleCsvBulkImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/knowledge/${kbId}/entries/bulk-csv`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Import failed');
      }
      const data = await res.json();
      setError(null);
      loadKBDetail(kbId);
      fetchKBs();
      alert(`Imported ${data.imported} entries from CSV`);
    } catch (err) { setError(err.message); }
    setIsCsvOpen(false);
    e.target.value = '';
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api(`/api/knowledge/${kbId}/entries/${entryId}`, { method: 'DELETE' });
      loadKBDetail(kbId);
      fetchKBs();
      if (viewEntry?.id === entryId) setViewEntry(null);
    } catch (err) { setError(err.message); }
  };

  // ---- Agent linking ----
  const openLinkAgent = async () => {
    try {
      const data = await api('/api/agents');
      setAgents(data);
      setAgentSearch('');
      setIsLinkAgentOpen(true);
    } catch (err) { setError('Failed to load agents'); }
  };

  const handleLinkAgent = async (agentName) => {
    try {
      await api(`/api/knowledge/${kbId}/agents`, { method: 'POST', body: JSON.stringify({ agentName }) });
      loadKBDetail(kbId);
    } catch (err) { setError(err.message); }
  };

  const handleUnlinkAgent = async (agentName) => {
    try {
      await api(`/api/knowledge/${kbId}/agents/${agentName}`, { method: 'DELETE' });
      loadKBDetail(kbId);
    } catch (err) { setError(err.message); }
  };

  // ---- Semantic search ----
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const data = await api('/api/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({
          query: searchQuery,
          knowledgeBaseIds: kbId ? [kbId] : null,
          threshold: 0.25,
          limit: 10,
        }),
      });
      setSearchResults(data.results || []);
    } catch (err) { setError(err.message); } finally { setSearching(false); }
  };

  // ---- Filtered KBs ----
  const filteredKBs = knowledgeBases.filter(kb =>
    !search || kb.name.toLowerCase().includes(search.toLowerCase()) || (kb.description || '').toLowerCase().includes(search.toLowerCase())
  );

  // ===================== DETAIL VIEW =====================
  if (kbId && activeKB) {
    const sourceIcons = { manual: <Type size={12} />, document: <FileText size={12} />, url: <Globe size={12} />, csv: <File size={12} /> };
    return (
      <div style={{ color: t.tp }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => navigate('/knowledge')} style={{ background: 'none', border: 'none', color: t.ts, cursor: 'pointer', display: 'flex', padding: '4px' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={20} style={{ color: t.cyan }} />
              {activeKB.name}
            </h1>
            <p style={{ color: t.ts, fontSize: '12px', margin: 0 }}>{activeKB.description || 'No description'}</p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => { setIsSearchOpen(true); setSearchQuery(''); setSearchResults([]); }} style={{ ...btnCyanStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Brain size={13} /> Semantic Search
            </button>
            <button onClick={() => { setEditingKB(activeKB); setKbForm({ name: activeKB.name, description: activeKB.description || '' }); setIsCreateOpen(true); }} style={btnSecStyle}>
              <Edit2 size={13} />
            </button>
            <button onClick={() => handleDeleteKB(activeKB.id)} style={{ ...btnSecStyle, color: t.danger, borderColor: `${t.danger}33` }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="kb-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Entries', val: activeKB.entry_count || entries.filter(e => !e.parent_entry_id).length, icon: <BookOpen size={13} /> },
            { label: 'Linked Agents', val: linkedAgents.length, icon: <Users size={13} /> },
            { label: 'Source Types', val: [...new Set(entries.map(e => e.source_type))].length, icon: <Database size={13} /> },
          ].map((s, i) => (
            <div key={i} style={{ backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: t.tm, fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                {s.icon} {s.label}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '700' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Add entry actions */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => { setEntryForm({ title: '', content: '' }); setIsEntryOpen(true); }} style={{ ...btnVioletStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={13} /> Manual Entry
          </button>
          <button onClick={() => { setUrlForm({ url: '', title: '' }); setIsUrlOpen(true); }} style={{ ...btnOutlineStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={13} /> From URL
          </button>
          <label style={{ ...btnOutlineStyle, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <Upload size={13} /> Upload File
            <input type="file" accept=".txt,.md,.csv,.json,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <label style={{ ...btnOutlineStyle, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <File size={13} /> Bulk CSV Import
            <input type="file" accept=".csv" onChange={handleCsvBulkImport} style={{ display: 'none' }} />
          </label>
          <div style={{ flex: 1 }} />
          <button onClick={openLinkAgent} style={{ ...btnOutlineStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link2 size={13} /> Link Agent
          </button>
        </div>

        {/* Linked agents row */}
        {linkedAgents.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Linked Agents:</span>
            {linkedAgents.map(a => (
              <div key={a.name} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', backgroundColor: t.cyanM, borderRadius: '100px',
                fontSize: '11px', fontWeight: '500', color: t.cyan,
              }}>
                {a.name}
                <button onClick={() => handleUnlinkAgent(a.name)} style={{ background: 'none', border: 'none', color: t.cyan, cursor: 'pointer', display: 'flex', padding: 0 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Entries list */}
        {entriesLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: t.tm, fontSize: '13px' }}>Loading entries...</div>
        ) : entries.filter(e => !e.parent_entry_id).length === 0 ? (
          <div style={{ border: `1px dashed ${t.borderS}`, borderRadius: '12px', padding: '60px 20px', textAlign: 'center' }}>
            <Database size={32} style={{ color: t.tm, marginBottom: '12px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 6px 0' }}>No entries yet</h3>
            <p style={{ color: t.tm, fontSize: '12px', margin: 0 }}>Add knowledge entries using the buttons above</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entries.filter(e => !e.parent_entry_id).map(entry => (
              <div
                key={entry.id}
                style={{
                  backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
                  padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.2s',
                }}
                onClick={() => setViewEntry(viewEntry?.id === entry.id ? null : entry)}
                onMouseEnter={e => e.currentTarget.style.borderColor = t.cyan}
                onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ color: t.cyan, flexShrink: 0 }}>{sourceIcons[entry.source_type] || <FileText size={12} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
                    <div style={{ fontSize: '11px', color: t.tm, marginTop: '2px', display: 'flex', gap: '8px' }}>
                      <span>{entry.source_type}</span>
                      <span>{entry.token_count || 0} tokens</span>
                      {entry.source_url && <span style={{ color: t.cyan }}>URL</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDeleteEntry(entry.id)} style={{ ...iconBtnStyle, color: t.danger }}><Trash2 size={13} /></button>
                  </div>
                  <ChevronRight size={14} style={{ color: t.tm, transform: viewEntry?.id === entry.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>

                {/* Expanded content */}
                {viewEntry?.id === entry.id && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${t.border}` }}>
                    <pre style={{
                      backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px',
                      padding: '12px', fontFamily: t.mono, fontSize: '11px', color: t.ts,
                      whiteSpace: 'pre-wrap', lineHeight: '1.6', maxHeight: '300px', overflowY: 'auto',
                      margin: 0,
                    }}>
                      {entry.content}
                    </pre>
                    {entry.source_url && (
                      <div style={{ marginTop: '8px', fontSize: '11px' }}>
                        <span style={{ color: t.tm }}>Source: </span>
                        <a href={entry.source_url} target="_blank" rel="noopener noreferrer" style={{ color: t.cyan }}>{entry.source_url}</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Manual Entry Modal */}
        {isEntryOpen && (
          <div style={modalOverlayStyle} onClick={() => setIsEntryOpen(false)}>
            <div style={{ ...modalContentStyle, width: '560px' }} onClick={e => e.stopPropagation()}>
              <div style={modalHeaderStyle}>
                <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>Add Knowledge Entry</h2>
                <button onClick={() => setIsEntryOpen(false)} style={closeBtnStyle}><X size={18} /></button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Title</label>
                  <input style={inputStyle} placeholder="e.g. Company phone directory" value={entryForm.title}
                    onChange={e => setEntryForm({ ...entryForm, title: e.target.value })}
                    onFocus={e => e.target.style.borderColor = t.cyan} onBlur={e => e.target.style.borderColor = t.border} />
                </div>
                <div>
                  <label style={labelStyle}>Content</label>
                  <textarea style={{ ...inputStyle, minHeight: '200px', fontFamily: t.mono, fontSize: '12px', resize: 'vertical' }}
                    placeholder="Paste the knowledge content here..."
                    value={entryForm.content}
                    onChange={e => setEntryForm({ ...entryForm, content: e.target.value })}
                    onFocus={e => e.target.style.borderColor = t.cyan} onBlur={e => e.target.style.borderColor = t.border} />
                </div>
              </div>
              <div style={modalFooterStyle}>
                <button onClick={() => setIsEntryOpen(false)} style={btnSecStyle}>Cancel</button>
                <button onClick={handleAddEntry} disabled={saving} style={{ ...btnPriStyle, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Adding...' : 'Add Entry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* URL Modal */}
        {isUrlOpen && (
          <div style={modalOverlayStyle} onClick={() => setIsUrlOpen(false)}>
            <div style={{ ...modalContentStyle, width: '480px' }} onClick={e => e.stopPropagation()}>
              <div style={modalHeaderStyle}>
                <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>Add from URL</h2>
                <button onClick={() => setIsUrlOpen(false)} style={closeBtnStyle}><X size={18} /></button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>URL</label>
                  <input style={inputStyle} placeholder="https://..." value={urlForm.url}
                    onChange={e => setUrlForm({ ...urlForm, url: e.target.value })}
                    onFocus={e => e.target.style.borderColor = t.cyan} onBlur={e => e.target.style.borderColor = t.border} />
                </div>
                <div>
                  <label style={labelStyle}>Title (optional)</label>
                  <input style={inputStyle} placeholder="Auto-detected from URL" value={urlForm.title}
                    onChange={e => setUrlForm({ ...urlForm, title: e.target.value })}
                    onFocus={e => e.target.style.borderColor = t.cyan} onBlur={e => e.target.style.borderColor = t.border} />
                </div>
              </div>
              <div style={modalFooterStyle}>
                <button onClick={() => setIsUrlOpen(false)} style={btnSecStyle}>Cancel</button>
                <button onClick={handleAddUrl} disabled={saving} style={{ ...btnPriStyle, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Fetching...' : 'Fetch & Add'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Link Agent Modal */}
        {isLinkAgentOpen && (
          <div style={modalOverlayStyle} onClick={() => setIsLinkAgentOpen(false)}>
            <div style={{ ...modalContentStyle, width: '420px' }} onClick={e => e.stopPropagation()}>
              <div style={modalHeaderStyle}>
                <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>Link Agent to Knowledge Base</h2>
                <button onClick={() => setIsLinkAgentOpen(false)} style={closeBtnStyle}><X size={18} /></button>
              </div>
              <div style={{ padding: '14px' }}>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.tm }} />
                  <input style={{ ...inputStyle, paddingLeft: '30px', fontSize: '12px' }} placeholder="Search agents..."
                    value={agentSearch} onChange={e => setAgentSearch(e.target.value)} />
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: `1px solid ${t.border}`, borderRadius: '6px' }}>
                  {agents.filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase())).map(agent => {
                    const isLinked = linkedAgents.some(la => la.name === agent.name);
                    return (
                      <div key={agent.name} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                        cursor: 'pointer', borderBottom: `1px solid ${t.border}`,
                        backgroundColor: isLinked ? t.cyanM : 'transparent', transition: 'background-color 0.15s',
                      }}
                        onClick={() => isLinked ? handleUnlinkAgent(agent.name) : handleLinkAgent(agent.name)}
                      >
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '3px',
                          border: `1.5px solid ${isLinked ? t.cyan : t.tm}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isLinked ? t.cyan : 'transparent', transition: 'all 0.15s', flexShrink: 0,
                        }}>
                          {isLinked && <Check size={10} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: '500' }}>{agent.name}</div>
                          {agent.category && <div style={{ fontSize: '10px', color: t.tm }}>{agent.category}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={modalFooterStyle}>
                <button onClick={() => setIsLinkAgentOpen(false)} style={btnSecStyle}>Done</button>
              </div>
            </div>
          </div>
        )}

        {/* Semantic Search Modal */}
        {isSearchOpen && (
          <div style={modalOverlayStyle} onClick={() => setIsSearchOpen(false)}>
            <div style={{ ...modalContentStyle, width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={modalHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={16} style={{ color: t.cyan }} />
                  <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>Semantic Search</h2>
                </div>
                <button onClick={() => setIsSearchOpen(false)} style={closeBtnStyle}><X size={18} /></button>
              </div>
              <div style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="Ask a question or describe what you're looking for..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    onFocus={e => e.target.style.borderColor = t.cyan} onBlur={e => e.target.style.borderColor = t.border} />
                  <button onClick={handleSearch} disabled={searching || !searchQuery.trim()} style={{ ...btnPriStyle, opacity: searching ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                {searchResults.length === 0 && !searching && (
                  <div style={{ padding: '40px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
                    {searchQuery ? 'No results found. Try a different query.' : 'Enter a query to search your knowledge base semantically.'}
                  </div>
                )}
                {searchResults.map((r, i) => (
                  <div key={r.id} style={{
                    backgroundColor: t.surfaceEl, border: `1px solid ${t.border}`, borderRadius: '8px',
                    padding: '14px', marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{r.title}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: '600', color: r.similarity > 0.85 ? t.success : r.similarity > 0.7 ? t.cyan : t.warning,
                        backgroundColor: r.similarity > 0.85 ? 'rgba(34,197,94,0.1)' : r.similarity > 0.7 ? t.cyanM : 'rgba(245,158,11,0.1)',
                        padding: '2px 8px', borderRadius: '100px',
                      }}>
                        {(r.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p style={{ color: t.ts, fontSize: '12px', lineHeight: '1.6', margin: 0, maxHeight: '120px', overflow: 'hidden' }}>
                      {r.content?.slice(0, 400)}{r.content?.length > 400 ? '...' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit KB Modal (reused) */}
        {isCreateOpen && renderKBModal()}

        {renderError()}

        <style>{`
          @media (max-width: 768px) {
            .kb-stats-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    );
  }

  // ===================== LIST VIEW =====================
  function renderKBModal() {
    return (
      <div style={modalOverlayStyle} onClick={() => { setIsCreateOpen(false); setEditingKB(null); }}>
        <div style={{ ...modalContentStyle, width: '480px' }} onClick={e => e.stopPropagation()}>
          <div style={modalHeaderStyle}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>{editingKB ? 'Edit Knowledge Base' : 'Create Knowledge Base'}</h2>
            <button onClick={() => { setIsCreateOpen(false); setEditingKB(null); }} style={closeBtnStyle}><X size={18} /></button>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} placeholder="e.g. Company Contacts" value={kbForm.name}
                onChange={e => setKbForm({ ...kbForm, name: e.target.value })}
                onFocus={e => e.target.style.borderColor = t.cyan} onBlur={e => e.target.style.borderColor = t.border} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="What kind of knowledge does this base contain?"
                value={kbForm.description}
                onChange={e => setKbForm({ ...kbForm, description: e.target.value })}
                onFocus={e => e.target.style.borderColor = t.cyan} onBlur={e => e.target.style.borderColor = t.border} />
            </div>
          </div>
          <div style={modalFooterStyle}>
            <button onClick={() => { setIsCreateOpen(false); setEditingKB(null); }} style={btnSecStyle}>Cancel</button>
            <button onClick={handleCreateKB} disabled={saving} style={{ ...btnPriStyle, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : editingKB ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderError() {
    if (!error) return null;
    return (
      <div style={{
        position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: t.danger, color: '#fff', padding: '10px 20px', borderRadius: '6px',
        display: 'flex', alignItems: 'center', gap: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 200, fontSize: '13px',
      }}>
        <AlertCircle size={16} />
        <span>{error}</span>
        <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ color: t.tp }}>
      {/* Header */}
      <div className="kb-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={22} style={{ color: t.cyan }} />
            Knowledge Bases
          </h1>
          <p style={{ color: t.ts, fontSize: '13px', margin: 0 }}>Factual knowledge for your agents — contacts, data, procedures, specs</p>
        </div>
        <button onClick={() => { setEditingKB(null); setKbForm({ name: '', description: '' }); setIsCreateOpen(true); }}
          style={{ backgroundColor: t.tp, color: t.bg, border: 'none', borderRadius: '4px', padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> New Knowledge Base
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.tm }} />
        <input placeholder="Search knowledge bases..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: '34px' }} />
      </div>

      {/* KB Grid */}
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: t.tm, fontSize: '13px' }}>Loading...</div>
      ) : filteredKBs.length === 0 ? (
        <div style={{ border: `1px dashed ${t.borderS}`, borderRadius: '12px', padding: '60px 20px', textAlign: 'center' }}>
          <Database size={32} style={{ color: t.tm, marginBottom: '12px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 6px 0' }}>
            {search ? 'No knowledge bases found' : 'No knowledge bases yet'}
          </h3>
          <p style={{ color: t.tm, fontSize: '12px', margin: '0 0 16px 0' }}>
            {search ? 'Try adjusting your search.' : 'Create your first knowledge base to give your agents factual data.'}
          </p>
          {!search && (
            <button onClick={() => { setEditingKB(null); setKbForm({ name: '', description: '' }); setIsCreateOpen(true); }}
              style={{ ...btnVioletStyle, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} /> Create Knowledge Base
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredKBs.map(kb => (
            <div key={kb.id}
              onClick={() => navigate(`/knowledge/${kb.id}`)}
              style={{
                backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
                padding: '18px', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.cyan; e.currentTarget.style.boxShadow = `0 4px 20px rgba(6,182,212,0.08)`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <Database size={16} style={{ color: t.cyan }} />
                <span style={{ fontWeight: '600', fontSize: '14px', flex: 1 }}>{kb.name}</span>
                <span style={{
                  fontSize: '11px', fontWeight: '600', color: t.cyan, backgroundColor: t.cyanM,
                  padding: '2px 8px', borderRadius: '100px',
                }}>
                  {kb.entry_count || 0} entries
                </span>
              </div>
              <p style={{
                color: t.ts, fontSize: '12px', lineHeight: '1.5', margin: '0 0 12px 0',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                minHeight: '36px',
              }}>
                {kb.description || 'No description'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: t.tm }}>
                  {new Date(kb.created_at).toLocaleDateString()}
                </span>
                <div style={{ display: 'flex', gap: '2px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditingKB(kb); setKbForm({ name: kb.name, description: kb.description || '' }); setIsCreateOpen(true); }} style={iconBtnStyle}><Edit2 size={13} /></button>
                  <button onClick={() => handleDeleteKB(kb.id)} style={{ ...iconBtnStyle, color: t.danger }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && renderKBModal()}
      {renderError()}

      <style>{`
        @media (max-width: 768px) {
          .kb-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      `}</style>
    </div>
  );
}

// Style constants
const modalOverlayStyle = {
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
};
const modalContentStyle = {
  backgroundColor: t.surface, border: `1px solid ${t.border}`,
  borderRadius: '8px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden',
};
const modalHeaderStyle = {
  padding: '14px 20px', borderBottom: `1px solid ${t.border}`,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const modalFooterStyle = {
  padding: '12px 20px', borderTop: `1px solid ${t.border}`,
  display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: t.surfaceEl,
};
const btnPriStyle = {
  backgroundColor: t.tp, color: t.bg, border: 'none',
  borderRadius: '4px', padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
};
const btnSecStyle = {
  backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
  borderRadius: '4px', padding: '8px 16px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '4px',
};
const btnVioletStyle = {
  backgroundColor: t.violetM, color: t.violet, border: `1px solid rgba(139,92,246,0.3)`,
  borderRadius: '4px', padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
};
const btnCyanStyle = {
  backgroundColor: t.cyanM, color: t.cyan, border: `1px solid rgba(6,182,212,0.3)`,
  borderRadius: '4px', padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
};
const btnOutlineStyle = {
  backgroundColor: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
  borderRadius: '4px', padding: '8px 14px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '6px',
};
const iconBtnStyle = {
  background: 'none', border: 'none', color: t.ts, padding: '5px',
  borderRadius: '4px', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s',
};
const labelStyle = {
  display: 'block', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
  color: t.tm, marginBottom: '6px', letterSpacing: '0.05em',
};
const closeBtnStyle = {
  background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex',
};
