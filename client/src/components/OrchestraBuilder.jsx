import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Shield, User, Plus, X, Search, ArrowLeft, ChevronRight } from 'lucide-react';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', amber: '#F59E0B',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

// ── Custom Node: Orchestrator ────────────────────────────────────
function OrchestratorNode({ data }) {
  return (
    <div style={{
      background: t.surface,
      border: `2px solid ${t.amber}`,
      borderRadius: '14px',
      padding: '16px 24px',
      minWidth: '200px',
      textAlign: 'center',
      boxShadow: `0 0 24px ${t.amber}15`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '8px',
          backgroundColor: t.amber + '20', border: `1px solid ${t.amber}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={14} color={t.amber} />
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.amber }}>
          Orchestrateur
        </span>
      </div>
      {data.agentName ? (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: t.tp }}>{data.agentName}</div>
          {data.category && (
            <div style={{ fontSize: '10px', color: t.tm, marginTop: '4px' }}>{data.category}</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: t.tm, fontStyle: 'italic' }}>Cliquer pour choisir...</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: t.amber, width: 8, height: 8, border: `2px solid ${t.surface}` }} />
    </div>
  );
}

// ── Custom Node: Worker ──────────────────────────────────────────
function WorkerNode({ data }) {
  return (
    <div style={{
      background: t.surface,
      border: `1.5px solid ${t.violet}60`,
      borderRadius: '12px',
      padding: '14px 20px',
      minWidth: '170px',
      textAlign: 'center',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: t.violet, width: 7, height: 7, border: `2px solid ${t.surface}` }} />
      {data.onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onRemove(); }}
          style={{
            position: 'absolute', top: -8, right: -8,
            width: 20, height: 20, borderRadius: '50%',
            background: '#ef4444', border: `2px solid ${t.surface}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <X size={10} color="#fff" />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
        <User size={12} color={t.violet} />
        <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.violet }}>
          Agent
        </span>
      </div>
      {data.agentName ? (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: t.tp }}>{data.agentName}</div>
          {data.category && (
            <div style={{ fontSize: '10px', color: t.tm, marginTop: '3px' }}>{data.category}</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '11px', color: t.tm, fontStyle: 'italic' }}>Choisir...</div>
      )}
    </div>
  );
}

const nodeTypes = { orchestrator: OrchestratorNode, worker: WorkerNode };

// ── Layout helpers ───────────────────────────────────────────────
function buildNodes(orchestrator, workers, agents, onRemoveWorker) {
  const nodes = [];
  const orchAgent = agents.find(a => a.name === orchestrator);

  nodes.push({
    id: 'orchestrator',
    type: 'orchestrator',
    position: { x: 300, y: 40 },
    data: {
      agentName: orchestrator || null,
      category: orchAgent?.category || '',
    },
    draggable: true,
  });

  const startX = 300 - ((workers.length - 1) * 110);
  workers.forEach((w, i) => {
    const wAgent = agents.find(a => a.name === w.agent_name);
    nodes.push({
      id: w.id,
      type: 'worker',
      position: { x: startX + i * 220, y: 220 },
      data: {
        agentName: w.agent_name,
        category: wAgent?.category || '',
        onRemove: () => onRemoveWorker(w.id),
      },
      draggable: true,
    });
  });

  return nodes;
}

function buildEdges(workers) {
  return workers.map(w => ({
    id: `e-orch-${w.id}`,
    source: 'orchestrator',
    target: w.id,
    animated: true,
    style: { stroke: t.violet, strokeWidth: 2 },
  }));
}

