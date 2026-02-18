import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ChevronLeft, ChevronRight, Palette, Code, Settings, Megaphone, BarChart3, Wrench, ArrowLeft, Shield, Users, User, FolderTree, FileCode, Pencil, Check, X, Maximize2, Minimize2, Download, GitCompare, Trash2, RotateCcw } from 'lucide-react';
import { api, getUser } from '../api';
import TerminalPanel from '../components/TerminalPanel';
import OrchestraBuilder from '../components/OrchestraBuilder';
import OrchestraView from '../components/OrchestraView';
import FileExplorer from '../components/FileExplorer';
import FileViewer from '../components/FileViewer';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

function TreeNode({ node, level = 0, selected, onSelect, onContext, onBranch, onRename, isLast = false, multiSelect = false, selectedIds, onToggleSelect }) {
  const isSelected = selected?.id === node.id;
  const isChecked = selectedIds?.has(node.id);
  const [hovered, setHovered] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const hasChildren = node.children && node.children.length > 0;
  const isRoot = level === 0;

  const startRename = () => {
    setEditTitle(node.title || `V${node.version}`);
    setEditing(true);
  };

  const commitRename = () => {
    if (editTitle.trim() && editTitle !== (node.title || `V${node.version}`)) {
      onRename?.(node.id, editTitle.trim());
    }
    setEditing(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      {!isRoot && (
        <div style={{
          position: 'absolute', left: `${(level - 1) * 20 + 9}px`, top: 0,
          width: '1px', height: isLast ? '16px' : '100%',
          background: 'rgba(139,92,246,0.15)',
        }} />
      )}
      {!isRoot && (
        <div style={{
          position: 'absolute', left: `${(level - 1) * 20 + 9}px`, top: '16px',
          width: '11px', height: '1px',
          background: 'rgba(139,92,246,0.15)',
        }} />
      )}

      <div style={{ marginLeft: `${level * 20}px` }}>
        <div
          onClick={() => multiSelect ? onToggleSelect?.(node.id) : onSelect(node)}
          onDoubleClick={e => { e.stopPropagation(); startRename(); }}
          onContextMenu={e => { e.preventDefault(); onContext({ x: e.clientX, y: e.clientY, node }); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title={node.prompt ? `Prompt: ${node.prompt}` : undefined}
          style={{
            padding: '4px 8px', margin: '1px 0', borderRadius: '6px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
            background: isChecked ? 'rgba(239,68,68,0.08)' : isSelected ? 'rgba(139,92,246,0.12)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
            border: isChecked ? '1px solid rgba(239,68,68,0.3)' : isSelected ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
            transition: 'all 0.15s',
          }}
        >
          {/* Multi-select checkbox */}
          {multiSelect && (
            <span style={{
              width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
              border: isChecked ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.2)',
              background: isChecked ? '#ef4444' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isChecked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </span>
          )}

          {/* Collapse/expand or dot */}
          {!multiSelect && (hasChildren ? (
            <span onClick={e => { e.stopPropagation(); setCollapsed(!collapsed); }}
              style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', borderRadius: '3px', background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={t.tm} strokeWidth="1.5">
                {collapsed ? <polyline points="3,1 7,5 3,9"/> : <polyline points="1,3 5,7 9,3"/>}
              </svg>
            </span>
          ) : (
            <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isSelected ? t.violet : 'rgba(255,255,255,0.15)' }} />
            </span>
          ))}

          {/* Title — inline editing */}
          {editing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
              onBlur={commitRename}
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1, background: t.surfaceEl, border: `1px solid ${t.violet}`, borderRadius: '3px',
                padding: '1px 4px', color: t.tp, fontSize: '12px', outline: 'none', minWidth: 0,
              }}
            />
          ) : (
            <span style={{
              color: isSelected ? t.tp : t.ts, flex: 1, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isRoot ? '500' : '400',
            }}>
              {node.title || `V${node.version}`}
            </span>
          )}

          {/* Branch button */}
          {hovered && !multiSelect && !editing && (
            <span
              onClick={e => { e.stopPropagation(); onBranch(node); }}
              title={`Branch from ${node.title || 'V' + node.version}`}
              style={{
                width: '16px', height: '16px', borderRadius: '3px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                background: 'rgba(139,92,246,0.15)', color: t.violet, fontSize: '12px',
                fontWeight: '700', lineHeight: 1, flexShrink: 0,
              }}
            >+</span>
          )}

          {/* Agent badge */}
          <span style={{
            background: isRoot ? t.violetM : 'rgba(255,255,255,0.05)',
            color: isRoot ? t.violet : t.tm,
            padding: '1px 5px', borderRadius: '99px', fontSize: '9px', fontWeight: '600',
            whiteSpace: 'nowrap', maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {(node.agent_name || '').split('-').slice(0, 2).join('-')}
          </span>

          {hasChildren && collapsed && (
            <span style={{ background: 'rgba(255,255,255,0.06)', color: t.tm, padding: '0 4px', borderRadius: '3px', fontSize: '9px', fontWeight: '600' }}>
              {node.children.length}
            </span>
          )}
        </div>
      </div>

      {hasChildren && !collapsed && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode key={child.id} node={child} level={level + 1} selected={selected}
              onSelect={onSelect} onContext={onContext} onBranch={onBranch} onRename={onRename}
              isLast={i === node.children.length - 1}
              multiSelect={multiSelect} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function IterationCarousel({ allIterations, selected, onSelect, projectId, previewKey = 0 }) {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    // Auto-scroll to end when new iterations arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
    return () => window.removeEventListener('resize', checkScroll);
  }, [allIterations]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -400 : 400,
        behavior: 'smooth',
      });
    }
  };

  if (!allIterations || allIterations.length === 0) return null;

  return (
    <div style={{
      position: 'relative', height: '140px', width: '100%', backgroundColor: t.bg,
      borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center',
      padding: '0 16px', boxSizing: 'border-box', flexShrink: 0,
    }}>
      {showLeftArrow && (
        <button onClick={() => scroll('left')} style={{
          position: 'absolute', left: '8px', zIndex: 10, background: t.surfaceEl,
          border: `1px solid ${t.borderS}`, borderRadius: '50%', width: '32px', height: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tp,
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', transition: 'transform 0.2s ease',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <div ref={scrollRef} onScroll={checkScroll} style={{
        display: 'flex', gap: '16px', overflowX: 'auto', scrollbarWidth: 'none',
        msOverflowStyle: 'none', padding: '8px 0', height: '100%', alignItems: 'center',
        scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch', flex: 1,
      }}>
        {allIterations.map((iteration) => {
          const isSelected = selected?.id === iteration.id;
          return (
            <div key={iteration.id} onClick={() => onSelect(iteration)} style={{
              flex: '0 0 160px', display: 'flex', flexDirection: 'column', gap: '4px',
              cursor: 'pointer', transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                width: '160px', height: '90px', borderRadius: '8px', backgroundColor: t.surface,
                border: isSelected ? `2px solid ${t.violet}` : `1px solid ${t.border}`,
                boxShadow: isSelected ? `0 0 12px ${t.violetG}` : 'none',
                overflow: 'hidden', position: 'relative', transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}>
                <div style={{
                  width: '1280px', height: '720px', transform: 'scale(0.125)',
                  transformOrigin: 'top left', pointerEvents: 'none', backgroundColor: t.surface,
                }}>
                  <iframe src={`/api/preview/${projectId}/${iteration.id}?v=${previewKey}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={`Preview V${iteration.version}`} loading="lazy" sandbox="allow-same-origin" />
                </div>
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px',
                    borderRadius: '50%', backgroundColor: t.violet,
                  }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: '600',
                  color: isSelected ? t.tp : t.ts,
                }}>
                  {iteration.title || `V${iteration.version}`}
                </span>
                <span style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '10px',
                  backgroundColor: t.surfaceEl, border: `1px solid ${t.border}`,
                  color: t.tm, textTransform: 'uppercase', letterSpacing: '0.02em',
                  maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {(iteration.agent_name || '').split('-').slice(0, 2).join('-')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {showRightArrow && (
        <button onClick={() => scroll('right')} style={{
          position: 'absolute', right: '8px', zIndex: 10, background: t.surfaceEl,
          border: `1px solid ${t.borderS}`, borderRadius: '50%', width: '32px', height: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tp,
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', transition: 'transform 0.2s ease',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

export default function ProjectView() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [treeData, setTreeData] = useState([]);
  const [selected, setSelected] = useState(null);
  const [leftW, setLeftW] = useState(250);
  const [rightW, setRightW] = useState(600);
  const [resizing, setResizing] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [termTabs, setTermTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [branchParent, setBranchParent] = useState(undefined);
  const [claudeStatus, setClaudeStatus] = useState(null);
  const [userClaudeConnected, setUserClaudeConnected] = useState(null);
  const [mobilePanel, setMobilePanel] = useState('preview'); // 'tree' | 'preview' | 'terminal'
  const [agentSkills, setAgentSkills] = useState([]);
  const [rightPanel, setRightPanel] = useState('terminal'); // 'terminal' | 'files' | 'orchestra'
  const [viewingFile, setViewingFile] = useState(null); // file path for FileViewer
  const [allAgents, setAllAgents] = useState([]);
  // Inline editing state
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  // Multi-select for bulk delete
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Fullscreen preview
  const [fullscreen, setFullscreen] = useState(false);
  // Agent working indicator
  const [agentWorking, setAgentWorking] = useState(false);
  const agentWorkingTimer = useRef(null);

  const terminalRef = useRef(null);
  const setupTerminalRef = useRef(null);
  const promptRef = useRef(null);
  const carouselRef = useRef(null);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Flatten tree into a flat list for the carousel
  const allIterations = React.useMemo(() => {
    const flat = [];
    const flatten = (nodes) => { for (const n of nodes) { flat.push(n); if (n.children) flatten(n.children); } };
    flatten(treeData);
    return flat;
  }, [treeData]);

  // Check Claude CLI status + per-user auth
  useEffect(() => {
    api('/api/claude-status').then(s => setClaudeStatus(s)).catch(() => setClaudeStatus({ installed: false, version: null }));
    api('/api/claude-auth/status').then(s => setUserClaudeConnected(s.connected)).catch(() => setUserClaudeConnected(false));
  }, []);

  // Load project data + saved terminal tabs
  useEffect(() => {
    const load = async () => {
      try {
        const [p, tree, savedTabs, skills, agentsList] = await Promise.all([
          api(`/api/projects/${projectId}`),
          api(`/api/iterations/${projectId}/tree`),
          api(`/api/terminal-tabs/${projectId}`),
          api(`/api/projects/${projectId}/skills`).catch(() => []),
          api('/api/agents').catch(() => []),
        ]);
        setProject(p);
        setAllAgents(agentsList || []);
        setAgentSkills(skills || []);
        setTreeData(tree || []);
        if (tree && tree.length > 0) {
          const flat = [];
          const flatten = (nodes) => { for (const n of nodes) { flat.push(n); if (n.children) flatten(n.children); } };
          flatten(tree);
          setSelected(flat[flat.length - 1] || tree[0]);
        }
        // Restore saved tabs or create default
        if (savedTabs && savedTabs.length > 0) {
          const tabs = savedTabs.map(t => ({
            id: t.id,
            name: t.name || 'claude-1',
            sessionId: t.alive ? t.session_id : null, // only reattach if session alive
          }));
          setTermTabs(tabs);
          setActiveTab(tabs[0].id);
        } else {
          const defaultTab = { id: `tab-${Date.now()}`, name: 'claude-1', sessionId: null };
          setTermTabs([defaultTab]);
          setActiveTab(defaultTab.id);
          // Save default tab to DB
          api('/api/terminal-tabs', { method: 'POST', body: JSON.stringify({ id: defaultTab.id, project_id: projectId, name: defaultTab.name }) }).catch(() => {});
        }
        setTabsLoaded(true);
      } catch (e) { console.error(e); }
    };
    if (projectId && projectId !== 'new') load();
  }, [projectId]);

  // Watcher logs state
  const [watcherLogs, setWatcherLogs] = useState([]);
  const [previewKey, setPreviewKey] = useState(0); // increment to force iframe refresh

  // Listen for auto-imported iterations + live updates via Socket.IO
  useEffect(() => {
    if (!projectId || projectId === 'new') return;
    const socket = io({ transports: ['websocket'] });

    socket.on('iteration-created', (data) => {
      if (data.projectId === projectId) {
        // NEW iteration — refresh tree and select it
        api(`/api/iterations/${projectId}/tree`).then(tree => {
          setTreeData(tree || []);
          if (data.iteration) setSelected(data.iteration);
        }).catch(() => {});
      }
    });

    socket.on('iteration-updated', (data) => {
      if (data.projectId === projectId) {
        // UPDATED iteration — refresh preview without changing tree
        setPreviewKey(k => k + 1);
        // If the updated iteration is currently selected, update its data
        if (data.iteration) {
          setSelected(prev => prev?.id === data.iterationId ? { ...prev, ...data.iteration } : prev);
        }
      }
    });

    socket.on('watcher-log', (data) => {
      if (data.projectId === projectId) {
        setWatcherLogs(prev => [...prev.slice(-49), { timestamp: data.timestamp, type: data.type, message: data.message }]);
        // Show agent working indicator for 15s after any watcher activity
        setAgentWorking(true);
        if (agentWorkingTimer.current) clearTimeout(agentWorkingTimer.current);
        agentWorkingTimer.current = setTimeout(() => setAgentWorking(false), 15000);
      }
    });

    return () => socket.disconnect();
  }, [projectId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      // Ctrl+Enter → Generate
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (prompt.trim() && terminalRef.current) {
          const escaped = prompt.replace(/'/g, "'\\''");
          terminalRef.current.sendInput(`claude -p '${escaped}'\n`);
          setPrompt('');
        }
      }
      // Escape → exit fullscreen or multi-select
      if (e.key === 'Escape') {
        if (fullscreen) { setFullscreen(false); e.preventDefault(); }
        if (multiSelect) { setMultiSelect(false); setSelectedIds(new Set()); e.preventDefault(); }
      }
      // Arrow up/down to navigate iterations (when not in input)
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        const idx = allIterations.findIndex(it => it.id === selected?.id);
        if (e.key === 'ArrowUp' && idx > 0) {
          handleSelect(allIterations[idx - 1]);
        } else if (e.key === 'ArrowDown' && idx < allIterations.length - 1) {
          handleSelect(allIterations[idx + 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prompt, fullscreen, multiSelect, allIterations, selected, handleSelect]);

  const handleMouseMove = useCallback(e => {
    if (resizing === 'left') setLeftW(Math.max(150, Math.min(500, e.clientX)));
    if (resizing === 'right') setRightW(Math.max(200, Math.min(700, window.innerWidth - e.clientX)));
  }, [resizing]);

  const handleMouseUp = useCallback(() => setResizing(null), []);

  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  const addTab = () => {
    const id = `tab-${Date.now()}`;
    const name = `claude-${termTabs.length + 1}`;
    setTermTabs(prev => [...prev, { id, name, sessionId: null }]);
    setActiveTab(id);
    // Save to DB
    api('/api/terminal-tabs', { method: 'POST', body: JSON.stringify({ id, project_id: projectId, name }) }).catch(() => {});
  };

  const closeTab = (tabId) => {
    const tab = termTabs.find(t => t.id === tabId);
    if (!tab) return;
    // Remove tab from state
    setTermTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (activeTab === tabId && next.length > 0) setActiveTab(next[0].id);
      return next;
    });
    // Remove from DB
    api(`/api/terminal-tabs/${tabId}`, { method: 'DELETE' }).catch(() => {});
  };

  // Set branch context on the server (updates CLAUDE.md + .branch-context.json)
  const setBranchContext = useCallback((parentId) => {
    if (!projectId) return;
    api(`/api/terminal-tabs/${projectId}/branch-context`, {
      method: 'POST',
      body: JSON.stringify({ parentId }),
    }).catch(err => console.error('[BranchContext]', err));
  }, [projectId]);

  // Handle clicking "New" (root worktree)
  const handleNewRoot = useCallback(() => {
    setBranchParent(null);
    setBranchContext(null);
    setTimeout(() => promptRef.current?.focus(), 100);
  }, [setBranchContext]);

  // Handle clicking "+" on a node (sub-branch)
  const handleBranch = useCallback((node) => {
    setBranchParent(node);
    setBranchContext(node.id);
    setSelected(node);
    setTimeout(() => promptRef.current?.focus(), 100);
  }, [setBranchContext]);

  // Handle selecting an iteration (updates terminal context)
  const handleSelect = useCallback((node) => {
    setSelected(node);
    setBranchParent(node);
    setBranchContext(node.id);
  }, [setBranchContext]);

  // Inline editing handlers
  const startEditName = useCallback(() => {
    setEditName(project?.name || '');
    setEditingName(true);
  }, [project]);

  const saveName = useCallback(async () => {
    if (!editName.trim() || editName === project?.name) {
      setEditingName(false);
      return;
    }
    try {
      const updated = await api(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName.trim() }),
      });
      setProject(updated);
    } catch (err) { console.error('Save name error:', err); }
    setEditingName(false);
  }, [editName, project, projectId]);

  const startEditDesc = useCallback(() => {
    setEditDesc(project?.description || '');
    setEditingDesc(true);
  }, [project]);

  const saveDesc = useCallback(async () => {
    try {
      const updated = await api(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ description: editDesc.trim() }),
      });
      setProject(updated);
    } catch (err) { console.error('Save desc error:', err); }
    setEditingDesc(false);
  }, [editDesc, projectId]);

  // Rename iteration inline
  const handleRename = useCallback(async (iterationId, newTitle) => {
    try {
      await api(`/api/iterations/detail/${iterationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle }),
      });
      // Refresh tree
      const tree = await api(`/api/iterations/${projectId}/tree`);
      setTreeData(tree || []);
    } catch (err) { console.error('[Rename]', err); }
  }, [projectId]);

  // Multi-select toggle
  const handleToggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} iteration(s)?`)) return;
    try {
      await api(`/api/iterations/${projectId}/batch-delete`, {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      setMultiSelect(false);
      const tree = await api(`/api/iterations/${projectId}/tree`);
      setTreeData(tree || []);
      if (selectedIds.has(selected?.id)) setSelected(null);
    } catch (err) { console.error('[BulkDelete]', err); }
  }, [selectedIds, projectId, selected]);

  // Restore iteration to workspace
  const handleRestore = useCallback(async (iterationId) => {
    try {
      const result = await api(`/api/iterations/detail/${iterationId}/restore`, { method: 'POST' });
      if (result.ok) alert(result.message || 'Restored!');
    } catch (err) { console.error('[Restore]', err); }
  }, []);

  // File explorer handler
  const handleFileSelect = useCallback((node) => {
    setViewingFile(node.path);
  }, []);

  // Refresh project data (e.g. after adding/removing team members)
  const refreshProject = useCallback(async () => {
    try {
      const p = await api(`/api/projects/${projectId}`);
      setProject(p);
    } catch (err) {
      console.error('[ProjectView] Refresh error:', err);
    }
  }, [projectId]);

  // Send prompt to the active terminal as a claude command
  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    if (!terminalRef.current) return;
    // Escape single quotes for shell safety
    const escaped = prompt.replace(/'/g, "'\\''");
    terminalRef.current.sendInput(`claude -p '${escaped}'\n`);
    setPrompt('');
  }, [prompt]);

  // Called when a new PTY session is created for a tab
  const handleSessionCreated = (tabId, sessionId) => {
    setTermTabs(prev => prev.map(t => t.id === tabId ? { ...t, sessionId } : t));
    // Persist session mapping to DB
    api(`/api/terminal-tabs/${tabId}/session`, { method: 'PUT', body: JSON.stringify({ session_id: sessionId }) }).catch(() => {});
  };

  if (projectId === 'new') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 53px)', background: t.bg, padding: '24px' }}>
        <NewProjectForm onCreated={id => navigate(`/project/${id}`)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: 'calc(100vh - 53px)', background: t.bg, overflow: 'hidden' }}
      onClick={() => setContextMenu(null)}>

      {/* Mobile Panel Switcher */}
      {isMobile && (
        <div style={{
          display: 'flex', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0,
        }}>
          {[
            { id: 'tree', label: 'Worktree' },
            { id: 'preview', label: 'Preview' },
            { id: 'terminal', label: 'Terminal' },
            { id: 'files', label: 'Files' },
            ...(project?.mode === 'orchestra' ? [{ id: 'orchestra', label: 'Orchestra' }] : []),
          ].map(tab => (
            <button key={tab.id} onClick={() => { setMobilePanel(tab.id); if (tab.id === 'files') setRightPanel('files'); else if (tab.id === 'terminal') setRightPanel('terminal'); else if (tab.id === 'orchestra') setRightPanel('orchestra'); }} style={{
              flex: 1, padding: '10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              background: mobilePanel === tab.id ? t.surfaceEl : 'transparent',
              color: mobilePanel === tab.id ? t.tp : t.tm,
              border: 'none', borderBottom: mobilePanel === tab.id ? `2px solid ${t.violet}` : '2px solid transparent',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* LEFT: Worktree */}
      <aside style={{
        width: isMobile ? '100%' : `${leftW}px`,
        background: t.surface, borderRight: isMobile ? 'none' : `1px solid ${t.border}`,
        display: fullscreen ? 'none' : (isMobile && mobilePanel !== 'tree' ? 'none' : 'flex'),
        flexDirection: 'column', flexShrink: 0,
        height: isMobile ? 'calc(100vh - 53px - 42px)' : 'auto',
      }}>
        <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 12px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Worktree</span>
            {agentWorking && (
              <span title="Agent is working..." style={{
                width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', flexShrink: 0,
                animation: 'pulse 1.5s infinite',
              }} />
            )}
          </div>
          <div style={{ display: 'flex', gap: '3px' }}>
            {multiSelect ? (
              <>
                <button onClick={handleBulkDelete} disabled={selectedIds.size === 0}
                  title={`Delete ${selectedIds.size} selected`}
                  style={{ background: selectedIds.size > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: selectedIds.size > 0 ? '#ef4444' : t.tm, border: `1px solid ${selectedIds.size > 0 ? 'rgba(239,68,68,0.3)' : t.border}`, borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', cursor: selectedIds.size > 0 ? 'pointer' : 'default' }}>
                  <Trash2 size={11} /> {selectedIds.size}
                </button>
                <button onClick={() => { setMultiSelect(false); setSelectedIds(new Set()); }}
                  style={{ background: 'rgba(255,255,255,0.05)', color: t.ts, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}>
                  <X size={11} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setMultiSelect(true)} title="Select multiple to delete"
                  style={{ background: 'transparent', color: t.tm, border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={12} />
                </button>
                <button
                  onClick={() => {
                    api(`/api/terminal-tabs/${projectId}/new-version`, { method: 'POST' })
                      .then(() => {
                        api(`/api/iterations/${projectId}/tree`).then(tree => setTreeData(tree || [])).catch(() => {});
                      })
                      .catch(err => console.error('[NewVersion]', err));
                  }}
                  title="Snapshot current state as a new version"
                  style={{ background: 'rgba(139,92,246,0.15)', color: t.violet, border: `1px solid rgba(139,92,246,0.3)`, borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Snap
                </button>
                <button onClick={handleNewRoot} style={{ background: t.tp, color: t.bg, border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New
                </button>
              </>
            )}
          </div>
        </div>
        {/* CSS for pulse animation */}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        {branchParent !== undefined && (
          <div style={{
            padding: '6px 12px', borderBottom: `1px solid ${t.border}`, display: 'flex',
            alignItems: 'center', gap: '6px', fontSize: '11px', background: 'rgba(139,92,246,0.06)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.violet} strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
            <span style={{ color: t.violet, flex: 1 }}>
              {branchParent === null
                ? 'New root worktree'
                : `From ${branchParent.title || 'V' + branchParent.version}`}
            </span>
            <span onClick={() => setBranchParent(undefined)} style={{ color: t.tm, cursor: 'pointer', fontSize: '13px' }}>x</span>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {treeData.map(node => (
            <TreeNode key={node.id} node={node} selected={selected} onSelect={handleSelect}
              onContext={setContextMenu} onBranch={handleBranch} onRename={handleRename}
              multiSelect={multiSelect} selectedIds={selectedIds} onToggleSelect={handleToggleSelect} />
          ))}
          {treeData.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: t.tm }}>No iterations yet</div>
          )}
        </div>
        {/* Activity Log */}
        {watcherLogs.length > 0 && (
          <div style={{ borderTop: `1px solid ${t.border}`, maxHeight: '120px', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${t.border}`, background: t.surfaceEl, position: 'sticky', top: 0, zIndex: 1 }}>
              Activity Log
            </div>
            {watcherLogs.slice().reverse().map((log, i) => (
              <div key={i} style={{ padding: '3px 12px', fontSize: '10px', color: t.ts, display: 'flex', gap: '6px', alignItems: 'center', borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: log.type === 'create' ? '#22c55e' : log.type === 'update' ? '#3b82f6' : log.type === 'snapshot' ? t.violet : '#f59e0b',
                }} />
                <span style={{ color: t.tm, fontSize: '9px', flexShrink: 0 }}>
                  {new Date(log.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Left Resizer */}
      {!isMobile && !fullscreen && (
        <div onMouseDown={() => setResizing('left')} style={{
          width: '4px', cursor: 'col-resize', background: resizing === 'left' ? t.violet : 'transparent',
          transition: 'background 0.2s', zIndex: 10, flexShrink: 0,
        }} />
      )}

      {/* CENTER: Preview */}
      <main style={{
        flex: 1, display: isMobile && mobilePanel !== 'preview' ? 'none' : 'flex',
        flexDirection: 'column', minWidth: 0,
        height: isMobile ? 'calc(100vh - 53px - 42px)' : 'auto',
      }}>
        <div style={{
          height: '40px', background: t.surface, borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px', fontSize: '12px', color: t.ts, flexShrink: 0,
          overflow: 'hidden',
        }}>
          {/* Inline editable project name */}
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                style={{
                  background: t.surfaceEl, border: `1px solid ${t.violet}`, borderRadius: '4px',
                  padding: '2px 8px', color: t.tp, fontSize: '12px', fontWeight: '500',
                  outline: 'none', width: '200px',
                }}
              />
              <Check size={14} style={{ color: t.violet, cursor: 'pointer' }} onClick={saveName} />
              <X size={14} style={{ color: t.tm, cursor: 'pointer' }} onClick={() => setEditingName(false)} />
            </div>
          ) : (
            <span
              onClick={startEditName}
              style={{ color: t.tp, fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Click to edit project name"
            >
              {project?.name || 'Loading...'}
              <Pencil size={10} style={{ color: t.tm, opacity: 0.5 }} />
            </span>
          )}
          {/* Inline editable description */}
          {project?.description && !editingDesc && (
            <span
              onClick={startEditDesc}
              style={{ color: t.tm, fontSize: '11px', cursor: 'pointer', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title="Click to edit description"
            >
              {project.description}
            </span>
          )}
          {editingDesc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                autoFocus
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveDesc(); if (e.key === 'Escape') setEditingDesc(false); }}
                placeholder="Description..."
                style={{
                  background: t.surfaceEl, border: `1px solid ${t.violet}`, borderRadius: '4px',
                  padding: '2px 8px', color: t.tp, fontSize: '11px',
                  outline: 'none', width: '200px',
                }}
              />
              <Check size={14} style={{ color: t.violet, cursor: 'pointer' }} onClick={saveDesc} />
              <X size={14} style={{ color: t.tm, cursor: 'pointer' }} onClick={() => setEditingDesc(false)} />
            </div>
          )}
          {!editingDesc && !project?.description && (
            <span
              onClick={startEditDesc}
              style={{ color: t.tm, fontSize: '11px', cursor: 'pointer', opacity: 0.5, fontStyle: 'italic' }}
            >
              + description
            </span>
          )}
          {selected && <>
            <span style={{ color: t.tm }}>/</span>
            <span>{selected.title || `V${selected.version}`}</span>
            <span style={{ background: t.violetM, color: t.violet, padding: '1px 6px', borderRadius: '99px', fontSize: '10px', fontWeight: '600' }}>
              {selected.agent_name}
            </span>
          </>}
          {/* Project type badge */}
          {project?.project_type === 'fullstack' && (
            <span style={{
              background: 'rgba(34,197,94,0.12)', color: '#22c55e', padding: '1px 6px',
              borderRadius: '99px', fontSize: '9px', fontWeight: '700', border: '1px solid rgba(34,197,94,0.3)',
            }}>FULLSTACK</span>
          )}
          <div style={{ flex: 1 }} />
          {/* Compare button */}
          {allIterations.length >= 2 && (
            <button onClick={() => navigate(`/compare/${projectId}`)} title="Compare iterations side by side"
              style={{ background: 'transparent', color: t.ts, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <GitCompare size={12} /> Compare
            </button>
          )}
          {/* Export all ZIP */}
          <a href={`/api/preview/download-all/${projectId}`} title="Download all iterations as ZIP"
            style={{ background: 'transparent', color: t.ts, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <Download size={12} /> Export
          </a>
          {/* Fullscreen toggle */}
          <button onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen preview'}
            style={{ background: 'transparent', color: t.ts, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <a href={`/preview/${projectId}`} target="_blank" rel="noreferrer"
            style={{
              color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px',
              background: t.violet, padding: '4px 10px', borderRadius: '6px', textDecoration: 'none',
              fontWeight: '600', boxShadow: `0 0 8px ${t.violetG}`, flexShrink: 0, whiteSpace: 'nowrap',
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Client
          </a>
          {selected && (
            <a href={`/api/preview/${projectId}/${selected.id}`} target="_blank" rel="noreferrer"
              style={{ color: t.ts, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open
            </a>
          )}
        </div>

        <div style={{ flex: 1, background: '#fff', margin: '8px', borderRadius: '8px', border: `1px solid ${t.border}`, overflow: 'hidden', position: 'relative' }}>
          {selected ? (
            <iframe key={previewKey} src={`/api/preview/${projectId}/${selected.id}?v=${previewKey}`}
              style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, background: t.bg }}>
              Select an iteration to preview
            </div>
          )}
        </div>

        {/* Thumbnail Carousel */}
        {!fullscreen && <IterationCarousel
          allIterations={allIterations}
          selected={selected}
          onSelect={handleSelect}
          projectId={projectId}
          previewKey={previewKey}
        />}

        {!fullscreen && <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
          {branchParent !== undefined && (
            <div style={{ fontSize: '10px', color: t.violet, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
              {branchParent === null ? 'Creating new root iteration' : `Branching from ${branchParent.title || 'V' + branchParent.version}`}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <input ref={promptRef} value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && prompt.trim()) handleGenerate(); }}
              placeholder={branchParent !== undefined
                ? (branchParent === null ? 'Describe the landing page to create from scratch...' : `Describe changes to apply from ${branchParent.title || 'V' + branchParent.version}...`)
                : 'Describe adjustments for the next iteration...'}
              style={{ width: '100%', padding: '10px 100px 10px 14px', background: t.surfaceEl, border: `1px solid ${branchParent !== undefined ? 'rgba(139,92,246,0.4)' : t.borderS}`, borderRadius: '8px', color: t.tp, fontSize: '13px', outline: 'none' }} />
            <button onClick={handleGenerate} disabled={!prompt.trim()} style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: prompt.trim() ? t.violet : t.tm, color: '#fff', border: 'none', borderRadius: '4px',
              padding: '6px 12px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px',
              cursor: prompt.trim() ? 'pointer' : 'default', opacity: prompt.trim() ? 1 : 0.5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Generate
            </button>
          </div>
        </div>}
      </main>

      {/* Right Resizer */}
      {!isMobile && !fullscreen && (
        <div onMouseDown={() => setResizing('right')} style={{
          width: '4px', cursor: 'col-resize', background: resizing === 'right' ? t.violet : 'transparent',
          transition: 'background 0.2s', zIndex: 10, flexShrink: 0,
        }} />
      )}

      {/* RIGHT: Terminal + Files Panel */}
      <aside style={{
        width: isMobile ? '100%' : `${rightW}px`,
        background: t.surface, borderLeft: isMobile ? 'none' : `1px solid ${t.border}`,
        display: fullscreen ? 'none' : (isMobile && mobilePanel !== 'terminal' && mobilePanel !== 'files' && mobilePanel !== 'orchestra' ? 'none' : 'flex'),
        flexDirection: 'column', flexShrink: 0,
        height: isMobile ? 'calc(100vh - 53px - 42px)' : 'auto',
      }}>
        {/* Panel type switcher: Terminal | Files | Orchestra */}
        <div style={{
          display: 'flex', borderBottom: `1px solid ${t.border}`, height: '34px', flexShrink: 0,
          background: t.bg,
        }}>
          <button
            onClick={() => { setRightPanel('terminal'); setViewingFile(null); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              background: rightPanel === 'terminal' ? t.surface : 'transparent',
              color: rightPanel === 'terminal' ? t.tp : t.tm,
              border: 'none', borderBottom: rightPanel === 'terminal' ? `2px solid ${t.violet}` : '2px solid transparent',
              fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            Terminal
          </button>
          <button
            onClick={() => setRightPanel('files')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              background: rightPanel === 'files' ? t.surface : 'transparent',
              color: rightPanel === 'files' ? t.tp : t.tm,
              border: 'none', borderBottom: rightPanel === 'files' ? `2px solid ${t.violet}` : '2px solid transparent',
              fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <FolderTree size={12} />
            Files
          </button>
          {project?.mode === 'orchestra' && (
            <button
              onClick={() => setRightPanel('orchestra')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                background: rightPanel === 'orchestra' ? t.surface : 'transparent',
                color: rightPanel === 'orchestra' ? '#F59E0B' : t.tm,
                border: 'none', borderBottom: rightPanel === 'orchestra' ? '2px solid #F59E0B' : '2px solid transparent',
                fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Shield size={12} />
              Orchestra
            </button>
          )}
        </div>

        {rightPanel === 'orchestra' && project?.mode === 'orchestra' ? (
          /* ORCHESTRA PANEL */
          <OrchestraView
            project={project}
            teamMembers={project.team_members || []}
            agents={allAgents}
            onRefresh={refreshProject}
          />
        ) : rightPanel === 'files' ? (
          /* FILE EXPLORER PANEL */
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: viewingFile ? '200px' : '100%', minWidth: '160px', overflow: 'hidden', borderRight: viewingFile ? `1px solid ${t.border}` : 'none', flexShrink: 0 }}>
              <FileExplorer projectId={projectId} onFileSelect={handleFileSelect} selectedFile={viewingFile} />
            </div>
            {viewingFile && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <FileViewer projectId={projectId} filePath={viewingFile} onClose={() => setViewingFile(null)} />
              </div>
            )}
          </div>
        ) : (
          /* TERMINAL PANEL */
          <>
            {claudeStatus && !claudeStatus.installed ? (
              <>
                <div style={{ height: '44px', display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: `1px solid ${t.border}`, gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#f59e0b' }}>Claude CLI Setup Required</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '20px 16px', borderBottom: `1px solid ${t.border}` }}>
                    <p style={{ fontSize: '13px', color: t.ts, margin: '0 0 12px 0', lineHeight: 1.5 }}>
                      Claude Code CLI is not installed on this server. Install it to enable AI-powered iterations.
                    </p>
                    <button onClick={() => {
                      if (setupTerminalRef.current) {
                        setupTerminalRef.current.sendInput('npm install -g @anthropic-ai/claude-code\n');
                      }
                    }} style={{
                      background: t.violet, color: '#fff', border: 'none', borderRadius: '6px',
                      padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                      Install Claude Code CLI
                    </button>
                    <p style={{ fontSize: '10px', color: t.tm, margin: '8px 0 0 0', textAlign: 'center' }}>
                      Runs: <code style={{ background: t.surfaceEl, padding: '2px 4px', borderRadius: '3px' }}>npm install -g @anthropic-ai/claude-code</code>
                    </p>
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <TerminalPanel
                      ref={setupTerminalRef}
                      projectId={projectId}
                      onSessionCreated={() => {}}
                    />
                  </div>
                  <div style={{ padding: '8px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => {
                      api('/api/claude-status').then(s => setClaudeStatus(s)).catch(() => {});
                    }} style={{
                      background: 'transparent', color: t.ts, border: `1px solid ${t.border}`,
                      borderRadius: '4px', padding: '6px 12px', fontSize: '11px', cursor: 'pointer',
                    }}>
                      Check again
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {userClaudeConnected === false && (
                  <div style={{
                    padding: '8px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex',
                    alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.06)', fontSize: '11px',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span style={{ color: '#f59e0b', flex: 1 }}>Claude not authenticated. Run <code style={{ background: t.surfaceEl, padding: '1px 4px', borderRadius: '3px' }}>claude</code> in the terminal to connect.</span>
                    <span onClick={() => navigate('/setup-claude')} style={{ color: t.violet, cursor: 'pointer', fontWeight: '500', fontSize: '11px' }}>Setup</span>
                  </div>
                )}
                <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, height: '36px', flexShrink: 0 }}>
                  {termTabs.map(tab => (
                    <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                      padding: '0 14px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      color: activeTab === tab.id ? t.tp : t.ts,
                      background: activeTab === tab.id ? t.surface : t.bg,
                      borderBottom: activeTab === tab.id ? `2px solid ${t.violet}` : '2px solid transparent',
                      borderRight: `1px solid ${t.border}`,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                      {tab.name}
                      {termTabs.length > 1 && (
                        <span onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                          style={{ marginLeft: '4px', opacity: 0.4, fontSize: '14px', lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0.4}>
                          x
                        </span>
                      )}
                    </div>
                  ))}
                  <div onClick={addTab} style={{ padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', color: t.tm }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  {tabsLoaded && activeTab && (() => {
                    const tab = termTabs.find(t => t.id === activeTab);
                    if (!tab) return null;
                    return (
                      <TerminalPanel
                        ref={terminalRef}
                        key={tab.id}
                        sessionId={tab.sessionId}
                        projectId={projectId}
                        onSessionCreated={(sid) => handleSessionCreated(tab.id, sid)}
                      />
                    );
                  })()}
                </div>
              </>
            )}
          </>
        )}
      </aside>

      {/* Context Menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y,
          background: t.surfaceEl, border: `1px solid ${t.borderS}`, borderRadius: '8px',
          padding: '4px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', minWidth: '160px',
        }}>
          <div onClick={() => { handleBranch(contextMenu.node); setContextMenu(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: t.ts, cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            Branch from here
          </div>
          <div onClick={() => {
              const node = contextMenu.node;
              setContextMenu(null);
              const newTitle = window.prompt('Rename iteration:', node.title || `V${node.version}`);
              if (newTitle && newTitle.trim()) handleRename(node.id, newTitle.trim());
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: t.ts, cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Pencil size={14} />
            Rename
          </div>
          <div onClick={() => {
              handleRestore(contextMenu.node.id);
              setContextMenu(null);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: t.ts, cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <RotateCcw size={14} />
            Restore to workspace
          </div>
          <a href={`/api/preview/download/${projectId}/${contextMenu.node.id}`}
            onClick={() => setContextMenu(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: t.ts, cursor: 'pointer', borderRadius: '4px', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Download size={14} />
            Download ZIP
          </a>
          <div onClick={async () => {
              const node = contextMenu.node;
              setContextMenu(null);
              const name = prompt(`New project name (from ${node.title || 'V' + node.version}):`, `${project?.name || 'Project'} - Fork`);
              if (!name) return;
              const agentChoice = prompt(`Agent name (leave empty to keep "${node.agent_name}"):`, node.agent_name || '');
              try {
                const result = await api('/api/projects/fork', {
                  method: 'POST',
                  body: JSON.stringify({
                    name,
                    agent_name: agentChoice || node.agent_name,
                    source_project_id: projectId,
                    source_iteration_id: node.id,
                  }),
                });
                if (result?.project?.id) navigate(`/project/${result.project.id}`);
              } catch (err) { console.error('Fork error:', err); }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: t.ts, cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/><path d="M3 6v12"/></svg>
            New project from here
          </div>
          <div onClick={() => {
              const node = contextMenu.node;
              setContextMenu(null);
              if (!confirm(`Delete ${node.title || 'V' + node.version}?`)) return;
              api(`/api/iterations/detail/${node.id}`, { method: 'DELETE' }).then(() => {
                api(`/api/iterations/${projectId}/tree`).then(tree => {
                  setTreeData(tree || []);
                  if (selected?.id === node.id) setSelected(null);
                }).catch(() => {});
              }).catch(err => console.error(err));
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
          </div>
        </div>
      )}
    </div>
  );
}

const TYPE_ICONS = { Palette, Code, Settings, Megaphone, BarChart3, Wrench };

function NewProjectForm({ onCreated }) {
  const [mode, setMode] = useState(null); // null | 'solo' | 'orchestra'
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [agent, setAgent] = useState('');
  const [agents, setAgents] = useState([]);
  const [agentTypes, setAgentTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [projectType, setProjectType] = useState('html'); // 'html' | 'fullstack'
  // Orchestra state
  const [orchestraTeam, setOrchestraTeam] = useState({ orchestrator: null, workers: [] });
  const [orchestraReady, setOrchestraReady] = useState(false); // team built, show form

  useEffect(() => {
    api('/api/agents').then(a => setAgents(a || [])).catch(() => {});
    api('/api/agents/types').then(types => setAgentTypes(types || [])).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get('agent')) {
      setAgent(params.get('agent'));
      setMode('solo');
      setSelectedType({ id: 'preselected', label: 'Agent', color: t.violet, icon: 'Wrench', defaults: { category: '' } });
    }
  }, []);

  // Filter agents by type's category
  const filteredAgents = selectedType?.defaults?.category
    ? agents.filter(a => a.category === selectedType.defaults.category || !a.category || a.category === 'uncategorized')
    : agents;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    try {
      const body = { name, description: desc, mode: mode || 'solo', project_type: projectType };

      if (mode === 'orchestra') {
        body.agent_name = orchestraTeam.orchestrator;
        body.team_config = {
          name: `${name} Team`,
          description: `Orchestra team for ${name}`,
          orchestrator: orchestraTeam.orchestrator,
          workers: orchestraTeam.workers.map(w => ({ agent_name: w.agent_name })),
        };
      } else {
        body.agent_name = agent;
      }

      const p = await api('/api/projects', { method: 'POST', body: JSON.stringify(body) });
      onCreated(p.id);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const inputBase = {
    backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '11px 14px', color: '#fff', fontSize: '13px', outline: 'none',
    width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s',
  };

  // ── Step 0: Mode selector ─────────────────────────────────────────
  if (!mode) {
    const modes = [
      {
        id: 'solo', label: 'Solo', icon: User, color: t.violet,
        desc: 'Un seul agent travaille sur le projet',
      },
      {
        id: 'orchestra', label: 'Orchestra', icon: Users, color: '#F59E0B',
        desc: 'Plusieurs agents coordonnes par un orchestrateur',
      },
    ];
    return (
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em', color: t.tp }}>
            Nouveau projet
          </h1>
          <p style={{ fontSize: '14px', color: t.ts, margin: 0, lineHeight: 1.6 }}>
            Choisissez le mode de votre projet
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          {modes.map(m => {
            const IconComp = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = m.color + '60';
                  e.currentTarget.style.backgroundColor = m.color + '08';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = t.border;
                  e.currentTarget.style.backgroundColor = t.surface;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '16px', padding: '32px 24px',
                  backgroundColor: t.surface,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: '14px', cursor: 'pointer',
                  transition: 'all 0.25s ease', textAlign: 'center',
                  color: t.tp,
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: '14px',
                  backgroundColor: m.color + '15',
                  border: `1.5px solid ${m.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconComp size={26} color={m.color} />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: '12px', color: t.tm, lineHeight: 1.5 }}>
                    {m.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Orchestra: Step 1b — Team builder ──────────────────────────────
  if (mode === 'orchestra' && !orchestraReady) {
    return (
      <OrchestraBuilder
        agents={agents}
        team={orchestraTeam}
        onUpdate={setOrchestraTeam}
        onBack={() => { setMode(null); setOrchestraTeam({ orchestrator: null, workers: [] }); }}
        onNext={() => setOrchestraReady(true)}
      />
    );
  }

  // ── Orchestra: Step 2b — Name/desc form ────────────────────────────
  if (mode === 'orchestra' && orchestraReady) {
    return (
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => setOrchestraReady(false)}
            style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: t.tp }}>Nouveau projet</h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
            backgroundColor: '#F59E0B18', color: '#F59E0B', border: '1px solid #F59E0B30',
          }}>
            <Shield size={11} />
            Orchestra
          </div>
        </div>

        {/* Team summary */}
        <div style={{
          background: t.surfaceEl, borderRadius: '10px', padding: '14px', marginBottom: '20px',
          border: `1px solid ${t.border}`,
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Equipe</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
              background: '#F59E0B18', color: '#F59E0B', border: '1px solid #F59E0B30',
            }}>
              <Shield size={10} /> {orchestraTeam.orchestrator}
            </span>
            {orchestraTeam.workers.map(w => (
              <span key={w.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 500,
                background: t.violet + '15', color: t.violet, border: `1px solid ${t.violet}30`,
              }}>
                <User size={10} /> {w.agent_name}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom du projet</label>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="Mon super projet..."
              style={inputBase}
              onFocus={e => e.target.style.borderColor = '#F59E0B'}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
            <input
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Optionnel..."
              style={inputBase}
              onFocus={e => e.target.style.borderColor = '#F59E0B'}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>
          <button type="submit" disabled={saving || !name.trim()} style={{
            background: name.trim() ? '#F59E0B' : t.surfaceEl,
            color: name.trim() ? '#000' : '#fff', border: 'none', borderRadius: '10px',
            padding: '12px', fontSize: '14px', fontWeight: 600,
            opacity: saving || !name.trim() ? 0.5 : 1, cursor: name.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s', marginTop: '4px',
          }}>{saving ? 'Creation...' : 'Creer le projet Orchestra'}</button>
        </form>
      </div>
    );
  }

  // ── Solo: Step 1a — Type selector ──────────────────────────────────
  if (!selectedType) {
    return (
      <div style={{ maxWidth: '700px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => setMode(null)}
            style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em', color: t.tp }}>
              Nouveau projet Solo
            </h1>
            <p style={{ fontSize: '13px', color: t.ts, margin: 0 }}>
              Quel type de projet souhaitez-vous demarrer ?
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {agentTypes.map(type => {
            const IconComp = TYPE_ICONS[type.icon] || Wrench;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(type)}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = type.color + '60';
                  e.currentTarget.style.backgroundColor = type.color + '08';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = t.border;
                  e.currentTarget.style.backgroundColor = t.surface;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: '12px', padding: '20px',
                  backgroundColor: t.surface,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: '12px', cursor: 'pointer',
                  transition: 'all 0.25s ease', textAlign: 'left',
                  color: t.tp,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '10px',
                  backgroundColor: type.color + '15',
                  border: `1px solid ${type.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconComp size={20} color={type.color} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                    {type.label}
                  </div>
                  <div style={{ fontSize: '11px', color: t.tm, lineHeight: 1.5 }}>
                    {type.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Solo: Step 2a — Project form ───────────────────────────────────
  const typeColor = selectedType.color || t.violet;
  const TypeIcon = TYPE_ICONS[selectedType.icon] || Wrench;

  return (
    <div style={{ maxWidth: '480px', width: '100%' }}>
      {/* Header with back + type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => { setSelectedType(null); setAgent(''); }}
          style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: t.tp }}>Nouveau projet</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
          backgroundColor: typeColor + '18', color: typeColor, border: `1px solid ${typeColor}30`,
        }}>
          <TypeIcon size={11} />
          {selectedType.label}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom du projet</label>
          <input
            value={name} onChange={e => setName(e.target.value)} required
            placeholder="Mon super projet..."
            style={inputBase}
            onFocus={e => e.target.style.borderColor = typeColor}
            onBlur={e => e.target.style.borderColor = t.border}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
          <input
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Optionnel..."
            style={inputBase}
            onFocus={e => e.target.style.borderColor = typeColor}
            onBlur={e => e.target.style.borderColor = t.border}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Agent {selectedType.defaults?.category ? `(${selectedType.label})` : ''}
          </label>
          <select
            value={agent} onChange={e => setAgent(e.target.value)}
            style={{ ...inputBase, cursor: 'pointer' }}
          >
            <option value="">Choisir un agent...</option>
            {/* Show matching agents first, then all others */}
            {selectedType.defaults?.category && filteredAgents.filter(a => a.category === selectedType.defaults.category).length > 0 && (
              <optgroup label={`${selectedType.label}`}>
                {filteredAgents.filter(a => a.category === selectedType.defaults.category).map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Tous les agents">
              {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </optgroup>
          </select>
        </div>
        {/* Project Type Toggle */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Type de projet
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { id: 'html', label: 'HTML', desc: 'Fichier unique auto-detect', icon: '<>', color: '#e34f26' },
              { id: 'fullstack', label: 'Fullstack', desc: 'Projet complet avec deps', icon: 'FS', color: '#22c55e' },
            ].map(pt => (
              <button
                key={pt.id}
                type="button"
                onClick={() => setProjectType(pt.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  padding: '12px', borderRadius: '8px', cursor: 'pointer',
                  background: projectType === pt.id ? `${pt.color}10` : t.bg,
                  border: projectType === pt.id ? `2px solid ${pt.color}60` : `1px solid ${t.border}`,
                  color: projectType === pt.id ? pt.color : t.tm,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{pt.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{pt.label}</span>
                <span style={{ fontSize: '10px', color: t.tm, textAlign: 'center' }}>{pt.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={saving || !name.trim()} style={{
          background: name.trim() ? typeColor : t.surfaceEl,
          color: '#fff', border: 'none', borderRadius: '10px',
          padding: '12px', fontSize: '14px', fontWeight: 600,
          opacity: saving || !name.trim() ? 0.5 : 1, cursor: name.trim() ? 'pointer' : 'default',
          transition: 'all 0.2s', marginTop: '4px',
        }}>{saving ? 'Creation...' : 'Creer le projet'}</button>
      </form>
    </div>
  );
}
