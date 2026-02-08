import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const t = {
  surface: '#0A0A0B', border: 'rgba(255,255,255,0.06)', borderS: 'rgba(255,255,255,0.12)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

export default function Comparison() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [iterations, setIterations] = useState([]);
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [project, setProject] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, iters] = await Promise.all([
          api(`/api/projects/${projectId}`),
          api(`/api/iterations/${projectId}`),
        ]);
        setProject(p);
        setIterations(iters || []);
        if (iters && iters.length >= 2) {
          setLeft(iters[0]);
          setRight(iters[iters.length - 1]);
        } else if (iters && iters.length === 1) {
          setLeft(iters[0]);
        }
      } catch (e) { console.error(e); }
    };
    load();
  }, [projectId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', letterSpacing: '-0.02em', margin: 0 }}>
            Compare Iterations
          </h1>
          <span style={{ fontSize: '13px', color: t.tm }}>{project?.name}</span>
        </div>
        <button onClick={() => navigate(`/project/${projectId}`)} style={{
          background: 'transparent', border: `1px solid ${t.borderS}`, color: t.ts,
          borderRadius: '4px', padding: '6px 14px', fontSize: '12px', fontWeight: '500',
        }}>Back to Project</button>
      </header>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '11px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Left</label>
          <select value={left?.id || ''} onChange={e => setLeft(iterations.find(i => i.id === e.target.value))}
            style={{ width: '100%' }}>
            <option value="">Select iteration...</option>
            {iterations.map(i => <option key={i.id} value={i.id}>{i.title || `V${i.version}`} — {i.agent_name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '11px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Right</label>
          <select value={right?.id || ''} onChange={e => setRight(iterations.find(i => i.id === e.target.value))}
            style={{ width: '100%' }}>
            <option value="">Select iteration...</option>
            {iterations.map(i => <option key={i.id} value={i.id}>{i.title || `V${i.version}`} — {i.agent_name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 260px)' }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: '8px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
          {left ? (
            <iframe src={`/api/preview/${projectId}/${left.id}`} style={{ width: '100%', height: '100%', border: 'none' }} title="Left" />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, background: '#050505' }}>Select left iteration</div>
          )}
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: '8px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
          {right ? (
            <iframe src={`/api/preview/${projectId}/${right.id}`} style={{ width: '100%', height: '100%', border: 'none' }} title="Right" />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, background: '#050505' }}>Select right iteration</div>
          )}
        </div>
      </div>

      {left && right && (
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>{left.title || `V${left.version}`}</div>
            <span style={{ background: t.violetM, color: t.violet, padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600' }}>{left.agent_name}</span>
            {left.prompt && <p style={{ fontSize: '12px', color: t.ts, marginTop: '8px', lineHeight: '1.5' }}>{left.prompt}</p>}
          </div>
          <div style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>{right.title || `V${right.version}`}</div>
            <span style={{ background: t.violetM, color: t.violet, padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600' }}>{right.agent_name}</span>
            {right.prompt && <p style={{ fontSize: '12px', color: t.ts, marginTop: '8px', lineHeight: '1.5' }}>{right.prompt}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
