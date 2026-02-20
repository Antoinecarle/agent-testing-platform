import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe, Key, BarChart3, Settings, Wrench, Rocket, ExternalLink,
  Plus, Trash2, Copy, Pause, Play, Eye, EyeOff, RefreshCw,
  AlertCircle, CheckCircle, Clock, Activity, Server, Shield,
  ChevronRight, ChevronDown, X, Zap, TrendingUp, Database, Cpu,
  HardDrive, Mail, Calendar, FileSpreadsheet, Link2, Code, Terminal
} from 'lucide-react';
import { api } from '../api';
import McpToolsManager from './McpToolsManager';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

function formatTokenCount(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatDate(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Sidebar menu items
const MENU_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Server, color: t.violet },
  { id: 'tools', label: 'Tools', icon: Wrench, color: '#22c55e' },
  { id: 'api-keys', label: 'API Keys', icon: Key, color: '#f59e0b' },
  { id: 'logs', label: 'Logs & Analytics', icon: BarChart3, color: '#06b6d4' },
  { id: 'settings', label: 'Settings', icon: Settings, color: t.ts },
];

const PROVIDER_COLORS = {
  openai: '#10a37f',
  anthropic: '#d97706',
  google: '#4285F4',
};

// ----- Copyable Code Block -----
function CodeBlock({ label, code, copiedField, copyToClipboard, icon: Icon }) {
  const fieldKey = `snippet-${label}`;
  const isCopied = copiedField === fieldKey;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: t.ts, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {Icon && <Icon size={12} style={{ color: t.violet }} />}
          {label}
        </span>
        <button onClick={() => copyToClipboard(code, fieldKey)} style={{
          background: isCopied ? 'rgba(34,197,94,0.15)' : t.surfaceEl,
          border: `1px solid ${isCopied ? 'rgba(34,197,94,0.3)' : t.border}`,
          color: isCopied ? t.success : t.ts,
          padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: '500',
        }}>
          {isCopied ? <><CheckCircle size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
        </button>
      </div>
      <pre style={{
        background: '#0a0a0a', border: `1px solid ${t.border}`, borderRadius: '8px',
        padding: '14px 16px', margin: 0, overflowX: 'auto', fontSize: '11px',
        fontFamily: t.mono, color: '#e4e4e7', lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}>
        {code}
      </pre>
    </div>
  );
}

// ----- Config Snippets Section -----
function ConfigSnippets({ deployment, baseUrl, copiedField, copyToClipboard }) {
  const [activeTab, setActiveTab] = useState('claude-code');
  if (!deployment) return null;

  const mcpUrl = `${baseUrl}/mcp/${deployment.slug}/mcp`;
  const sseUrl = `${baseUrl}/mcp/${deployment.slug}/sse`;
  const chatUrl = `${baseUrl}/mcp/${deployment.slug}/api/chat`;
  const apiKeyPlaceholder = 'YOUR_API_KEY';

  const snippets = {
    'claude-code': {
      label: 'Claude Code / Desktop',
      icon: Terminal,
      description: 'Add this to your claude_desktop_config.json or .mcp.json file. The SSE transport is the most widely compatible method.',
      blocks: [
        {
          label: 'SSE Transport (Recommended)',
          description: 'Works with Claude Desktop, Claude Code, Cursor, and most MCP clients. Authentication via query parameter.',
          code: JSON.stringify({
            mcpServers: {
              [deployment.slug]: {
                type: 'sse',
                url: `${sseUrl}?key=${apiKeyPlaceholder}`,
              },
            },
          }, null, 2),
        },
        {
          label: 'Streamable HTTP Transport (Advanced)',
          description: 'Newer protocol — use this if your client supports streamable HTTP. Authentication via Bearer header.',
          code: JSON.stringify({
            mcpServers: {
              [deployment.slug]: {
                type: 'streamable-http',
                url: mcpUrl,
                headers: { Authorization: `Bearer ${apiKeyPlaceholder}` },
              },
            },
          }, null, 2),
        },
      ],
    },
    curl: {
      label: 'cURL',
      icon: Code,
      description: 'Test your MCP server from the terminal.',
      blocks: [
        {
          label: 'Chat API (Simple)',
          description: 'Send a message and get a response — no MCP protocol needed.',
          code: `curl -X POST "${chatUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKeyPlaceholder}" \\
  -d '{
    "message": "Hello, how can you help me?"
  }'`,
        },
        {
          label: 'SSE Stream (Connect)',
          description: 'Open the SSE stream — the server sends an endpoint event with the messages URL.',
          code: `# 1. Open SSE stream (keep running in a terminal)
curl -N "${sseUrl}?key=${apiKeyPlaceholder}"

# The server responds with:
# event: endpoint
# data: /mcp/${deployment.slug}/sse/messages?sessionId=...`,
        },
        {
          label: 'MCP JSON-RPC (Initialize)',
          description: 'Initialize an MCP session via the Streamable HTTP endpoint.',
          code: `curl -X POST "${mcpUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKeyPlaceholder}" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "my-client", "version": "1.0.0" }
    }
  }'`,
        },
      ],
    },
    javascript: {
      label: 'JavaScript',
      icon: Code,
      description: 'Integrate in your application.',
      blocks: [
        {
          label: 'Chat API (Fetch)',
          description: 'Simple request/response — no MCP client library needed.',
          code: `const response = await fetch("${chatUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${apiKeyPlaceholder}",
  },
  body: JSON.stringify({
    message: "Hello, how can you help me?",
  }),
});
const data = await response.json();
console.log(data.response);`,
        },
        {
          label: 'MCP Client (SSE)',
          description: 'Connect as an MCP client using the official SDK.',
          code: `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("${sseUrl}?key=${apiKeyPlaceholder}")
);
const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(transport);

// List available tools
const { tools } = await client.listTools();
console.log(tools);

// Call a tool
const result = await client.callTool({
  name: "chat",
  arguments: { message: "Hello!" },
});
console.log(result);`,
        },
      ],
    },
    python: {
      label: 'Python',
      icon: Code,
      description: 'Integrate with Python.',
      blocks: [
        {
          label: 'Chat API (requests)',
          description: 'Simple HTTP call — no MCP library needed.',
          code: `import requests

response = requests.post(
    "${chatUrl}",
    headers={"Authorization": "Bearer ${apiKeyPlaceholder}"},
    json={"message": "Hello, how can you help me?"}
)
print(response.json()["response"])`,
        },
        {
          label: 'MCP Client (SSE)',
          description: 'Connect as an MCP client using the official Python SDK.',
          code: `from mcp import ClientSession
from mcp.client.sse import sse_client

async with sse_client(
    "${sseUrl}?key=${apiKeyPlaceholder}"
) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await session.list_tools()
        print(tools)

        result = await session.call_tool(
            "chat", arguments={"message": "Hello!"}
        )
        print(result)`,
        },
      ],
    },
  };

  const current = snippets[activeTab];

  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px',
      overflow: 'hidden', marginTop: '24px',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code size={14} style={{ color: t.violet }} />
          Quick Start
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {Object.entries(snippets).map(([key, s]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              background: activeTab === key ? `${t.violet}20` : 'transparent',
              border: `1px solid ${activeTab === key ? t.violet + '40' : t.border}`,
              color: activeTab === key ? t.tp : t.tm,
              padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
              fontSize: '10px', fontWeight: '600',
            }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        {/* Tab description */}
        {current.description && (
          <div style={{
            fontSize: '11px', color: t.ts, lineHeight: 1.5, marginBottom: '14px',
          }}>
            {current.description}
          </div>
        )}
        {/* API key notice */}
        <div style={{
          background: 'rgba(139,92,246,0.04)', border: `1px solid ${t.violet}20`,
          borderRadius: '6px', padding: '8px 12px', marginBottom: '14px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <AlertCircle size={11} style={{ color: t.violet, flexShrink: 0 }} />
          <span style={{ fontSize: '10px', color: t.ts, lineHeight: 1.4 }}>
            Replace <code style={{ fontFamily: t.mono, color: t.violet, fontWeight: '600' }}>YOUR_API_KEY</code> with a key from the <strong>API Keys</strong> tab.
          </span>
        </div>
        {current.blocks.map((block, i) => (
          <div key={i}>
            {block.description && (
              <div style={{ fontSize: '10px', color: t.tm, marginBottom: '6px', lineHeight: 1.4, paddingLeft: '2px' }}>
                {block.description}
              </div>
            )}
            <CodeBlock
              label={block.label}
              code={block.code}
              copiedField={copiedField}
              copyToClipboard={copyToClipboard}
              icon={current.icon}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- Overview Section -----
function OverviewSection({ deployment, agent, onDeploy, deployLoading, onRefresh }) {
  const [copiedField, setCopiedField] = useState(null);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!deployment) {
    return (
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px' }}>MCP Server</h2>
        <p style={{ fontSize: '13px', color: t.ts, margin: '0 0 32px', lineHeight: 1.6 }}>
          Deploy this agent as an MCP server to expose it via API with its own landing page, tools, and API keys.
        </p>
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px',
          padding: '48px 32px', textAlign: 'center',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 20px',
            background: `linear-gradient(135deg, ${t.violetM} 0%, ${t.surfaceEl} 100%)`,
            border: `2px solid ${t.violet}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Rocket size={28} style={{ color: t.violet }} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>Not Deployed Yet</h3>
          <p style={{ fontSize: '13px', color: t.tm, margin: '0 0 24px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
            Deploy this agent as an MCP server to get an API endpoint, landing page, and manage API keys for external access.
          </p>
          <button
            onClick={onDeploy}
            disabled={deployLoading}
            style={{
              background: `linear-gradient(135deg, ${t.violet} 0%, #6D28D9 100%)`,
              color: '#fff', border: 'none', padding: '12px 32px', fontSize: '14px',
              fontWeight: '600', borderRadius: '8px', cursor: deployLoading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              opacity: deployLoading ? 0.6 : 1,
              boxShadow: `0 4px 16px ${t.violet}40`,
            }}
          >
            <Rocket size={16} />{deployLoading ? 'Deploying...' : 'Deploy as MCP Server'}
          </button>
        </div>
      </div>
    );
  }

  const usagePercent = deployment.monthly_token_limit > 0
    ? Math.round(((deployment.monthlyUsage || 0) / deployment.monthly_token_limit) * 100)
    : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>MCP Server Overview</h2>
          <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>
            Deployment status and quick stats
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', padding: '4px 12px',
            borderRadius: '100px', letterSpacing: '0.05em',
            backgroundColor: deployment.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
            color: deployment.status === 'active' ? t.success : t.warning,
          }}>
            {deployment.status}
          </span>
          <button onClick={onRefresh} style={{
            background: t.surfaceEl, border: `1px solid ${t.border}`, borderRadius: '6px',
            padding: '6px', cursor: 'pointer', color: t.ts, display: 'flex',
          }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Active Model Banner */}
      {deployment.config?.llm_model && (
        <div style={{
          background: `${PROVIDER_COLORS[deployment.config.llm_provider] || t.violet}08`,
          border: `1px solid ${PROVIDER_COLORS[deployment.config.llm_provider] || t.violet}25`,
          borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <Cpu size={14} style={{ color: PROVIDER_COLORS[deployment.config.llm_provider] || t.violet }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '11px', color: t.tm }}>Active Model</span>
            <div style={{ fontSize: '13px', fontWeight: '600', fontFamily: t.mono, color: t.tp }}>
              {deployment.config.llm_model}
            </div>
          </div>
          <span style={{
            fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 8px',
            borderRadius: '100px', letterSpacing: '0.04em',
            background: `${PROVIDER_COLORS[deployment.config.llm_provider] || t.violet}15`,
            color: PROVIDER_COLORS[deployment.config.llm_provider] || t.violet,
          }}>
            {deployment.config.llm_provider || 'openai'}
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Requests', value: deployment.total_requests || 0, icon: Activity, color: t.violet },
          { label: 'Input Tokens', value: formatTokenCount(deployment.total_input_tokens || 0), icon: Database, color: '#06b6d4' },
          { label: 'Output Tokens', value: formatTokenCount(deployment.total_output_tokens || 0), icon: Cpu, color: '#22c55e' },
          { label: 'API Keys', value: deployment.apiKeys?.length || 0, icon: Key, color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <stat.icon size={14} style={{ color: stat.color }} />
              <span style={{ fontSize: '11px', color: t.tm, fontWeight: '500' }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: t.mono }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly Usage Bar */}
      <div style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px',
        padding: '20px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={14} style={{ color: t.violet }} />
            Monthly Token Usage
          </span>
          <span style={{ fontSize: '12px', fontFamily: t.mono, color: t.ts }}>
            {formatTokenCount(deployment.monthlyUsage || 0)} / {formatTokenCount(deployment.monthly_token_limit)}
          </span>
        </div>
        <div style={{
          height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '4px',
            width: `${Math.min(usagePercent, 100)}%`,
            background: usagePercent > 80 ? `linear-gradient(90deg, ${t.warning}, ${t.danger})` : `linear-gradient(90deg, ${t.violet}, #a78bfa)`,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ fontSize: '10px', color: t.tm }}>{usagePercent}% used</span>
          <span style={{ fontSize: '10px', color: t.tm }}>
            Tier: <span style={{ color: t.ts, fontWeight: '600' }}>{deployment.tier || 'starter'}</span>
          </span>
        </div>
      </div>

      {/* Endpoints */}
      <div style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={14} style={{ color: t.violet }} />
            Endpoints
          </span>
        </div>
        {[
          { label: 'Landing Page', value: `/mcp/${deployment.slug}`, link: true },
          { label: 'Chat API', value: `${baseUrl}/mcp/${deployment.slug}/api/chat` },
          { label: 'SSE Endpoint', value: `${baseUrl}/mcp/${deployment.slug}/sse` },
          { label: 'MCP Endpoint', value: `${baseUrl}/mcp/${deployment.slug}/mcp` },
        ].map((ep, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
            borderBottom: i < 3 ? `1px solid ${t.border}` : 'none',
          }}>
            <span style={{ fontSize: '11px', color: t.tm, fontWeight: '600', minWidth: '100px' }}>{ep.label}</span>
            <span style={{ fontSize: '11px', fontFamily: t.mono, color: t.ts, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ep.value}
            </span>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button onClick={() => copyToClipboard(ep.value, ep.label)} style={{
                background: copiedField === ep.label ? 'rgba(34,197,94,0.15)' : t.surfaceEl,
                border: `1px solid ${copiedField === ep.label ? 'rgba(34,197,94,0.3)' : t.border}`,
                color: copiedField === ep.label ? t.success : t.ts,
                padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', display: 'flex',
              }}>
                <Copy size={11} />
              </button>
              {ep.link && (
                <a href={ep.value} target="_blank" rel="noopener noreferrer" style={{
                  background: t.surfaceEl, border: `1px solid ${t.border}`,
                  color: t.ts, padding: '3px 6px', borderRadius: '4px', display: 'flex',
                }}>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start Config Snippets */}
      <ConfigSnippets deployment={deployment} baseUrl={baseUrl} copiedField={copiedField} copyToClipboard={copyToClipboard} />
    </div>
  );
}

// ----- API Keys Section -----
function ApiKeysSection({ agentName, deployment, onRefresh }) {
  const [keys, setKeys] = useState(deployment?.apiKeys || []);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const result = await api(`/api/agent-deploy/${agentName}/deployment/api-key`, {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      setCreatedKey(result.apiKey);
      setNewKeyName('');
      setShowCreate(false);
      onRefresh();
      // Add to local list
      setKeys(prev => [...prev, {
        id: Date.now(),
        prefix: result.prefix,
        name: newKeyName.trim(),
        isActive: true,
        createdAt: new Date().toISOString(),
      }]);
    } catch (err) {
      alert(err.message || 'Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (keyId) => {
    if (!window.confirm('Revoke this API key? It will stop working immediately.')) return;
    try {
      await api(`/api/agent-deploy/${agentName}/deployment/api-key/${keyId}`, { method: 'DELETE' });
      setKeys(prev => prev.map(k => k.id === keyId ? { ...k, isActive: false } : k));
      onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to revoke key');
    }
  };

  useEffect(() => {
    setKeys(deployment?.apiKeys || []);
  }, [deployment]);

  if (!deployment) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center', background: t.surface, borderRadius: '12px', border: `1px solid ${t.border}` }}>
        <Shield size={32} style={{ color: t.tm, marginBottom: '12px' }} />
        <p style={{ fontSize: '13px', color: t.tm }}>Deploy the agent first to manage API keys.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>API Keys</h2>
          <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>
            Manage API keys for accessing this MCP server
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          background: t.violet, color: '#fff', border: 'none', padding: '8px 16px',
          fontSize: '12px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <Plus size={14} /> New API Key
        </button>
      </div>

      {/* Created key notice */}
      {createdKey && (
        <div style={{
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '8px', padding: '14px 16px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertCircle size={14} style={{ color: t.warning }} />
            <span style={{ fontSize: '12px', fontWeight: '600', color: t.warning }}>Save your API key now — it won't be shown again</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px',
          }}>
            <code style={{ flex: 1, fontSize: '11px', fontFamily: t.mono, color: t.tp, wordBreak: 'break-all' }}>
              {createdKey}
            </code>
            <button onClick={() => {
              navigator.clipboard.writeText(createdKey);
              setCopiedKey(true);
              setTimeout(() => setCopiedKey(false), 2000);
            }} style={{
              background: copiedKey ? 'rgba(34,197,94,0.2)' : t.surfaceEl,
              border: `1px solid ${copiedKey ? 'rgba(34,197,94,0.3)' : t.border}`,
              color: copiedKey ? t.success : t.ts,
              padding: '4px 10px', fontSize: '10px', fontWeight: '600', borderRadius: '4px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
            }}>
              <Copy size={10} />{copiedKey ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setCreatedKey(null)} style={{
            background: 'none', border: 'none', color: t.tm, fontSize: '11px',
            cursor: 'pointer', marginTop: '8px', padding: 0,
          }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Create key form */}
      {showCreate && (
        <div style={{
          background: t.surface, border: `1px solid ${t.violet}40`, borderRadius: '10px',
          padding: '16px', marginBottom: '16px',
        }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Key Name
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="e.g. Production, Staging, CI/CD..."
              style={{
                flex: 1, backgroundColor: t.bg, border: `1px solid ${t.border}`,
                borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', fontFamily: 'inherit',
              }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button onClick={handleCreate} disabled={loading || !newKeyName.trim()} style={{
              background: t.violet, color: '#fff', border: 'none', padding: '8px 16px',
              fontSize: '12px', fontWeight: '600', borderRadius: '6px',
              cursor: (loading || !newKeyName.trim()) ? 'not-allowed' : 'pointer',
              opacity: (loading || !newKeyName.trim()) ? 0.5 : 1,
            }}>
              Create
            </button>
            <button onClick={() => { setShowCreate(false); setNewKeyName(''); }} style={{
              background: t.surfaceEl, color: t.ts, border: `1px solid ${t.border}`,
              padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 80px',
          padding: '10px 16px', borderBottom: `1px solid ${t.border}`,
          fontSize: '10px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>Name</span>
          <span>Prefix</span>
          <span>Status</span>
          <span>Last Used</span>
          <span></span>
        </div>

        {keys.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
            No API keys yet
          </div>
        ) : (
          keys.map((key, i) => (
            <div key={key.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 80px',
              padding: '12px 16px', alignItems: 'center',
              borderBottom: i < keys.length - 1 ? `1px solid ${t.border}` : 'none',
              opacity: key.isActive ? 1 : 0.5,
            }}>
              <span style={{ fontSize: '13px', fontWeight: '500' }}>{key.name || 'Default'}</span>
              <code style={{ fontSize: '11px', fontFamily: t.mono, color: t.ts }}>{key.prefix}...</code>
              <span>
                <span style={{
                  fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '100px',
                  backgroundColor: key.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: key.isActive ? t.success : t.danger,
                }}>
                  {key.isActive ? 'Active' : 'Revoked'}
                </span>
              </span>
              <span style={{ fontSize: '11px', color: t.tm }}>{key.lastUsed ? formatDateTime(key.lastUsed) : 'Never'}</span>
              <div style={{ textAlign: 'right' }}>
                {key.isActive && (
                  <button onClick={() => handleRevoke(key.id)} style={{
                    background: 'rgba(239,68,68,0.1)', color: t.danger, border: 'none',
                    padding: '4px 10px', fontSize: '10px', fontWeight: '600', borderRadius: '4px',
                    cursor: 'pointer',
                  }}>
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ----- Logs Section -----
function LogsSection({ agentName, deployment }) {
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!deployment) return;
    setLoading(true);
    try {
      const data = await api(`/api/agent-deploy/${agentName}/deployment/usage?period=${period}`);
      setStats(data.stats);
      setRecentLogs(data.recent || []);
    } catch (err) {
      console.error('Failed to load usage:', err);
    } finally {
      setLoading(false);
    }
  }, [agentName, deployment, period]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!deployment) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center', background: t.surface, borderRadius: '12px', border: `1px solid ${t.border}` }}>
        <BarChart3 size={32} style={{ color: t.tm, marginBottom: '12px' }} />
        <p style={{ fontSize: '13px', color: t.tm }}>Deploy the agent first to see usage logs.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>Logs & Analytics</h2>
          <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>Token usage and request history</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: t.surfaceEl, borderRadius: '6px', padding: '3px' }}>
          {['day', 'week', 'month'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
              border: 'none', cursor: 'pointer',
              background: period === p ? t.violet : 'transparent',
              color: period === p ? '#fff' : t.ts,
            }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: t.tm }}>Loading...</div>
      ) : stats ? (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Requests', value: stats.totalRequests || 0, sub: `${stats.successCount || 0} success / ${stats.errorCount || 0} errors` },
              { label: 'Input Tokens', value: formatTokenCount(stats.totalInput || 0) },
              { label: 'Output Tokens', value: formatTokenCount(stats.totalOutput || 0) },
            ].map((s, i) => (
              <div key={i} style={{
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '16px',
              }}>
                <div style={{ fontSize: '11px', color: t.tm, marginBottom: '8px' }}>{s.label}</div>
                <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: t.mono }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: '10px', color: t.tm, marginTop: '4px' }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* Model Breakdown */}
          {stats.byModel && Object.keys(stats.byModel).length > 0 && (
            <div style={{
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px',
              padding: '16px', marginBottom: '24px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={14} style={{ color: t.violet }} />
                Model Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(stats.byModel).map(([model, data]) => (
                  <div key={model} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: t.surfaceEl, borderRadius: '6px',
                  }}>
                    <code style={{ fontSize: '11px', fontFamily: t.mono, color: t.ts }}>{model}</code>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <span style={{ fontSize: '11px', color: t.tm }}>{data.requests} req</span>
                      <span style={{ fontSize: '11px', color: t.ts, fontFamily: t.mono }}>{formatTokenCount(data.tokens)} tokens</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Logs Table */}
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} style={{ color: t.violet }} />
                Recent Requests
              </span>
              <button onClick={loadData} style={{
                background: t.surfaceEl, border: `1px solid ${t.border}`, borderRadius: '4px',
                padding: '3px 8px', cursor: 'pointer', color: t.ts, display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '10px',
              }}>
                <RefreshCw size={10} /> Refresh
              </button>
            </div>

            {recentLogs.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
                No requests logged yet
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 90px 90px 70px 70px',
                  padding: '8px 16px', borderBottom: `1px solid ${t.border}`,
                  fontSize: '10px', fontWeight: '600', color: t.tm, textTransform: 'uppercase',
                  letterSpacing: '0.05em', position: 'sticky', top: 0, background: t.surface,
                }}>
                  <span>Time</span>
                  <span>Tool</span>
                  <span>Model</span>
                  <span>Tokens</span>
                  <span>Duration</span>
                  <span>Status</span>
                </div>
                {recentLogs.map((log, i) => (
                  <div key={log.id || i} style={{
                    display: 'grid', gridTemplateColumns: '140px 1fr 90px 90px 70px 70px',
                    padding: '8px 16px', alignItems: 'center',
                    borderBottom: i < recentLogs.length - 1 ? `1px solid ${t.border}` : 'none',
                    fontSize: '11px',
                  }}>
                    <span style={{ color: t.tm }}>{formatDateTime(log.created_at)}</span>
                    <span style={{ fontFamily: t.mono, color: t.ts, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.tool_name || 'chat'}
                    </span>
                    <span style={{ fontFamily: t.mono, color: t.tm, fontSize: '10px' }}>{(log.model || '').split('-').pop()}</span>
                    <span style={{ fontFamily: t.mono, color: t.ts }}>{formatTokenCount(log.total_tokens || 0)}</span>
                    <span style={{ fontFamily: t.mono, color: t.tm }}>{log.duration_ms ? `${log.duration_ms}ms` : '--'}</span>
                    <span>
                      {log.status === 'success' ? (
                        <CheckCircle size={12} style={{ color: t.success }} />
                      ) : (
                        <AlertCircle size={12} style={{ color: t.danger }} />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ----- Settings Section -----
function SettingsSection({ agentName, deployment, onUpdate, onUndeploy, deployLoading }) {
  const config = deployment?.config || {};
  const [form, setForm] = useState({
    description: deployment?.description || '',
    tagline: deployment?.tagline || '',
    primary_color: deployment?.primary_color || '#8B5CF6',
    tier: deployment?.tier || 'starter',
    llm_provider: config.llm_provider || '',
    llm_model: config.llm_model || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userKeys, setUserKeys] = useState([]);
  const [providerConfigs, setProviderConfigs] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    if (deployment) {
      const cfg = deployment.config || {};
      setForm({
        description: deployment.description || '',
        tagline: deployment.tagline || '',
        primary_color: deployment.primary_color || '#8B5CF6',
        tier: deployment.tier || 'starter',
        llm_provider: cfg.llm_provider || '',
        llm_model: cfg.llm_model || '',
      });
    }
  }, [deployment]);

  useEffect(() => {
    (async () => {
      try {
        const [keysData, configsData] = await Promise.all([
          api('/api/wallet/llm-keys'),
          api('/api/wallet/llm-providers'),
        ]);
        setUserKeys(keysData || []);
        setProviderConfigs(configsData || {});
      } catch (err) {
        console.error('Failed to load LLM configs:', err);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { llm_provider, llm_model, ...rest } = form;
      await api(`/api/agent-deploy/${agentName}/deployment`, {
        method: 'PUT',
        body: JSON.stringify({
          ...rest,
          config: { ...(deployment?.config || {}), llm_provider, llm_model },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUpdate();
    } catch (err) {
      alert(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (!deployment) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center', background: t.surface, borderRadius: '12px', border: `1px solid ${t.border}` }}>
        <Settings size={32} style={{ color: t.tm, marginBottom: '12px' }} />
        <p style={{ fontSize: '13px', color: t.tm }}>Deploy the agent first to configure settings.</p>
      </div>
    );
  }

  const tiers = [
    { value: 'starter', label: 'Starter', limit: '20K tokens/month', color: t.ts },
    { value: 'professional', label: 'Professional', limit: '1M tokens/month', color: t.violet },
    { value: 'enterprise', label: 'Enterprise', limit: '6M tokens/month', color: '#f59e0b' },
  ];

  // Build model list from server-provided configs
  // Shows ALL available models: user BYOK + server-available providers
  const connectedProviderIds = userKeys.map(k => k.provider);
  const availableModels = [];
  const unavailableProviders = [];
  if (providerConfigs && !modelsLoading) {
    for (const [provId, cfg] of Object.entries(providerConfigs)) {
      const hasUserKey = connectedProviderIds.includes(provId);
      const hasServerKey = cfg.hasServerKey;
      if (hasUserKey || hasServerKey) {
        for (const m of cfg.models) {
          availableModels.push({
            ...m, provider: provId,
            source: hasUserKey ? 'user' : 'server',
          });
        }
      } else {
        unavailableProviders.push({ id: provId, name: cfg.name });
      }
    }
  }
  const modelsToRender = availableModels;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>Settings</h2>
        <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>Configure your MCP deployment</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
        {/* Status Toggle */}
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Server Status</div>
            <div style={{ fontSize: '11px', color: t.tm }}>
              {deployment.status === 'active' ? 'Server is accepting requests' : 'Server is paused — no requests accepted'}
            </div>
          </div>
          <button onClick={async () => {
            const newStatus = deployment.status === 'active' ? 'paused' : 'active';
            try {
              await api(`/api/agent-deploy/${agentName}/deployment`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
              });
              onUpdate();
            } catch (err) {
              alert(err.message || 'Failed to update status');
            }
          }} style={{
            background: deployment.status === 'active' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
            color: deployment.status === 'active' ? t.warning : t.success,
            border: 'none', padding: '8px 16px', fontSize: '12px', fontWeight: '600',
            borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {deployment.status === 'active' ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
          </button>
        </div>

        {/* Tier Selection */}
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>Deployment Tier</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {tiers.map(tier => (
              <button key={tier.value} onClick={() => setForm(f => ({ ...f, tier: tier.value }))} style={{
                flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer',
                background: form.tier === tier.value ? `${tier.color}15` : t.surfaceEl,
                border: `1px solid ${form.tier === tier.value ? tier.color : t.border}`,
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: form.tier === tier.value ? tier.color : t.tp, marginBottom: '4px' }}>
                  {tier.label}
                </div>
                <div style={{ fontSize: '10px', color: t.tm }}>{tier.limit}</div>
              </button>
            ))}
          </div>
        </div>

        {/* LLM Model Selection */}
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={14} style={{ color: t.violet }} />
            LLM Model
          </div>
          <p style={{ fontSize: '11px', color: t.tm, margin: '0 0 12px', lineHeight: 1.5 }}>
            Select the model used for MCP chat and specialized tools.
            {modelsToRender.length === 0 && !modelsLoading && ' No models available — connect an API key in Settings or configure a server key.'}
          </p>
          {modelsLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
              Loading models...
            </div>
          ) : (
            <>
              {/* Group models by provider */}
              {(() => {
                const grouped = {};
                for (const m of modelsToRender) {
                  if (!grouped[m.provider]) grouped[m.provider] = [];
                  grouped[m.provider].push(m);
                }
                return Object.entries(grouped).map(([provId, models]) => {
                  const pColor = PROVIDER_COLORS[provId] || t.violet;
                  const provName = providerConfigs?.[provId]?.name || provId;
                  const source = models[0]?.source;
                  return (
                    <div key={provId} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: '100px', letterSpacing: '0.04em',
                          background: `${pColor}15`, color: pColor,
                        }}>
                          {provName}
                        </span>
                        <span style={{ fontSize: '9px', color: t.tm }}>
                          {source === 'user' ? 'Your API key' : 'Server key'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {models.map(m => {
                          const isSelected = form.llm_model === m.id && form.llm_provider === m.provider;
                          return (
                            <button key={m.id} onClick={() => setForm(f => ({ ...f, llm_model: m.id, llm_provider: m.provider }))} style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', width: '100%',
                              background: isSelected ? `${pColor}12` : t.surfaceEl,
                              border: `1px solid ${isSelected ? pColor + '50' : t.border}`,
                              transition: 'all 0.15s',
                            }}>
                              <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: isSelected ? pColor : 'transparent',
                                border: `2px solid ${isSelected ? pColor : t.tm}`,
                                flexShrink: 0,
                              }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: isSelected ? t.tp : t.ts }}>{m.name}</div>
                                <div style={{ fontSize: '10px', fontFamily: t.mono, color: t.tm }}>{m.id}</div>
                              </div>
                              {m.default && (
                                <span style={{ fontSize: '8px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  default
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}

              {unavailableProviders.length > 0 && (
                <div style={{
                  marginTop: '4px', padding: '10px 14px', background: t.surfaceEl,
                  borderRadius: '8px', border: `1px solid ${t.border}`,
                }}>
                  <div style={{ fontSize: '11px', color: t.tm, marginBottom: '6px' }}>More providers available:</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {unavailableProviders.map(p => (
                      <a key={p.id} href="/settings?tab=api-keys" style={{
                        fontSize: '10px', fontWeight: '600', padding: '3px 10px', borderRadius: '100px',
                        background: `${PROVIDER_COLORS[p.id] || t.violet}12`,
                        color: PROVIDER_COLORS[p.id] || t.violet,
                        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        border: `1px solid ${PROVIDER_COLORS[p.id] || t.violet}25`,
                      }}>
                        {p.name} — Connect API key
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Description & Tagline */}
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '16px',
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{
                width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
                borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Tagline
            </label>
            <input
              type="text"
              value={form.tagline}
              onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              style={{
                width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
                borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Primary Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="color"
                value={form.primary_color}
                onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                style={{ width: '36px', height: '36px', border: 'none', cursor: 'pointer', background: 'none', padding: 0 }}
              />
              <code style={{ fontSize: '12px', fontFamily: t.mono, color: t.ts }}>{form.primary_color}</code>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button onClick={handleSave} disabled={saving} style={{
          background: saved ? 'rgba(34,197,94,0.15)' : t.violet,
          color: saved ? t.success : '#fff',
          border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none',
          padding: '10px 24px', fontSize: '13px', fontWeight: '600', borderRadius: '6px',
          cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '8px', alignSelf: 'flex-start',
        }}>
          {saved ? <><CheckCircle size={14} /> Saved!</> : saving ? 'Saving...' : 'Save Settings'}
        </button>

        {/* Danger Zone */}
        <div style={{
          background: t.surface, border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px',
          padding: '16px', marginTop: '12px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: t.danger, marginBottom: '8px' }}>Danger Zone</div>
          <p style={{ fontSize: '11px', color: t.tm, margin: '0 0 12px', lineHeight: 1.5 }}>
            Undeploying will revoke all API keys and remove the MCP server. This action cannot be undone.
          </p>
          <button onClick={onUndeploy} disabled={deployLoading} style={{
            background: 'rgba(239,68,68,0.15)', color: t.danger,
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '6px',
            cursor: deployLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Trash2 size={13} /> Undeploy MCP Server
          </button>
        </div>
      </div>
    </div>
  );
}


// ----- Platform Tools Section -----
// ----- Nano Banana SVG Icon Component -----
function NanoBananaIcon({ size = 14, style = {} }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style} xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 20C7 16 6.5 11.5 8 7c1-3 3.5-5 7-5 1.5 0 2.8.5 3.5 1.2-.8 3-2 6.5-3.5 10C13.5 17 11.5 20 8.5 20z" fill="#FFD54F"/>
      <path d="M8 7c-1.5 4.5-1 9 .5 13" stroke="#F9A825" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      <circle cx="17" cy="4" r="1.2" fill="#F9A825"/>
      <path d="M4 10l1-2 1 2-2 1 2 1-1 2-1-2-2-1z" fill="#F9A825" opacity="0.7"/>
    </svg>
  );
}

const PLATFORM_ICONS = {
  'google-drive': HardDrive,
  gmail: Mail,
  'google-calendar': Calendar,
  'google-sheets': FileSpreadsheet,
  notion: Database,
  'nano-banana': null, // uses custom SVG component
};

const PLATFORM_COLORS = {
  'google-drive': '#4285F4',
  gmail: '#EA4335',
  'google-calendar': '#34A853',
  'google-sheets': '#0F9D58',
  notion: '#fff',
  'nano-banana': '#FFD54F',
};

function PlatformToolsSection({ agentName }) {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTool, setExpandedTool] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(`/api/platforms/agent/${agentName}/mcp-tools`);
        setTools(data || []);
      } catch (err) {
        console.error('Failed to load platform tools:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [agentName]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
        Loading platform tools...
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div style={{
        background: t.surface, border: `1px dashed ${t.border}`, borderRadius: '10px',
        padding: '24px', textAlign: 'center',
      }}>
        <Link2 size={24} style={{ color: t.tm, marginBottom: '10px' }} />
        <p style={{ fontSize: '13px', color: t.tm, margin: '0 0 4px' }}>No platform tools connected</p>
        <p style={{ fontSize: '11px', color: t.tm, margin: 0, lineHeight: 1.5 }}>
          Connect platforms in the <strong style={{ color: t.ts }}>Platforms</strong> tab to give this agent access to Google Drive, Gmail, Notion, and more via MCP.
        </p>
      </div>
    );
  }

  // Group tools by platform
  const grouped = {};
  for (const tool of tools) {
    const key = tool.platform_slug;
    if (!grouped[key]) grouped[key] = { name: tool.platform_name, slug: key, tools: [] };
    grouped[key].tools.push(tool);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Object.values(grouped).map(platform => {
        const PIcon = PLATFORM_ICONS[platform.slug] || Globe;
        const pColor = PLATFORM_COLORS[platform.slug] || t.violet;
        const isNanoBanana = platform.slug === 'nano-banana';

        return (
          <div key={platform.slug} style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px',
            overflow: 'hidden',
          }}>
            {/* Platform header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
              borderBottom: `1px solid ${t.border}`,
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                background: `${pColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isNanoBanana
                  ? <NanoBananaIcon size={16} />
                  : <PIcon size={14} style={{ color: pColor }} />
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{platform.name}</div>
                <div style={{ fontSize: '10px', color: t.tm }}>
                  {platform.tools.length} tool{platform.tools.length !== 1 ? 's' : ''} available via MCP
                </div>
              </div>
              <span style={{
                fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', padding: '3px 8px',
                borderRadius: '100px', backgroundColor: 'rgba(34,197,94,0.12)', color: t.success,
                letterSpacing: '0.04em',
              }}>
                Connected
              </span>
            </div>

            {/* Tool rows */}
            {platform.tools.map((tool, i) => {
              const isExpanded = expandedTool === tool.tool_name;
              return (
                <div key={tool.tool_name}>
                  <button
                    onClick={() => setExpandedTool(isExpanded ? null : tool.tool_name)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 16px', background: isExpanded ? 'rgba(139,92,246,0.04)' : 'transparent',
                      border: 'none', borderBottom: i < platform.tools.length - 1 || isExpanded ? `1px solid ${t.border}` : 'none',
                      cursor: 'pointer', textAlign: 'left', color: t.tp,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {isExpanded
                      ? <ChevronDown size={12} style={{ color: t.tm, flexShrink: 0 }} />
                      : <ChevronRight size={12} style={{ color: t.tm, flexShrink: 0 }} />
                    }
                    <code style={{ fontSize: '11px', fontFamily: t.mono, color: t.violet, fontWeight: '600' }}>
                      {tool.tool_name}
                    </code>
                    <span style={{ fontSize: '11px', color: t.ts, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tool.description}
                    </span>
                  </button>
                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      padding: '12px 16px 12px 38px',
                      borderBottom: i < platform.tools.length - 1 ? `1px solid ${t.border}` : 'none',
                      background: 'rgba(139,92,246,0.02)',
                    }}>
                      <div style={{ fontSize: '11px', color: t.ts, lineHeight: 1.6, marginBottom: '10px' }}>
                        {tool.description}
                      </div>
                      {tool.input_schema?.properties && (
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            Parameters
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {Object.entries(tool.input_schema.properties).map(([param, schema]) => {
                              const isRequired = (tool.input_schema.required || []).includes(param);
                              return (
                                <div key={param} style={{
                                  display: 'flex', alignItems: 'baseline', gap: '8px',
                                  padding: '4px 8px', background: t.surfaceEl, borderRadius: '4px',
                                }}>
                                  <code style={{ fontSize: '10px', fontFamily: t.mono, color: t.violet, fontWeight: '500' }}>{param}</code>
                                  <span style={{ fontSize: '9px', fontFamily: t.mono, color: t.tm }}>{schema.type}</span>
                                  {isRequired && (
                                    <span style={{ fontSize: '8px', fontWeight: '700', color: t.warning, textTransform: 'uppercase' }}>req</span>
                                  )}
                                  <span style={{ fontSize: '10px', color: t.tm, flex: 1 }}>{schema.description}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}


// ----- Main McpPanel Component -----
export default function McpPanel({ agentName, agent }) {
  const [section, setSection] = useState('overview');
  const [deployment, setDeployment] = useState(null);
  const [deployLoading, setDeployLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadDeployment = useCallback(async () => {
    try {
      const dep = await api(`/api/agent-deploy/${agentName}/deployment`);
      setDeployment(dep);
    } catch (err) {
      setDeployment(null);
    } finally {
      setInitialLoad(false);
    }
  }, [agentName]);

  useEffect(() => { loadDeployment(); }, [loadDeployment]);

  const handleDeploy = async () => {
    setDeployLoading(true);
    try {
      const result = await api(`/api/agent-deploy/${agentName}/deploy`, {
        method: 'POST',
        body: JSON.stringify({ tier: 'starter' }),
      });
      setDeployment(result.deployment);
      try { localStorage.setItem(`mcp_key_${agentName}`, result.apiKey); } catch (_) {}
      await loadDeployment();
      setSection('api-keys'); // Navigate to API keys to show the new key
    } catch (err) {
      alert(err.message || 'Deploy failed');
    } finally {
      setDeployLoading(false);
    }
  };

  const handleUndeploy = async () => {
    if (!window.confirm('Undeploy this MCP server? All API keys will be revoked.')) return;
    setDeployLoading(true);
    try {
      await api(`/api/agent-deploy/${agentName}/deployment`, { method: 'DELETE' });
      setDeployment(null);
      setSection('overview');
    } catch (err) {
      alert(err.message || 'Undeploy failed');
    } finally {
      setDeployLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: t.tm }}>
        Loading MCP configuration...
      </div>
    );
  }

  return (
    <div className="mcp-panel-container" style={{ display: 'flex', minHeight: 'calc(100vh - 220px)' }}>
      {/* Left Sidebar */}
      <div className="mcp-panel-sidebar" style={{
        width: '220px', flexShrink: 0, borderRight: `1px solid ${t.border}`,
        padding: '20px 0', background: t.surface,
      }}>
        <div style={{ padding: '0 16px 16px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Server size={14} style={{ color: t.violet }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: t.tp }}>MCP Server</span>
          </div>
          {deployment && (
            <span style={{
              fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', padding: '2px 8px',
              borderRadius: '100px',
              backgroundColor: deployment.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: deployment.status === 'active' ? t.success : t.warning,
            }}>
              {deployment.status}
            </span>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {MENU_ITEMS.map(item => {
            const isActive = section === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 16px', border: 'none', cursor: 'pointer',
                  background: isActive ? `${t.violet}15` : 'transparent',
                  borderRight: isActive ? `2px solid ${t.violet}` : '2px solid transparent',
                  color: isActive ? t.tp : t.ts,
                  fontSize: '13px', fontWeight: isActive ? '600' : '400',
                  transition: 'all 0.15s', textAlign: 'left', width: '100%',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon size={15} style={{ color: isActive ? item.color : t.tm, flexShrink: 0 }} />
                {item.label}
                {item.id === 'api-keys' && deployment?.apiKeys?.length > 0 && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '10px', fontFamily: t.mono,
                    background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '10px', color: t.tm,
                  }}>
                    {deployment.apiKeys.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick links */}
        {deployment && (
          <div style={{ padding: '16px', marginTop: 'auto', borderTop: `1px solid ${t.border}`, marginTop: '20px' }}>
            <a
              href={`/mcp/${deployment.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px', borderRadius: '6px', textDecoration: 'none',
                color: t.ts, fontSize: '11px', fontWeight: '500',
                background: t.surfaceEl, border: `1px solid ${t.border}`,
              }}
            >
              <Globe size={12} style={{ color: t.violet }} />
              View Landing Page
              <ExternalLink size={10} style={{ marginLeft: 'auto', color: t.tm }} />
            </a>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="mcp-panel-content" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {section === 'overview' && (
          <OverviewSection
            deployment={deployment}
            agent={agent}
            onDeploy={handleDeploy}
            deployLoading={deployLoading}
            onRefresh={loadDeployment}
          />
        )}
        {section === 'tools' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>MCP Tools</h2>
              <p style={{ fontSize: '12px', color: t.tm, margin: '0 0 4px', lineHeight: 1.5 }}>
                Configure specialized tools exposed by{' '}
                <span style={{ fontFamily: t.mono, color: t.violet, fontWeight: '600' }}>{agentName}</span>
                {' '}when used as an MCP server.
              </p>
              <p style={{ fontSize: '11px', color: t.tm, margin: 0, lineHeight: 1.5 }}>
                Specialized tools replace the generic "chat" tool with purpose-built operations. Each tool has structured parameters and context templates.
              </p>
            </div>
            <McpToolsManager agentName={agentName} />

            {/* Platform Tools */}
            <div style={{ marginTop: '32px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px',
                paddingBottom: '12px', borderBottom: `1px solid ${t.border}`,
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Link2 size={14} style={{ color: '#22c55e' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Platform Tools</h3>
                  <p style={{ fontSize: '11px', color: t.tm, margin: 0 }}>
                    Connected platforms are automatically exposed as MCP tools
                  </p>
                </div>
              </div>
              <div style={{
                background: 'rgba(139,92,246,0.04)', border: `1px solid ${t.violet}20`,
                borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                display: 'flex', alignItems: 'flex-start', gap: '8px',
              }}>
                <Zap size={13} style={{ color: t.violet, flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '11px', color: t.ts, lineHeight: 1.5 }}>
                  When you connect a platform (Google Drive, Gmail, etc.) in the <strong>Platforms</strong> tab, its actions become available as MCP tools. External clients calling this agent's MCP endpoint can use these tools to interact with connected services on your behalf.
                </span>
              </div>
              <PlatformToolsSection agentName={agentName} />
            </div>
          </div>
        )}
        {section === 'api-keys' && (
          <ApiKeysSection agentName={agentName} deployment={deployment} onRefresh={loadDeployment} />
        )}
        {section === 'logs' && (
          <LogsSection agentName={agentName} deployment={deployment} />
        )}
        {section === 'settings' && (
          <SettingsSection
            agentName={agentName}
            deployment={deployment}
            onUpdate={loadDeployment}
            onUndeploy={handleUndeploy}
            deployLoading={deployLoading}
          />
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mcp-panel-container { flex-direction: column !important; }
          .mcp-panel-sidebar {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            padding: 12px 0 !important;
          }
          .mcp-panel-sidebar nav {
            flex-direction: row !important;
            overflow-x: auto !important;
            padding: 0 12px !important;
            gap: 0 !important;
          }
          .mcp-panel-sidebar nav button {
            padding: 8px 14px !important;
            white-space: nowrap !important;
            border-right: none !important;
            border-bottom: 2px solid transparent !important;
            font-size: 12px !important;
          }
          .mcp-panel-content { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
