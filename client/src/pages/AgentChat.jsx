import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, BookOpen } from 'lucide-react';
import { api } from '../api';
import AgentChatPanel from '../components/AgentChatPanel';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b',
  border: 'rgba(255,255,255,0.08)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

export default function AgentChat() {
  const { agentName } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);

  useEffect(() => {
    if (agentName) {
      api(`/api/agents/${encodeURIComponent(agentName)}`).then(setAgent).catch(console.error);
    }
  }, [agentName]);

  const kbCount = agent?.knowledge_bases_count || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 57px)', background: t.bg, overflow: 'hidden' }}>
      {/* Top Bar */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: '12px', background: t.surface,
        flexShrink: 0,
      }}>
        <button onClick={() => navigate(`/agents/${encodeURIComponent(agentName)}`)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: t.ts,
          display: 'flex', padding: '4px',
        }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
          background: t.violetG, border: `1px solid ${t.violet}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={15} color={t.violet} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>
            {agent?.name || agentName}
          </div>
          {agent?.description && (
            <div style={{
              fontSize: '11px', color: t.tm, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px',
            }}>
              {agent.description}
            </div>
          )}
        </div>
        {kbCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
            background: t.violetM, border: `1px solid ${t.violet}40`, color: t.violet,
          }}>
            <BookOpen size={10} /> {kbCount} KB{kbCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Chat Panel - full remaining height */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AgentChatPanel
          agentName={agentName}
          agentDisplayName={agent?.name || agentName}
          height="100%"
        />
      </div>
    </div>
  );
}
