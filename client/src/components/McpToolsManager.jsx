import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Edit3, X, Check, ChevronUp, ChevronDown,
  Save, Wrench, Code, FileText, AlertCircle, Sparkles,
  ToggleLeft, ToggleRight, Copy, Eye, EyeOff, GripVertical
} from 'lucide-react';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px',
};
const inputStyle = {
  width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
  borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const DEFAULT_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    message: { type: 'string', description: 'Your message' },
  },
  required: ['message'],
}, null, 2);

function CodeEditor({ value, onChange, placeholder, language, height = '200px', hint }) {
  const textareaRef = useRef(null);
  const lineCount = (value || '').split('\n').length;
  const lines = Array.from({ length: Math.max(lineCount, 5) }, (_, i) => i + 1);

  return (
    <div>
      {hint && (
        <div style={{
          padding: '6px 10px', backgroundColor: t.violetG, border: `1px solid ${t.violetM}`,
          borderBottom: 'none', borderRadius: '8px 8px 0 0', fontSize: '11px', color: t.violet,
          fontFamily: t.mono, display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <Sparkles size={12} />
          {hint}
        </div>
      )}
      <div style={{
        display: 'flex', backgroundColor: t.bg,
        border: `1px solid ${t.borderS}`,
        borderRadius: hint ? '0 0 8px 8px' : '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 8px', borderRight: `1px solid ${t.border}`,
          userSelect: 'none', minWidth: '36px', textAlign: 'right',
          fontFamily: t.mono, fontSize: '12px', color: t.tm,
          lineHeight: '1.5',
        }}>
          {lines.map(n => <div key={n}>{n}</div>)}
        </div>
        <textarea
          ref={textareaRef}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            flex: 1, background: 'transparent', color: t.tp,
            fontFamily: t.mono, fontSize: '12px', lineHeight: '1.5',
            padding: '12px', border: 'none', outline: 'none',
            resize: 'vertical', minHeight: height,
            boxSizing: 'border-box', width: '100%',
          }}
        />
      </div>
    </div>
  );
}

