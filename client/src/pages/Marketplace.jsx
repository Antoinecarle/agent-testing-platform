import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, Star, ChevronRight, User, Package, Eye,
  ArrowUpDown, LayoutGrid, Loader2
} from 'lucide-react';
import { api, getToken } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

function AgentCard({ agent, onDownload, navigate }) {
  const [hovered, setHovered] = useState(false);

  const formatName = (str) =>
    str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: t.surface,
        border: `1px solid ${hovered ? t.violet : t.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 24px rgba(0,0,0,0.5), 0 0 20px ${t.violetG}` : 'none',
      }}
    >
      <div style={{
        aspectRatio: '16/10',
        backgroundColor: '#141415',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: `1px solid ${t.border}`,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {agent.featured_project_id && agent.featured_iteration_id ? (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '400%', height: '400%',
            transform: 'scale(0.25)', transformOrigin: 'top left', pointerEvents: 'none',
          }}>
            <iframe
              src={`/api/preview/${agent.featured_project_id}/${agent.featured_iteration_id}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={`Preview ${agent.name}`}
              loading="lazy"
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            backgroundColor: t.violetM, color: t.violet,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: '700', border: `1px solid ${t.violet}30`,
          }}>
            {agent.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            display: 'inline-flex', padding: '2px 6px', borderRadius: '4px',
            fontSize: '9px', fontWeight: '700', textTransform: 'uppercase',
            backgroundColor: `${t.violet}15`, color: t.violet,
            border: `1px solid ${t.violet}25`, marginRight: '4px',
          }}>{agent.category || 'General'}</span>
          <span style={{
            display: 'inline-flex', padding: '2px 6px', borderRadius: '4px',
            fontSize: '9px', fontWeight: '700', textTransform: 'uppercase',
            backgroundColor: `${t.ts}15`, color: t.ts,
            border: `1px solid ${t.ts}25`,
          }}>{agent.model || 'unknown'}</span>
        </div>

        <h3 style={{ fontSize: '15px', fontWeight: '600', color: t.tp, marginBottom: '4px', margin: '0 0 4px 0' }}>
          {formatName(agent.name)}
        </h3>
        <p style={{
          fontSize: '12px', color: t.ts, lineHeight: '1.4', marginBottom: '12px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', height: '34px', margin: '0 0 12px 0',
        }}>
          {agent.description || 'No description provided.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: t.tm, marginBottom: '12px' }}>
          <User size={12} />
          <span>{agent.creator?.display_name || 'Platform'}</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: '12px', borderTop: `1px solid ${t.border}`, marginTop: 'auto',
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: t.ts }}>
              <Download size={12} color={t.tm} />
              <span>{agent.download_count || 0}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: t.ts }}>
              <Package size={12} color={t.tm} />
              <span>{agent.project_count || 0}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={10}
                fill={i <= (agent.rating || 0) ? t.warning : 'transparent'}
                color={i <= (agent.rating || 0) ? t.warning : t.tm}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(agent.name); }}
            style={{
              backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
              borderRadius: '4px', padding: '6px 10px', fontSize: '11px', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <Download size={13} /> Download
          </button>
          <button
            onClick={() => navigate(`/marketplace/${agent.name}`)}
            style={{
              backgroundColor: t.tp, color: t.bg, border: 'none',
              borderRadius: '4px', padding: '6px 10px', fontSize: '11px', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <Eye size={13} /> Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortBy });
      if (search) params.set('search', search);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);

      const [agentData, catData] = await Promise.all([
        api(`/api/marketplace?${params.toString()}`),
        api('/api/categories'),
      ]);
      setAgents(agentData || []);
      setCategories(catData || []);
    } catch (err) {
      console.error('Marketplace fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchData, 300);
    return () => clearTimeout(timeout);
  }, [search, selectedCategory, sortBy]);

  const handleDownload = async (agentName) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/marketplace/${encodeURIComponent(agentName)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agentName}.md`;
      a.click();
      URL.revokeObjectURL(url);
      // Refresh to update download count
      fetchData();
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const formatName = (str) =>
    str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <div style={{ backgroundColor: t.bg, minHeight: 'calc(100vh - 53px)', color: t.tp, padding: '40px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em', marginBottom: '12px' }}>
            Agent Marketplace
          </h1>
          <p style={{ fontSize: '14px', color: t.ts, marginBottom: '24px' }}>
            Browse, download, and explore AI agents for your projects
          </p>
          <div style={{ position: 'relative', maxWidth: '500px', margin: '0 auto' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: t.tm }} />
            <input
              style={{
                width: '100%', backgroundColor: t.surface, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '10px 16px 10px 40px', color: t.tp,
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
              placeholder="Search agents, capabilities, models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <div
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '6px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: '500',
                cursor: 'pointer', whiteSpace: 'nowrap',
                backgroundColor: selectedCategory === 'all' ? t.violetM : t.surface,
                color: selectedCategory === 'all' ? t.violet : t.ts,
                border: `1px solid ${selectedCategory === 'all' ? t.violet : t.border}`,
              }}
            >
              All Agents
            </div>
            {categories.map(cat => (
              <div
                key={cat.id || cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                style={{
                  padding: '6px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: '500',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  backgroundColor: selectedCategory === cat.name ? t.violetM : t.surface,
                  color: selectedCategory === cat.name ? t.violet : t.ts,
                  border: `1px solid ${selectedCategory === cat.name ? t.violet : t.border}`,
                }}
              >
                {formatName(cat.name)}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpDown size={14} style={{ color: t.tm }} />
            <select
              style={{
                backgroundColor: t.surface, border: `1px solid ${t.border}`, color: t.ts,
                padding: '6px 12px', borderRadius: '6px', fontSize: '12px', outline: 'none', cursor: 'pointer',
              }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="popular">Popular</option>
              <option value="rating">Top Rated</option>
              <option value="recent">Recently Added</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {agents.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: t.tm }}>
            <LayoutGrid size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>No agents found matching your criteria.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px',
            opacity: loading && agents.length === 0 ? 0.5 : 1,
            transition: 'opacity 0.2s ease',
          }}>
            {agents.map(agent => (
              <AgentCard
                key={agent.name}
                agent={agent}
                onDownload={handleDownload}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
