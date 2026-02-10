import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, getUser } from '../api';
import TerminalPanel from '../components/TerminalPanel';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

function TreeNode({ node, level = 0, selected, onSelect, onContext, onBranch, isLast = false }) {
  const isSelected = selected?.id === node.id;
  const [hovered, setHovered] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isRoot = level === 0;

  return (
    <div style={{ position: 'relative' }}>
      {/* Vertical connector line from parent */}
      {!isRoot && (
        <div style={{
          position: 'absolute', left: `${(level - 1) * 20 + 9}px`, top: 0,
          width: '1px', height: isLast ? '16px' : '100%',
          background: 'rgba(139,92,246,0.15)',
        }} />
      )}
      {/* Horizontal connector to node */}
      {!isRoot && (
        <div style={{
          position: 'absolute', left: `${(level - 1) * 20 + 9}px`, top: '16px',
          width: '11px', height: '1px',
          background: 'rgba(139,92,246,0.15)',
        }} />
      )}

      <div style={{ marginLeft: `${level * 20}px` }}>
        <div
          onClick={() => onSelect(node)}
          onContextMenu={e => { e.preventDefault(); onContext({ x: e.clientX, y: e.clientY, node }); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            padding: '4px 8px', margin: '1px 0', borderRadius: '6px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
            background: isSelected ? 'rgba(139,92,246,0.12)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
            border: isSelected ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
            transition: 'all 0.15s',
          }}
        >
          {/* Collapse/expand or dot indicator */}
          {hasChildren ? (
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
          )}

          {/* Title */}
          <span style={{
            color: isSelected ? t.tp : t.ts, flex: 1, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isRoot ? '500' : '400',
          }}>
            {node.title || `V${node.version}`}
          </span>

          {/* Branch button on hover */}
          {hovered && (
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

          {/* Children count badge */}
          {hasChildren && collapsed && (
            <span style={{ background: 'rgba(255,255,255,0.06)', color: t.tm, padding: '0 4px', borderRadius: '3px', fontSize: '9px', fontWeight: '600' }}>
              {node.children.length}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && !collapsed && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode key={child.id} node={child} level={level + 1} selected={selected}
              onSelect={onSelect} onContext={onContext} onBranch={onBranch}
              isLast={i === node.children.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function IterationCarousel({ allIterations, selected, onSelect, projectId }) {
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
                  <iframe src={`/api/preview/${projectId}/${iteration.id}`}
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
  const terminalRef = useRef(null);
  const setupTerminalRef = useRef(null);
  const promptRef = useRef(null);

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
        const [p, tree, savedTabs] = await Promise.all([
          api(`/api/projects/${projectId}`),
          api(`/api/iterations/${projectId}/tree`),
          api(`/api/terminal-tabs/${projectId}`),
        ]);
        setProject(p);
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

  // Listen for auto-imported iterations via Socket.IO
  useEffect(() => {
    if (!projectId || projectId === 'new') return;
    const socket = io({ transports: ['websocket'] });

    socket.on('iteration-created', (data) => {
      if (data.projectId === projectId) {
        // Refresh the tree
        api(`/api/iterations/${projectId}/tree`).then(tree => {
          setTreeData(tree || []);
          if (data.iteration) setSelected(data.iteration);
        }).catch(() => {});
      }
    });

    return () => socket.disconnect();
  }, [projectId]);

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
      <div style={{ padding: '24px', maxWidth: '500px', width: '100%', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>New Project</h1>
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
          ].map(tab => (
            <button key={tab.id} onClick={() => setMobilePanel(tab.id)} style={{
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
        display: isMobile && mobilePanel !== 'tree' ? 'none' : 'flex',
        flexDirection: 'column', flexShrink: 0,
        height: isMobile ? 'calc(100vh - 53px - 42px)' : 'auto',
      }}>
        <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Worktree</span>
          <button onClick={handleNewRoot} style={{ background: t.tp, color: t.bg, border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New
          </button>
        </div>
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
            <TreeNode key={node.id} node={node} selected={selected} onSelect={handleSelect} onContext={setContextMenu} onBranch={handleBranch} />
          ))}
          {treeData.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: t.tm }}>No iterations yet</div>
          )}
        </div>
      </aside>

      {/* Left Resizer */}
      {!isMobile && (
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
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px', fontSize: '12px', color: t.ts, flexShrink: 0,
        }}>
          <span style={{ color: t.tp, fontWeight: '500' }}>{project?.name || 'Loading...'}</span>
          {selected && <>
            <span style={{ color: t.tm }}>/</span>
            <span>{selected.title || `V${selected.version}`}</span>
            <span style={{ background: t.violetM, color: t.violet, padding: '1px 6px', borderRadius: '99px', fontSize: '10px', fontWeight: '600' }}>
              {selected.agent_name}
            </span>
          </>}
          <div style={{ flex: 1 }} />
          <a href={`/preview/${projectId}`} target="_blank" rel="noreferrer"
            style={{
              color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px',
              background: t.violet, padding: '4px 10px', borderRadius: '6px', textDecoration: 'none',
              fontWeight: '600', boxShadow: `0 0 8px ${t.violetG}`,
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Client Preview
          </a>
          {selected && (
            <a href={`/api/preview/${projectId}/${selected.id}`} target="_blank" rel="noreferrer"
              style={{ color: t.ts, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open
            </a>
          )}
        </div>

        <div style={{ flex: 1, background: '#fff', margin: '8px', borderRadius: '8px', border: `1px solid ${t.border}`, overflow: 'hidden', position: 'relative' }}>
          {selected ? (
            <iframe src={`/api/preview/${projectId}/${selected.id}`}
              style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, background: t.bg }}>
              Select an iteration to preview
            </div>
          )}
        </div>

        {/* Thumbnail Carousel */}
        <IterationCarousel
          allIterations={allIterations}
          selected={selected}
          onSelect={handleSelect}
          projectId={projectId}
        />

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
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
        </div>
      </main>

      {/* Right Resizer */}
      {!isMobile && (
        <div onMouseDown={() => setResizing('right')} style={{
          width: '4px', cursor: 'col-resize', background: resizing === 'right' ? t.violet : 'transparent',
          transition: 'background 0.2s', zIndex: 10, flexShrink: 0,
        }} />
      )}

      {/* RIGHT: Terminal */}
      <aside style={{
        width: isMobile ? '100%' : `${rightW}px`,
        background: t.surface, borderLeft: isMobile ? 'none' : `1px solid ${t.border}`,
        display: isMobile && mobilePanel !== 'terminal' ? 'none' : 'flex',
        flexDirection: 'column', flexShrink: 0,
        height: isMobile ? 'calc(100vh - 53px - 42px)' : 'auto',
      }}>
        {claudeStatus && !claudeStatus.installed ? (
          /* Claude CLI not installed — Setup screen */
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
          /* Claude installed — Normal terminal tabs */
          <>
            {/* Per-user Claude auth banner */}
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
            <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, height: '44px', flexShrink: 0 }}>
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

function NewProjectForm({ onCreated }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [agent, setAgent] = useState('');
  const [agents, setAgents] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/agents').then(a => setAgents(a || [])).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get('agent')) setAgent(params.get('agent'));
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    try {
      const p = await api('/api/projects', { method: 'POST', body: JSON.stringify({ name, description: desc, agent_name: agent }) });
      onCreated(p.id);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: t.ts, marginBottom: '6px' }}>Project Name</label>
        <input value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%' }} placeholder="My Landing Page Test" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: t.ts, marginBottom: '6px' }}>Description</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} style={{ width: '100%' }} placeholder="Optional description" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: t.ts, marginBottom: '6px' }}>Agent</label>
        <select value={agent} onChange={e => setAgent(e.target.value)} style={{ width: '100%' }}>
          <option value="">Select agent...</option>
          {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={saving} style={{
        background: t.tp, color: t.bg, border: 'none', borderRadius: '4px',
        padding: '10px', fontSize: '13px', fontWeight: '600', opacity: saving ? 0.7 : 1,
      }}>{saving ? 'Creating...' : 'Create Project'}</button>
    </form>
  );
}
