import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Shield, User, Plus, X, Search, RefreshCw } from 'lucide-react';
import { api } from '../api';

const t = {
  bg: '#0a0a0a', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', amber: '#F59E0B',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', danger: '#ef4444',
};

// ── Custom Node: Orchestrator ──────────────────────────────────
function OrchestratorNode({ data }) {
  return (
    <div style={{
      background: t.surface,
      border: `2px solid ${t.amber}`,
      borderRadius: '16px',
      padding: '20px 32px',
      minWidth: '220px',
      textAlign: 'center',
      boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${t.amber}10`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '10px',
          backgroundColor: t.amber + '20', border: `1px solid ${t.amber}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={16} color={t.amber} />
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.amber }}>
          Orchestrateur
        </span>
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: t.tp }}>{data.agentName}</div>
      {data.category && (
        <div style={{ fontSize: '11px', color: t.ts, marginTop: '4px' }}>{data.category}</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: t.amber, width: 10, height: 10, border: `2px solid ${t.surface}` }} />
    </div>
  );
}

// ── Custom Node: Worker ──────────────────────────────────────────
function WorkerNode({ data }) {
  return (
    <div style={{
      background: t.surface,
      border: `1.5px solid ${t.violet}60`,
      borderRadius: '14px',
      padding: '16px 24px',
      minWidth: '180px',
      textAlign: 'center',
      position: 'relative',
      boxShadow: `0 4px 20px rgba(0,0,0,0.3)`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: t.violet, width: 8, height: 8, border: `2px solid ${t.surface}` }} />
      {data.onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onRemove(); }}
          style={{
            position: 'absolute', top: -10, right: -10,
            width: 22, height: 22, borderRadius: '50%',
            background: t.danger, border: `2px solid ${t.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0, zIndex: 10,
          }}
        >
          <X size={10} color="#fff" />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
        <User size={13} color={t.violet} />
        <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.violet }}>
          Agent
        </span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: t.tp }}>{data.agentName}</div>
      {data.category && (
        <div style={{ fontSize: '10px', color: t.ts, marginTop: '4px' }}>{data.category}</div>
      )}
    </div>
  );
}

const nodeTypes = { orchestrator: OrchestratorNode, worker: WorkerNode };

// ── Agent Picker Panel ─────────────────────────────────────────
function AgentPicker({ agents, search, setSearch, onSelect, onClose, usedAgents }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = agents.filter(a =>
    !usedAgents.has(a.name) &&
    (a.name.toLowerCase().includes(search.toLowerCase()) ||
     (a.category || '').toLowerCase().includes(search.toLowerCase()) ||
     (a.description || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{
      position: 'absolute', top: '16px', right: '16px', bottom: '80px',
      width: '280px', background: t.surface + 'f5', borderRadius: '16px',
      border: `1px solid ${t.borderS}`, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', zIndex: 20,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '6px',
            background: t.violet + '20',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={12} color={t.violet} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: t.violet }}>
            Ajouter un agent
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          color: t.tm, display: 'flex',
        }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} color={t.tm} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher un agent..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: t.bg, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '9px 10px 9px 32px', color: '#fff', fontSize: '12px', outline: 'none',
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '12px', color: t.tm }}>
            {search ? 'Aucun agent trouve' : 'Tous les agents sont utilises'}
          </div>
        ) : (
          filtered.map(a => (
            <button
              key={a.name}
              onClick={() => onSelect(a.name)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px',
                background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.surfaceEl}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 34, height: 34, borderRadius: '9px',
                background: t.violet + '15',
                border: `1px solid ${t.violet}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <User size={14} color={t.violet} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: t.tp, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.name}
                </div>
                <div style={{ fontSize: '10px', color: t.tm, marginTop: '2px' }}>
                  {a.category || 'Sans categorie'}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Inner Component ──────────────────────────────────────────────
function OrchestraViewInner({ project, teamMembers, agents, onRefresh }) {
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [saving, setSaving] = useState(false);
  const reactFlow = useReactFlow();

  const orchestrator = teamMembers.find(m => m.role === 'leader');
  const workers = teamMembers.filter(m => m.role !== 'leader');

  const refreshWorkspace = useCallback(() => {
    api(`/api/projects/${project.id}/refresh-workspace`, { method: 'POST' }).catch(() => {});
  }, [project.id]);

  const removeWorker = useCallback(async (agentName) => {
    if (!project.team_id) return;
    setSaving(true);
    try {
      await api(`/api/agent-teams/${project.team_id}/members/${agentName}`, { method: 'DELETE' });
      onRefresh();
      refreshWorkspace();
    } catch (err) {
      console.error('[OrchestraView] Remove error:', err);
    } finally {
      setSaving(false);
    }
  }, [project.team_id, onRefresh, refreshWorkspace]);

  const addWorker = useCallback(async (agentName) => {
    if (!project.team_id) return;
    setSaving(true);
    try {
      await api(`/api/agent-teams/${project.team_id}/members`, {
        method: 'POST',
        body: JSON.stringify({ agent_name: agentName, role: 'member' }),
      });
      setShowPicker(false);
      setSearch('');
      onRefresh();
      refreshWorkspace();
    } catch (err) {
      console.error('[OrchestraView] Add error:', err);
    } finally {
      setSaving(false);
    }
  }, [project.team_id, onRefresh, refreshWorkspace]);

  // Build nodes/edges from team members
  useMemo(() => {
    const n = [];
    const e = [];

    if (orchestrator) {
      const orchAgent = agents.find(a => a.name === orchestrator.agent_name);
      n.push({
        id: 'orchestrator',
        type: 'orchestrator',
        position: { x: 400, y: 60 },
        data: {
          agentName: orchestrator.agent_name,
          category: orchAgent?.category || orchestrator.category || '',
        },
        draggable: true,
      });
    }

    const spacing = 240;
    const totalWidth = (workers.length - 1) * spacing;
    const startX = 400 - totalWidth / 2;

    workers.forEach((w, i) => {
      const wAgent = agents.find(a => a.name === w.agent_name);
      const nodeId = `worker-${w.agent_name}`;
      n.push({
        id: nodeId,
        type: 'worker',
        position: { x: startX + i * spacing, y: 280 },
        data: {
          agentName: w.agent_name,
          category: wAgent?.category || w.category || '',
          onRemove: () => removeWorker(w.agent_name),
        },
        draggable: true,
      });

      if (orchestrator) {
        e.push({
          id: `e-orch-${nodeId}`,
          source: 'orchestrator',
          target: nodeId,
          animated: true,
          style: { stroke: t.violet + '80', strokeWidth: 2 },
          type: 'smoothstep',
        });
      }
    });

    setNodes(n);
    setEdges(e);
  }, [teamMembers, agents, removeWorker]);

  // Fit view when members change
  useEffect(() => {
    const timer = setTimeout(() => { reactFlow.fitView({ padding: 0.3, duration: 300 }); }, 100);
    return () => clearTimeout(timer);
  }, [teamMembers.length]);

  const usedAgents = new Set(teamMembers.map(m => m.agent_name).filter(Boolean));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Orchestra
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            padding: '2px 7px', borderRadius: '99px', fontSize: '9px', fontWeight: 700,
            background: t.amber + '18', color: t.amber, border: `1px solid ${t.amber}30`,
          }}>
            <Shield size={8} />
            {orchestrator?.agent_name || '?'}
          </span>
          <span style={{ fontSize: '10px', color: t.tm }}>
            + {workers.length} agent{workers.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onRefresh}
          style={{
            background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
            padding: '2px', display: 'flex', alignItems: 'center',
          }}
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={() => setShowPicker(false)}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: t.bg }}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background color={t.tm} gap={24} size={1} style={{ opacity: 0.15 }} />
          <Controls
            style={{ background: t.surfaceEl, borderColor: t.border, borderRadius: '10px', overflow: 'hidden' }}
            showInteractive={false}
          />
        </ReactFlow>

        {/* Floating add button */}
        <button
          onClick={() => setShowPicker(true)}
          disabled={saving}
          style={{
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 20px', borderRadius: '10px',
            background: t.violet, border: 'none',
            color: '#fff', fontSize: '12px', fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer', zIndex: 10,
            boxShadow: `0 4px 20px ${t.violet}40, 0 8px 32px rgba(0,0,0,0.4)`,
            opacity: saving ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (!saving) { e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)'; } }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(-50%)'; }}
        >
          <Plus size={14} />
          Ajouter un agent
        </button>

        {/* Agent picker overlay */}
        {showPicker && (
          <AgentPicker
            agents={agents}
            search={search}
            setSearch={setSearch}
            onSelect={addWorker}
            onClose={() => { setShowPicker(false); setSearch(''); }}
            usedAgents={usedAgents}
          />
        )}
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────
export default function OrchestraView(props) {
  return (
    <ReactFlowProvider>
      <OrchestraViewInner {...props} />
    </ReactFlowProvider>
  );
}