function ToolCard({ tool, onEdit, onDelete, onToggle, onMove, isFirst, isLast, deleting, onConfirmDelete, onCancelDelete }) {
  const [hover, setHover] = useState(false);
  const isActive = tool.is_active !== false;
  const paramCount = tool.input_schema?.properties ? Object.keys(tool.input_schema.properties).length : 0;
  const requiredCount = tool.input_schema?.required?.length || 0;
  const hasTemplate = !!tool.context_template;
  const hasInstructions = !!tool.output_instructions;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: t.surface,
        border: `1px solid ${hover ? (isActive ? t.violet : t.borderS) : t.border}`,
        borderRadius: '8px',
        padding: '16px',
        transition: 'all 0.2s',
        opacity: isActive ? 1 : 0.5,
        boxShadow: hover && isActive ? `0 0 20px ${t.violetG}` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Sort arrows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingTop: '2px' }}>
          <button
            onClick={() => onMove('up')}
            disabled={isFirst}
            style={{
              background: 'none', border: 'none', padding: '2px', cursor: isFirst ? 'default' : 'pointer',
              color: isFirst ? t.tm : t.ts, opacity: isFirst ? 0.3 : 1,
            }}
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={isLast}
            style={{
              background: 'none', border: 'none', padding: '2px', cursor: isLast ? 'default' : 'pointer',
              color: isLast ? t.tm : t.ts, opacity: isLast ? 0.3 : 1,
            }}
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Icon */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px',
          backgroundColor: isActive ? t.violetG : t.surfaceEl,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {tool.tool_name === 'chat' ? (
            <FileText size={16} color={isActive ? t.violet : t.tm} />
          ) : (
            <Wrench size={16} color={isActive ? t.violet : t.tm} />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '14px', fontWeight: 600, color: t.tp,
              fontFamily: t.mono,
            }}>
              {tool.tool_name}
            </span>
            {!isActive && (
              <span style={{
                fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                backgroundColor: 'rgba(239,68,68,0.1)', color: t.danger,
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Inactive
              </span>
            )}
          </div>
          <p style={{
            fontSize: '12px', color: t.ts, margin: 0, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {tool.description}
          </p>

          {/* Meta badges */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px', padding: '2px 8px', borderRadius: '100px',
              backgroundColor: t.surfaceEl, color: t.ts,
              fontFamily: t.mono,
            }}>
              {paramCount} params {requiredCount > 0 && `(${requiredCount} req)`}
            </span>
            {hasTemplate && (
              <span style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: '100px',
                backgroundColor: t.violetG, color: t.violet,
              }}>
                context template
              </span>
            )}
            {hasInstructions && (
              <span style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: '100px',
                backgroundColor: 'rgba(34,197,94,0.1)', color: t.success,
              }}>
                output format
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={onToggle}
            title={isActive ? 'Deactivate' : 'Activate'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px', borderRadius: '4px', display: 'flex',
              color: isActive ? t.success : t.tm,
            }}
          >
            {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px', borderRadius: '4px', display: 'flex', color: t.ts,
            }}
          >
            <Edit3 size={15} />
          </button>
          {deleting ? (
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                onClick={onConfirmDelete}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '4px', display: 'flex', color: t.danger,
                }}
              >
                <Check size={15} />
              </button>
              <button
                onClick={onCancelDelete}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '4px', display: 'flex', color: t.ts,
                }}
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={onDelete}
              title="Delete"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px', borderRadius: '4px', display: 'flex', color: t.tm,
              }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function McpToolsManager({ agentName }) {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [schemaError, setSchemaError] = useState(null);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    tool_name: '',
    description: '',
    input_schema: DEFAULT_SCHEMA,
    context_template: '',
    output_instructions: '',
    is_active: true,
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadTools = useCallback(async () => {
    try {
      const data = await api(`/api/agents/${agentName}/mcp-tools`);
      setTools(data || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [agentName, showToast]);

  useEffect(() => { loadTools(); }, [loadTools]);

  const openCreate = () => {
    setEditingTool(null);
    setForm({
      tool_name: '',
      description: '',
      input_schema: DEFAULT_SCHEMA,
      context_template: '',
      output_instructions: '',
      is_active: true,
    });
    setSchemaError(null);
    setShowModal(true);
  };

  const openEdit = (tool) => {
    setEditingTool(tool);
    setForm({
      tool_name: tool.tool_name,
      description: tool.description || '',
      input_schema: typeof tool.input_schema === 'string'
        ? tool.input_schema
        : JSON.stringify(tool.input_schema, null, 2),
      context_template: tool.context_template || '',
      output_instructions: tool.output_instructions || '',
      is_active: tool.is_active !== false,
    });
    setSchemaError(null);
    setShowModal(true);
  };

  const validateSchema = (str) => {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed !== 'object') return 'Must be a JSON object';
      return null;
    } catch (e) {
      return `Invalid JSON: ${e.message}`;
    }
  };

  const handleSave = async () => {
    if (!form.tool_name.trim()) return showToast('Tool name is required', 'danger');
    if (!form.description.trim()) return showToast('Description is required', 'danger');
    if (!/^[a-z][a-z0-9_]*$/.test(form.tool_name)) {
      return showToast('Tool name must be snake_case (lowercase, underscores only)', 'danger');
    }

    const schemaErr = validateSchema(form.input_schema);
    if (schemaErr) {
      setSchemaError(schemaErr);
      return showToast('Fix the JSON Schema errors first', 'danger');
    }

    setSaving(true);
    try {
      const body = {
        tool_name: form.tool_name,
        description: form.description,
        input_schema: JSON.parse(form.input_schema),
        context_template: form.context_template || null,
        output_instructions: form.output_instructions || null,
        is_active: form.is_active,
      };

      if (editingTool) {
        await api(`/api/agents/${agentName}/mcp-tools/${editingTool.id}`, {
          method: 'PUT', body: JSON.stringify(body),
        });
        showToast('Tool updated');
      } else {
        await api(`/api/agents/${agentName}/mcp-tools`, {
          method: 'POST', body: JSON.stringify(body),
        });
        showToast('Tool created');
      }
      setShowModal(false);
      loadTools();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (tool) => {
    try {
      await api(`/api/agents/${agentName}/mcp-tools/${tool.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !tool.is_active }),
      });
      loadTools();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDelete = async (tool) => {
    try {
      await api(`/api/agents/${agentName}/mcp-tools/${tool.id}`, { method: 'DELETE' });
      setDeletingId(null);
      showToast('Tool deleted');
      loadTools();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleMove = async (tool, direction) => {
    const idx = tools.findIndex(t => t.id === tool.id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tools.length) return;

    const newTools = [...tools];
    [newTools[idx], newTools[swapIdx]] = [newTools[swapIdx], newTools[idx]];
    setTools(newTools);

    try {
      await api(`/api/agents/${agentName}/mcp-tools/reorder`, {
        method: 'POST',
        body: JSON.stringify({ toolIds: newTools.map(t => t.id) }),
      });
    } catch (err) {
      showToast(err.message, 'danger');
      loadTools();
    }
  };

  const formatSchema = () => {
    try {
      const parsed = JSON.parse(form.input_schema);
      setForm(f => ({ ...f, input_schema: JSON.stringify(parsed, null, 2) }));
      setSchemaError(null);
    } catch (e) {
      setSchemaError(e.message);
    }
  };

  const handleGenerate = async () => {
    if (tools.length > 0 && !window.confirm('This will replace all existing tools with AI-generated ones. Continue?')) return;
    setGenerating(true);
    try {
      const result = await api(`/api/agents/${agentName}/mcp-tools/generate`, { method: 'POST' });
      showToast(`Generated ${result.saved_count} tools from agent context (${Math.round(result.context_size / 1000)}K chars analyzed)`);
      loadTools();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '40px', textAlign: 'center', color: t.ts, fontSize: '13px' }}>
        Loading tools...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 3000,
          backgroundColor: toast.type === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          border: `1px solid ${toast.type === 'danger' ? t.danger : t.success}`,
          padding: '10px 20px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', gap: '8px',
          color: toast.type === 'danger' ? t.danger : t.success,
          fontSize: '13px', fontWeight: 500,
          backdropFilter: 'blur(8px)',
        }}>
          {toast.type === 'danger' ? <AlertCircle size={14} /> : <Check size={14} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: t.violetG, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Wrench size={16} color={t.violet} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: t.tp }}>
              MCP Tools
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: t.tm }}>
              {tools.length} tool{tools.length !== 1 ? 's' : ''} configured
              {' '}&middot;{' '}
              {tools.filter(t => t.is_active !== false).length} active
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: generating ? t.surfaceEl : t.violetM,
              color: generating ? t.tm : t.violet,
              border: `1px solid ${generating ? t.border : t.violet}`,
              borderRadius: '6px', padding: '8px 14px',
              fontSize: '12px', fontWeight: 600,
              cursor: generating ? 'wait' : 'pointer',
              opacity: generating ? 0.7 : 1,
            }}
          >
            <Sparkles size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating...' : 'Auto-generate'}
          </button>
          <button
            onClick={openCreate}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: t.tp, color: t.bg, border: 'none',
              borderRadius: '6px', padding: '8px 14px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Add Tool
          </button>
        </div>
      </div>

      {/* Tool List or Empty State */}
      {tools.length === 0 ? (
        <div style={{
          border: `2px dashed ${t.border}`, borderRadius: '12px',
          padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            backgroundColor: t.violetG, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Code size={24} color={t.violet} />
          </div>
          <h4 style={{ margin: '0 0 8px', color: t.tp, fontSize: '14px', fontWeight: 600 }}>
            No MCP Tools configured
          </h4>
          <p style={{ margin: '0 0 20px', color: t.ts, fontSize: '13px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
            MCP Tools replace the generic "chat" tool with specialized, purpose-built tools.
            Each tool has structured parameters and context templates that force better input and produce better output.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                backgroundColor: t.violet, color: '#fff', border: 'none',
                borderRadius: '6px', padding: '12px 24px',
                fontSize: '13px', fontWeight: 600,
                cursor: generating ? 'wait' : 'pointer',
                opacity: generating ? 0.7 : 1,
              }}
            >
              <Sparkles size={14} />
              {generating ? 'Analyzing agent...' : 'Auto-generate from Skills & Prompt'}
            </button>
            <button
              onClick={openCreate}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                backgroundColor: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
                borderRadius: '6px', padding: '12px 24px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Create Manually
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tools.map((tool, idx) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isFirst={idx === 0}
              isLast={idx === tools.length - 1}
              deleting={deletingId === tool.id}
              onEdit={() => openEdit(tool)}
              onDelete={() => setDeletingId(tool.id)}
              onConfirmDelete={() => handleDelete(tool)}
              onCancelDelete={() => setDeletingId(null)}
              onToggle={() => handleToggle(tool)}
              onMove={(dir) => handleMove(tool, dir)}
            />
          ))}
        </div>
      )}

      {/* Info footer */}
      {tools.length > 0 && (
        <div style={{
          marginTop: '16px', padding: '12px 16px',
          backgroundColor: t.surfaceEl, borderRadius: '8px',
          fontSize: '11px', color: t.tm, lineHeight: 1.5,
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            Tools are exposed in order via the MCP protocol. Agents without custom tools get the default
            <code style={{ fontFamily: t.mono, color: t.ts, padding: '0 4px' }}>chat</code> +
            <code style={{ fontFamily: t.mono, color: t.ts, padding: '0 4px' }}>get_agent_info</code> tools.
            Specialized tools produce significantly better output thanks to structured parameters and context enrichment.
          </span>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: '900px', maxWidth: '95vw', maxHeight: '90vh',
              backgroundColor: t.surface,
              border: `1px solid ${t.borderS}`,
              borderRadius: '12px',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Wrench size={16} color={t.violet} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: t.tp }}>
                  {editingTool ? `Edit: ${editingTool.tool_name}` : 'New MCP Tool'}
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: t.tm, padding: '4px', display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {/* Row 1: Name + Description */}
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Tool Name</label>
                  <input
                    value={form.tool_name}
                    onChange={e => setForm(f => ({ ...f, tool_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    placeholder="audit_site"
                    disabled={!!editingTool}
                    style={{
                      ...inputStyle,
                      fontFamily: t.mono,
                      opacity: editingTool ? 0.6 : 1,
                    }}
                  />
                  <div style={{ fontSize: '10px', color: t.tm, marginTop: '4px' }}>
                    snake_case only. Cannot change after creation.
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What this tool does — shown to Claude when listing tools"
                    style={inputStyle}
                  />
                  <div style={{ fontSize: '10px', color: t.tm, marginTop: '4px' }}>
                    Shown to the AI when it lists available tools. Be descriptive.
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: form.is_active ? t.success : t.tm, display: 'flex',
                  }}
                >
                  {form.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <span style={{ fontSize: '12px', color: form.is_active ? t.tp : t.tm }}>
                  {form.is_active ? 'Active — tool is exposed via MCP' : 'Inactive — tool is hidden'}
                </span>
              </div>

              {/* Input Schema */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    <Code size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                    Input Schema (JSON)
                  </label>
                  <button
                    onClick={formatSchema}
                    style={{
                      background: 'none', border: `1px solid ${t.border}`, borderRadius: '4px',
                      padding: '3px 8px', fontSize: '10px', color: t.ts, cursor: 'pointer',
                      fontFamily: t.mono,
                    }}
                  >
                    Format JSON
                  </button>
                </div>
                <CodeEditor
                  value={form.input_schema}
                  onChange={val => {
                    setForm(f => ({ ...f, input_schema: val }));
                    setSchemaError(validateSchema(val));
                  }}
                  placeholder='{"type": "object", "properties": {...}, "required": [...]}'
                  language="json"
                  height="180px"
                />
                {schemaError && (
                  <div style={{
                    marginTop: '6px', padding: '6px 10px', borderRadius: '4px',
                    backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid ${t.danger}`,
                    fontSize: '11px', color: t.danger, fontFamily: t.mono,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <AlertCircle size={12} /> {schemaError}
                  </div>
                )}
              </div>

              {/* Context Template */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>
                  <FileText size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                  Context Template
                </label>
                <CodeEditor
                  value={form.context_template}
                  onChange={val => setForm(f => ({ ...f, context_template: val }))}
                  placeholder="## TASK: {{tool_name}}\n\nLanguage: {{language}}\n{{#if competitors}}Competitors: {{competitors}}{{/if}}\n{{__html_analysis__}}"
                  language="markdown"
                  height="160px"
                  hint="Placeholders: {{param}} &middot; {{#if param}}...{{/if}} &middot; {{__html_analysis__}} &middot; {{__json_parse:param__}} &middot; {{__array:param__}}"
                />
                <div style={{ fontSize: '10px', color: t.tm, marginTop: '4px' }}>
                  Injected into the LLM system prompt. Params from input_schema are auto-filled. HTML params are auto-extracted (title, meta, headings, schema...).
                </div>
              </div>

              {/* Output Instructions */}
              <div>
                <label style={labelStyle}>
                  <FileText size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                  Output Instructions
                </label>
                <CodeEditor
                  value={form.output_instructions}
                  onChange={val => setForm(f => ({ ...f, output_instructions: val }))}
                  placeholder="Return a structured audit report with:\n1. Score (0-100)\n2. Critical issues with code fixes\n3. Action plan"
                  language="markdown"
                  height="120px"
                />
                <div style={{ fontSize: '10px', color: t.tm, marginTop: '4px' }}>
                  Appended to system prompt to control the LLM output format.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px', borderTop: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  backgroundColor: t.surfaceEl, color: t.ts,
                  border: `1px solid ${t.borderS}`, borderRadius: '6px',
                  padding: '8px 16px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: t.tp, color: t.bg,
                  border: 'none', borderRadius: '6px',
                  padding: '8px 16px', fontSize: '12px', fontWeight: 600,
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <Save size={14} />
                {saving ? 'Saving...' : editingTool ? 'Update Tool' : 'Create Tool'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
