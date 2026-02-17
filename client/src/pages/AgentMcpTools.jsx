import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Globe, ExternalLink } from 'lucide-react';
import { api } from '../api';
import McpToolsManager from '../components/McpToolsManager';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

export default function AgentMcpTools() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [deployment, setDeployment] = useState(null);

  useEffect(() => {
    api(`/api/agents/${name}`).then(setAgent).catch(() => {});
    api(`/api/mcp/agents/${name}/deployment`).then(setDeployment).catch(() => {});
  }, [name]);

  return (
    <div style={{ minHeight: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp }}>
      {/* Breadcrumb */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to={`/agents/${name}`} style={{ color: t.tm, display: 'flex', textDecoration: 'none' }}><ChevronLeft size={18} /></Link>
          <span style={{ fontSize: '12px', color: t.tm }}>Agents</span>
          <span style={{ fontSize: '12px', color: t.tm }}>/</span>
          <Link to={`/agents/${name}`} style={{ fontSize: '12px', color: t.ts, textDecoration: 'none' }}>{name}</Link>
          <span style={{ fontSize: '12px', color: t.tm }}>/</span>
          <span style={{ fontSize: '12px', color: t.tp, fontWeight: 600 }}>MCP Tools</span>
        </div>
        {deployment && (
          <a href={`/mcp/${deployment.slug}`} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', color: t.success, textDecoration: 'none',
            padding: '6px 12px', borderRadius: '6px',
            backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
          }}>
            <Globe size={12} /> View Live MCP
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Page header */}
      <div style={{ padding: '24px 24px 0' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
          MCP Tools
        </h1>
        <p style={{ fontSize: '13px', color: t.ts, margin: '0 0 4px', lineHeight: 1.5 }}>
          Configure the tools exposed by{' '}
          <span style={{ fontFamily: t.mono, color: t.violet, fontWeight: 600 }}>{name}</span>
          {' '}when used as an MCP server.
        </p>
        <p style={{ fontSize: '12px', color: t.tm, margin: 0, lineHeight: 1.5, maxWidth: '700px' }}>
          Specialized tools replace the generic "chat" tool with purpose-built operations.
          Each tool has structured parameters and context templates that force callers to provide
          proper context — producing significantly better output.
        </p>
      </div>

      {/* Main content */}
      <div style={{ padding: '24px', maxWidth: '900px' }}>
        <McpToolsManager agentName={name} />
      </div>
    </div>
  );
}