// ── Main Component ───────────────────────────────────────────────
export default function OrchestraBuilder({ agents, team, onUpdate, onBack, onNext }) {
  const [search, setSearch] = useState('');
  const [selectingFor, setSelectingFor] = useState(null); // 'orchestrator' | workerId | null
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const removeWorker = useCallback((workerId) => {
    const updated = {
      ...team,
      workers: team.workers.filter(w => w.id !== workerId),
    };
    onUpdate(updated);
  }, [team, onUpdate]);

  // Rebuild nodes/edges when team changes
  useMemo(() => {
    const n = buildNodes(team.orchestrator, team.workers, agents, removeWorker);
    const e = buildEdges(team.workers);
    setNodes(n);
    setEdges(e);
  }, [team.orchestrator, team.workers, agents, removeWorker]);

  const addWorker = () => {
    const newWorker = { agent_name: '', id: crypto.randomUUID() };
    onUpdate({ ...team, workers: [...team.workers, newWorker] });
    setSelectingFor(newWorker.id);
  };

  const selectAgent = (agentName) => {
    if (selectingFor === 'orchestrator') {
      onUpdate({ ...team, orchestrator: agentName });
    } else if (selectingFor) {
      onUpdate({
        ...team,
        workers: team.workers.map(w =>
          w.id === selectingFor ? { ...w, agent_name: agentName } : w
        ),
      });
    }
    setSelectingFor(null);
    setSearch('');
  };

  // Agents already used
  const usedAgents = new Set([team.orchestrator, ...team.workers.map(w => w.agent_name)].filter(Boolean));

  const filteredAgents = agents.filter(a =>
    !usedAgents.has(a.name) &&
    (a.name.toLowerCase().includes(search.toLowerCase()) ||
     (a.category || '').toLowerCase().includes(search.toLowerCase()))
  );

  const canProceed = team.orchestrator && team.workers.length > 0 && team.workers.every(w => w.agent_name);

  return (
    <div style={{ maxWidth: '900px', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: 0, display: 'flex' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: t.tp }}>Composer l'orchestre</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
          backgroundColor: t.amber + '18', color: t.amber, border: `1px solid ${t.amber}30`,
        }}>
          <Shield size={11} />
          Orchestra
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', height: '420px' }}>
        {/* ReactFlow Canvas */}
        <div style={{
          flex: 1, borderRadius: '14px', overflow: 'hidden',
          border: `1px solid ${t.border}`, background: t.bg,
        }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              if (node.id === 'orchestrator') setSelectingFor('orchestrator');
              else setSelectingFor(node.id);
            }}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            style={{ background: t.bg }}
          >
            <Background color={t.tm} gap={20} size={1} style={{ opacity: 0.3 }} />
            <Controls
              style={{ background: t.surfaceEl, borderColor: t.border, borderRadius: '8px' }}
              showInteractive={false}
            />
          </ReactFlow>
        </div>

        {/* Sidebar: Agent picker */}
        <div style={{
          width: '260px', background: t.surface, borderRadius: '14px',
          border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Add worker button */}
          <div style={{ padding: '12px', borderBottom: `1px solid ${t.border}` }}>
            <button
              onClick={addWorker}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                background: t.violet + '15', border: `1px dashed ${t.violet}50`,
                color: t.violet, fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '6px', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = t.violet + '25'; }}
              onMouseLeave={e => { e.currentTarget.style.background = t.violet + '15'; }}
            >
              <Plus size={14} />
              Ajouter un agent
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${t.border}` }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} color={t.tm} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Chercher un agent..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: t.bg, border: `1px solid ${t.border}`, borderRadius: '8px',
                  padding: '8px 10px 8px 32px', color: '#fff', fontSize: '12px', outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Selecting indicator */}
          {selectingFor && (
            <div style={{
              padding: '8px 12px', fontSize: '11px', fontWeight: 600,
              color: selectingFor === 'orchestrator' ? t.amber : t.violet,
              background: selectingFor === 'orchestrator' ? t.amber + '10' : t.violet + '10',
              borderBottom: `1px solid ${t.border}`,
            }}>
              {selectingFor === 'orchestrator' ? 'Choisir l\'orchestrateur' : 'Choisir un agent worker'}
            </div>
          )}

          {/* Agent list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {filteredAgents.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: t.tm }}>
                {search ? 'Aucun agent trouve' : 'Tous les agents sont utilises'}
              </div>
            ) : (
              filteredAgents.map(a => (
                <button
                  key={a.name}
                  onClick={() => selectAgent(a.name)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px', borderRadius: '8px',
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = t.surfaceEl}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '8px',
                    background: t.violet + '15', border: `1px solid ${t.violet}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <User size={14} color={t.violet} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: t.tp, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.name}
                    </div>
                    <div style={{ fontSize: '10px', color: t.tm }}>
                      {a.category || 'Sans categorie'}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <div style={{ fontSize: '12px', color: t.tm }}>
          {team.orchestrator ? `Orchestrateur: ${team.orchestrator}` : 'Aucun orchestrateur'}
          {' '}&middot;{' '}
          {team.workers.filter(w => w.agent_name).length} agent{team.workers.filter(w => w.agent_name).length !== 1 ? 's' : ''} worker
        </div>
        <button
          onClick={onNext}
          disabled={!canProceed}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 24px', borderRadius: '10px',
            background: canProceed ? t.amber : t.surfaceEl,
            color: canProceed ? '#000' : t.tm,
            border: 'none', fontSize: '13px', fontWeight: 600,
            cursor: canProceed ? 'pointer' : 'default',
            opacity: canProceed ? 1 : 0.5,
            transition: 'all 0.2s',
          }}
        >
          Continuer
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
