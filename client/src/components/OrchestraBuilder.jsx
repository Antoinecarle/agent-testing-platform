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
import { Shield, User, Plus, X, Search, ArrowLeft, ChevronRight, Eye } from 'lucide-react';

const t = {
  bg: '#0a0a0a', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', amber: '#F59E0B', emerald: '#10B981',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

// ── Custom Node: Orchestrator ────────────────────────────────────
function OrchestratorNode({ data }) {
  const selected = data._selecting;
  return (
    <div style={{
      background: t.surface,
      border: `2px solid ${selected ? '#fff' : t.amber}`,
      borderRadius: '16px',
      padding: '20px 32px',
      minWidth: '220px',
      textAlign: 'center',
      boxShadow: selected
        ? `0 0 0 3px ${t.amber}40, 0 8px 32px rgba(0,0,0,0.5)`
        : `0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${t.amber}10`,
      transition: 'all 0.2s ease',
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
      {data.agentName ? (
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.tp }}>{data.agentName}</div>
          {data.category && (
            <div style={{ fontSize: '11px', color: t.ts, marginTop: '4px' }}>{data.category}</div>
          )}
        </div>
      ) : (
        <div style={{
          fontSize: '12px', color: t.amber, padding: '6px 12px',
          background: t.amber + '10', borderRadius: '8px', marginTop: '4px',
        }}>
          Cliquer pour choisir
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: t.amber, width: 10, height: 10, border: `2px solid ${t.surface}` }} />
    </div>
  );
}

// ── Custom Node: Reviewer ────────────────────────────────────────
function ReviewerNode({ data }) {
  const selected = data._selecting;
  return (
    <div style={{
      background: t.surface,
      border: `1.5px solid ${selected ? '#fff' : t.emerald + '60'}`,
      borderRadius: '14px',
      padding: '16px 24px',
      minWidth: '180px',
      textAlign: 'center',
      position: 'relative',
      boxShadow: selected
        ? `0 0 0 3px ${t.emerald}40, 0 8px 32px rgba(0,0,0,0.5)`
        : `0 4px 20px rgba(0,0,0,0.3)`,
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: t.emerald, width: 8, height: 8, border: `2px solid ${t.surface}` }} />
      <Handle type="source" position={Position.Bottom} style={{ background: t.emerald, width: 8, height: 8, border: `2px solid ${t.surface}` }} />
      {data.onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onRemove(); }}
          style={{
            position: 'absolute', top: -10, right: -10,
            width: 22, height: 22, borderRadius: '50%',
            background: '#ef4444', border: `2px solid ${t.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0, zIndex: 10,
          }}
        >
          <X size={10} color="#fff" />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
        <Eye size={13} color={t.emerald} />
        <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.emerald }}>
          Reviewer
        </span>
      </div>
      {data.agentName ? (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: t.tp }}>{data.agentName}</div>
          {data.category && (
            <div style={{ fontSize: '10px', color: t.ts, marginTop: '4px' }}>{data.category}</div>
          )}
        </div>
      ) : (
        <div style={{
          fontSize: '12px', color: t.emerald, padding: '6px 12px',
          background: t.emerald + '10', borderRadius: '8px', marginTop: '4px',
        }}>
          Choisir un reviewer
        </div>
      )}
    </div>
  );
}

// ── Custom Node: Worker ──────────────────────────────────────────
function WorkerNode({ data }) {
  const selected = data._selecting;
  return (
    <div style={{
      background: t.surface,
      border: `1.5px solid ${selected ? '#fff' : t.violet + '60'}`,
      borderRadius: '14px',
      padding: '16px 24px',
      minWidth: '180px',
      textAlign: 'center',
      position: 'relative',
      boxShadow: selected
        ? `0 0 0 3px ${t.violet}40, 0 8px 32px rgba(0,0,0,0.5)`
        : `0 4px 20px rgba(0,0,0,0.3)`,
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: t.violet, width: 8, height: 8, border: `2px solid ${t.surface}` }} />
      {data.onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onRemove(); }}
          style={{
            position: 'absolute', top: -10, right: -10,
            width: 22, height: 22, borderRadius: '50%',
            background: '#ef4444', border: `2px solid ${t.bg}`,
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
      {data.agentName ? (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: t.tp }}>{data.agentName}</div>
          {data.category && (
            <div style={{ fontSize: '10px', color: t.ts, marginTop: '4px' }}>{data.category}</div>
          )}
        </div>
      ) : (
        <div style={{
          fontSize: '12px', color: t.violet, padding: '6px 12px',
          background: t.violet + '10', borderRadius: '8px', marginTop: '4px',
        }}>
          Choisir un agent
        </div>
      )}
    </div>
  );
}

const nodeTypes = { orchestrator: OrchestratorNode, reviewer: ReviewerNode, worker: WorkerNode };

// ── Layout helpers ───────────────────────────────────────────────
function buildNodes(orchestrator, reviewers, workers, agents, onRemoveReviewer, onRemoveWorker, selectingFor) {
  const nodes = [];
  const orchAgent = agents.find(a => a.name === orchestrator);

  nodes.push({
    id: 'orchestrator',
    type: 'orchestrator',
    position: { x: 400, y: 60 },
    data: {
      agentName: orchestrator || null,
      category: orchAgent?.category || '',
      _selecting: selectingFor === 'orchestrator',
    },
    draggable: true,
  });

  // Reviewers layer (y=200)
  const reviewerSpacing = 240;
  const reviewerTotalWidth = (reviewers.length - 1) * reviewerSpacing;
  const reviewerStartX = 400 - reviewerTotalWidth / 2;

  reviewers.forEach((r, i) => {
    const rAgent = agents.find(a => a.name === r.agent_name);
    nodes.push({
      id: r.id,
      type: 'reviewer',
      position: { x: reviewerStartX + i * reviewerSpacing, y: 200 },
      data: {
        agentName: r.agent_name,
        category: rAgent?.category || '',
        onRemove: () => onRemoveReviewer(r.id),
        _selecting: selectingFor === r.id,
      },
      draggable: true,
    });
  });

  // Workers layer (y=340 if reviewers exist, y=280 if not)
  const workerY = reviewers.length > 0 ? 340 : 280;
  const spacing = 240;
  const totalWidth = (workers.length - 1) * spacing;
  const startX = 400 - totalWidth / 2;

  workers.forEach((w, i) => {
    const wAgent = agents.find(a => a.name === w.agent_name);
    nodes.push({
      id: w.id,
      type: 'worker',
      position: { x: startX + i * spacing, y: workerY },
      data: {
        agentName: w.agent_name,
        category: wAgent?.category || '',
        onRemove: () => onRemoveWorker(w.id),
        _selecting: selectingFor === w.id,
      },
      draggable: true,
    });
  });

  return nodes;
}

function buildEdges(reviewers, workers) {
  const edges = [];

  if (reviewers.length > 0) {
    // Orchestrator → Reviewers
    reviewers.forEach(r => {
      edges.push({
        id: `e-orch-${r.id}`,
        source: 'orchestrator',
        target: r.id,
        animated: true,
        style: { stroke: t.emerald + '80', strokeWidth: 2 },
        type: 'smoothstep',
      });
    });
    // Reviewers → Workers
    workers.forEach(w => {
      reviewers.forEach(r => {
        edges.push({
          id: `e-${r.id}-${w.id}`,
          source: r.id,
          target: w.id,
          animated: true,
          style: { stroke: t.violet + '60', strokeWidth: 1.5 },
          type: 'smoothstep',
        });
      });
    });
  } else {
    // Direct: Orchestrator → Workers
    workers.forEach(w => {
      edges.push({
        id: `e-orch-${w.id}`,
        source: 'orchestrator',
        target: w.id,
        animated: true,
        style: { stroke: t.violet + '80', strokeWidth: 2 },
        type: 'smoothstep',
      });
    });
  }

  return edges;
}

// ── Agent Picker Panel (overlay) ─────────────────────────────────
function AgentPicker({ agents, selectingFor, pickerRole, search, setSearch, onSelect, onClose, usedAgents }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, [selectingFor]);

  const filtered = agents.filter(a =>
    !usedAgents.has(a.name) &&
    (a.name.toLowerCase().includes(search.toLowerCase()) ||
     (a.category || '').toLowerCase().includes(search.toLowerCase()) ||
     (a.description || '').toLowerCase().includes(search.toLowerCase()))
  );

  const isOrchestrator = pickerRole === 'orchestrator';
  const isReviewer = pickerRole === 'reviewer';
  const accentColor = isOrchestrator ? t.amber : isReviewer ? t.emerald : t.violet;
  const IconComp = isOrchestrator ? Shield : isReviewer ? Eye : User;
  const label = isOrchestrator ? 'Orchestrateur' : isReviewer ? 'Agent reviewer' : 'Agent worker';

  return (
    <div style={{
      position: 'absolute', top: '16px', right: '16px', bottom: '80px',
      width: '280px', background: t.surface + 'f5', borderRadius: '16px',
      border: `1px solid ${t.borderS}`, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', zIndex: 20,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '6px',
            background: accentColor + '20',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconComp size={12} color={accentColor} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: accentColor }}>
            {label}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          color: t.tm, display: 'flex',
        }}>
          <X size={14} />
        </button>
      </div>

      {/* Search */}
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

      {/* Agent list */}
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
                background: accentColor + '15',
                border: `1px solid ${accentColor}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <IconComp size={14} color={accentColor} />
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

// ── Inner Component (needs ReactFlowProvider parent) ─────────────
function OrchestraBuilderInner({ agents, team, onUpdate, onBack, onNext }) {
  const [search, setSearch] = useState('');
  const [selectingFor, setSelectingFor] = useState(null);
  const [pickerRole, setPickerRole] = useState(null); // 'orchestrator' | 'reviewer' | 'worker'
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlow = useReactFlow();

  const reviewers = team.reviewers || [];

  const removeWorker = useCallback((workerId) => {
    onUpdate({ ...team, workers: team.workers.filter(w => w.id !== workerId) });
    if (selectingFor === workerId) { setSelectingFor(null); setPickerRole(null); }
  }, [team, onUpdate, selectingFor]);

  const removeReviewer = useCallback((reviewerId) => {
    onUpdate({ ...team, reviewers: (team.reviewers || []).filter(r => r.id !== reviewerId) });
    if (selectingFor === reviewerId) { setSelectingFor(null); setPickerRole(null); }
  }, [team, onUpdate, selectingFor]);

  // Rebuild nodes/edges when team or selection changes
  useMemo(() => {
    const n = buildNodes(team.orchestrator, reviewers, team.workers, agents, removeReviewer, removeWorker, selectingFor);
    const e = buildEdges(reviewers, team.workers);
    setNodes(n);
    setEdges(e);
  }, [team.orchestrator, team.workers, reviewers, agents, removeReviewer, removeWorker, selectingFor]);

  // Fit view when members change
  useEffect(() => {
    const timer = setTimeout(() => { reactFlow.fitView({ padding: 0.3, duration: 300 }); }, 100);
    return () => clearTimeout(timer);
  }, [team.workers.length, reviewers.length, team.orchestrator]);

  const addWorker = () => {
    const newWorker = { agent_name: '', id: crypto.randomUUID() };
    onUpdate({ ...team, workers: [...team.workers, newWorker] });
    setSelectingFor(newWorker.id);
    setPickerRole('worker');
  };

  const addReviewer = () => {
    const newReviewer = { agent_name: '', id: crypto.randomUUID() };
    onUpdate({ ...team, reviewers: [...reviewers, newReviewer] });
    setSelectingFor(newReviewer.id);
    setPickerRole('reviewer');
  };

  const selectAgent = (agentName) => {
    if (selectingFor === 'orchestrator') {
      onUpdate({ ...team, orchestrator: agentName });
    } else if (selectingFor) {
      // Check if selecting for a reviewer or worker
      const isReviewerNode = reviewers.some(r => r.id === selectingFor);
      if (isReviewerNode) {
        onUpdate({
          ...team,
          reviewers: reviewers.map(r =>
            r.id === selectingFor ? { ...r, agent_name: agentName } : r
          ),
        });
      } else {
        onUpdate({
          ...team,
          workers: team.workers.map(w =>
            w.id === selectingFor ? { ...w, agent_name: agentName } : w
          ),
        });
      }
    }
    setSelectingFor(null);
    setPickerRole(null);
    setSearch('');
  };

  const usedAgents = new Set([
    team.orchestrator,
    ...reviewers.map(r => r.agent_name),
    ...team.workers.map(w => w.agent_name),
  ].filter(Boolean));
  const canProceed = team.orchestrator && team.workers.length > 0 && team.workers.every(w => w.agent_name) && reviewers.every(r => r.agent_name);
  const workerCount = team.workers.filter(w => w.agent_name).length;
  const reviewerCount = reviewers.filter(r => r.agent_name).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: t.bg, display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: `1px solid ${t.border}`,
        background: t.surface + 'cc', backdropFilter: 'blur(12px)',
        zIndex: 10, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{
            background: t.surfaceEl, border: `1px solid ${t.border}`, borderRadius: '8px',
            color: t.ts, cursor: 'pointer', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.borderS}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
          >
            <ArrowLeft size={14} />
            Retour
          </button>
          <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: t.tp }}>Composer l'orchestre</h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: 700,
            backgroundColor: t.amber + '18', color: t.amber, border: `1px solid ${t.amber}30`,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <Shield size={10} />
            Orchestra
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: t.tm }}>
            {team.orchestrator ? <span style={{ color: t.amber }}>{team.orchestrator}</span> : 'Pas d\'orchestrateur'}
            {reviewerCount > 0 && (
              <>
                <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                <span style={{ color: t.emerald }}>{reviewerCount}</span> reviewer{reviewerCount !== 1 ? 's' : ''}
              </>
            )}
            <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
            <span style={{ color: t.violet }}>{workerCount}</span> agent{workerCount !== 1 ? 's' : ''}
          </div>
          <button
            onClick={onNext}
            disabled={!canProceed}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 20px', borderRadius: '10px',
              background: canProceed ? t.amber : t.surfaceEl,
              color: canProceed ? '#000' : t.tm,
              border: 'none', fontSize: '13px', fontWeight: 600,
              cursor: canProceed ? 'pointer' : 'default',
              opacity: canProceed ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
          >
            Continuer
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Canvas (full remaining space) */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            const id = node.id === 'orchestrator' ? 'orchestrator' : node.id;
            const role = node.id === 'orchestrator' ? 'orchestrator' : node.type === 'reviewer' ? 'reviewer' : 'worker';
            setSelectingFor(prev => prev === id ? null : id);
            setPickerRole(prev => prev === role && selectingFor === id ? null : role);
          }}
          onPaneClick={() => { setSelectingFor(null); setPickerRole(null); }}
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

        {/* Floating add buttons */}
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '10px', zIndex: 10,
        }}>
          <button
            onClick={addReviewer}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '12px',
              background: t.emerald, border: 'none',
              color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              boxShadow: `0 4px 20px ${t.emerald}40, 0 8px 32px rgba(0,0,0,0.4)`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 24px ${t.emerald}60, 0 12px 40px rgba(0,0,0,0.5)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${t.emerald}40, 0 8px 32px rgba(0,0,0,0.4)`; }}
          >
            <Eye size={16} />
            Ajouter un reviewer
          </button>
          <button
            onClick={addWorker}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '12px',
              background: t.violet, border: 'none',
              color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              boxShadow: `0 4px 20px ${t.violet}40, 0 8px 32px rgba(0,0,0,0.4)`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 24px ${t.violet}60, 0 12px 40px rgba(0,0,0,0.5)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${t.violet}40, 0 8px 32px rgba(0,0,0,0.4)`; }}
          >
            <Plus size={16} />
            Ajouter un agent
          </button>
        </div>

        {/* Agent picker overlay */}
        {selectingFor && (
          <AgentPicker
            agents={agents}
            selectingFor={selectingFor}
            pickerRole={pickerRole || 'worker'}
            search={search}
            setSearch={setSearch}
            onSelect={selectAgent}
            onClose={() => { setSelectingFor(null); setPickerRole(null); setSearch(''); }}
            usedAgents={usedAgents}
          />
        )}
      </div>
    </div>
  );
}

// ── Main export (wrapped in provider) ────────────────────────────
export default function OrchestraBuilder(props) {
  return (
    <ReactFlowProvider>
      <OrchestraBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
