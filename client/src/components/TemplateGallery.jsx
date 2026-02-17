import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b',
};

export default function TemplateGallery({ compact = false, onProjectCreated }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);

  useEffect(() => {
    api('/api/projects/templates')
      .then(data => setTemplates(data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const handleUseTemplate = async (tmpl) => {
    if (creating) return;
    setCreating(tmpl.id);
    try {
      const result = await api('/api/projects/from-template', {
        method: 'POST',
        body: JSON.stringify({ template_id: tmpl.id }),
      });
      if (onProjectCreated) onProjectCreated();
      navigate(`/project/${result.project.id}`);
    } catch (err) {
      console.error('Failed to create from template:', err);
      alert('Failed to create project from template.');
    } finally {
      setCreating(null);
    }
  };

  if (loading) return null;
  if (templates.length === 0) return null;

  // Compact mode: horizontal scroll row
  if (compact) {
    return (
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color={t.violet} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: t.tp }}>Start from a Template</span>
          </div>
        </div>
        <div style={{
          display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
          {templates.map(tmpl => (
            <TemplateCard
              key={tmpl.id}
              tmpl={tmpl}
              compact
              creating={creating}
              onUse={handleUseTemplate}
            />
          ))}
        </div>
      </div>
    );
  }

  // Full mode: grid for empty state
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '100px',
          background: t.violetG, border: `1px solid ${t.violet}33`,
          fontSize: '12px', color: t.violet, fontWeight: 600, marginBottom: '16px',
        }}>
          <Sparkles size={12} /> Ready-made templates
        </div>
        <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.02em' }}>
          Pick a template and see the magic
        </h3>
        <p style={{ color: t.ts, fontSize: '14px', maxWidth: '420px', margin: '0 auto', lineHeight: '1.5' }}>
          Each template was built by a specialized AI agent. Click "Use Template" to create your own project instantly.
        </p>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px',
      }}>
        {templates.map(tmpl => (
          <TemplateCard
            key={tmpl.id}
            tmpl={tmpl}
            creating={creating}
            onUse={handleUseTemplate}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ tmpl, compact, creating, onUse }) {
  const isCreating = creating === tmpl.id;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      style={{
        flex: compact ? '0 0 280px' : undefined,
        background: t.surface,
        borderRadius: '14px',
        border: `1px solid ${t.border}`,
        overflow: 'hidden',
        cursor: 'default',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${tmpl.accent_color || t.violet}44`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; }}
    >
      {/* Preview iframe */}
      <div style={{
        width: '100%',
        height: compact ? '140px' : '180px',
        overflow: 'hidden',
        position: 'relative',
        background: '#111',
      }}>
        <iframe
          src={`/api/preview/template/${tmpl.id}`}
          title={`Preview ${tmpl.name}`}
          style={{
            width: '1280px',
            height: '800px',
            border: 'none',
            transform: compact ? 'scale(0.22)' : 'scale(0.27)',
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
          sandbox="allow-same-origin"
          loading="lazy"
        />
        {/* Category badge */}
        {tmpl.category && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            padding: '3px 8px', borderRadius: '6px',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            fontSize: '10px', fontWeight: 600, color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {tmpl.category}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: compact ? '12px' : '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: tmpl.accent_color || t.violet,
            boxShadow: `0 0 6px ${tmpl.accent_color || t.violet}`,
          }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: t.tp, letterSpacing: '-0.01em' }}>
            {tmpl.name}
          </span>
        </div>
        {!compact && (
          <p style={{
            fontSize: '12px', color: t.ts, lineHeight: '1.5',
            marginBottom: '12px', height: '36px', overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {tmpl.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: compact ? '10px' : 0 }}>
          <button
            onClick={() => onUse(tmpl)}
            disabled={!!creating}
            style={{
              flex: 1, padding: '8px 14px', borderRadius: '8px',
              background: tmpl.accent_color || t.violet,
              color: '#fff', border: 'none',
              fontSize: '12px', fontWeight: 700,
              cursor: creating ? 'wait' : 'pointer',
              opacity: creating && !isCreating ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'opacity 0.2s',
            }}
          >
            {isCreating ? (
              <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</>
            ) : (
              <>Use Template <ArrowRight size={12} /></>
            )}
          </button>
          {!compact && tmpl.agent_name && (
            <div style={{
              padding: '3px 8px', borderRadius: '6px',
              background: t.surfaceEl, border: `1px solid ${t.border}`,
              fontSize: '10px', color: t.ts, fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {tmpl.agent_name}
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </motion.div>
  );
}
