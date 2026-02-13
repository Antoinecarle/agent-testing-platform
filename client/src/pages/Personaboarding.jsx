import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Shield, Zap, MessageSquare, GitBranch, Wrench,
  Cpu, Settings, Sparkles, Check, Loader2, PenTool, ArrowRight,
} from 'lucide-react';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
  font: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
};

// ── CSS Keyframes ──────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
@keyframes pulse { 0%,100% { transform:scale(1); opacity:0.3; } 50% { transform:scale(1.25); opacity:0.6; } }
@keyframes cursorBlink { 0%,100% { opacity:1; } 50% { opacity:0; } }
@keyframes nodeGlow { 0%,100% { filter:drop-shadow(0 0 6px rgba(139,92,246,0.4)); } 50% { filter:drop-shadow(0 0 14px rgba(139,92,246,0.8)); } }
@keyframes drawPath {
  from { stroke-dashoffset: var(--path-len); }
  to { stroke-dashoffset: 0; }
}
@keyframes quillWrite {
  0% { transform:translateX(0) rotate(0deg); }
  25% { transform:translateX(3px) rotate(-3deg); }
  50% { transform:translateX(0) rotate(0deg); }
  75% { transform:translateX(-2px) rotate(2deg); }
  100% { transform:translateX(0) rotate(0deg); }
}
@keyframes constellationBirth {
  0% { opacity:0; transform:scale(0); }
  60% { opacity:1; transform:scale(1.08); }
  100% { opacity:1; transform:scale(1); }
}
@keyframes constellationBreathe {
  0%,100% { filter:drop-shadow(0 0 12px rgba(139,92,246,0.3)); }
  50% { filter:drop-shadow(0 0 24px rgba(139,92,246,0.7)); }
}
@keyframes constellationDrawConn {
  from { stroke-dashoffset: 300; }
  to { stroke-dashoffset: 0; }
}
@keyframes ambientRing {
  0% { r:60; opacity:0; }
  40% { opacity:0.12; }
  100% { r:200; opacity:0; }
}
@keyframes particleDrift {
  0% { opacity:0; r:1; }
  15% { opacity:0.5; }
  100% { opacity:0; r:0; transform:translate(var(--dx),var(--dy)); }
}
`;

// ── Typewriter ─────────────────────────────────────────────────────────────
function TypewriterText({ text, onComplete, speed = 25 }) {
  const [displayed, setDisplayed] = useState('');
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        cbRef.current?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  const showCursor = displayed.length < text.length;
  return (
    <span style={{ lineHeight: '1.7' }}>
      {displayed}
      {showCursor && (
        <span style={{
          display: 'inline-block', width: '2px', height: '1.1em',
          backgroundColor: t.violet, marginLeft: '2px', verticalAlign: 'middle',
          animation: 'cursorBlink 0.8s infinite',
        }} />
      )}
    </span>
  );
}

// ── Chip ───────────────────────────────────────────────────────────────────
function Chip({ label, selected, onClick, subtitle, multi, color }) {
  const [hov, setHov] = useState(false);
  const accent = color || t.violet;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px',
        padding: subtitle ? '10px 16px' : '8px 16px',
        backgroundColor: selected ? `${accent}22` : hov ? t.surfaceEl : t.surface,
        border: `1px solid ${selected ? accent : hov ? t.borderS : t.border}`,
        borderRadius: multi ? '8px' : '100px', cursor: 'pointer',
        transition: 'all 0.2s ease', textAlign: 'left',
        minWidth: subtitle ? '170px' : 'auto',
        boxShadow: selected ? `0 0 12px ${accent}20` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        {multi && (
          <div style={{
            width: 15, height: 15, borderRadius: 3, flexShrink: 0,
            border: `1.5px solid ${selected ? accent : t.tm}`,
            backgroundColor: selected ? accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}>
            {selected && <Check size={9} color="#fff" strokeWidth={3.5} />}
          </div>
        )}
        <span style={{ fontSize: '13px', fontWeight: 500, color: selected ? t.tp : t.ts }}>
          {label}
        </span>
        {!multi && selected && <Check size={12} color={accent} style={{ marginLeft: 'auto' }} />}
      </div>
      {subtitle && (
        <span style={{ fontSize: '11px', color: t.tm, marginLeft: multi ? '23px' : 0 }}>
          {subtitle}
        </span>
      )}
    </button>
  );
}

// ── Step metadata for SVG flow graph ───────────────────────────────────────
const STEP_META = [
  { id: 'name', label: 'Nom', Icon: User },
  { id: 'role', label: 'Rôle', Icon: Shield },
  { id: 'skills', label: 'Compétences', Icon: Zap },
  { id: 'comm', label: 'Communication', Icon: MessageSquare },
  { id: 'method', label: 'Méthodologie', Icon: GitBranch },
  { id: 'tools', label: 'Outils', Icon: Wrench },
  { id: 'model', label: 'Modèle', Icon: Cpu },
  { id: 'autonomy', label: 'Autonomie', Icon: Settings },
  { id: 'enhance', label: 'IA Enhance', Icon: Sparkles },
  { id: 'complete', label: 'Terminé', Icon: Check },
];

// ── Main Component ─────────────────────────────────────────────────────────
export default function Personaboarding() {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // API data
  const [options, setOptions] = useState(null);
  const [allRoles, setAllRoles] = useState([]);

  // User selections
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState(null);
  const [skills, setSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [commStyle, setCommStyle] = useState(null);
  const [methodology, setMethodology] = useState(null);
  const [selectedTools, setSelectedTools] = useState([]);
  const [model, setModel] = useState(null);
  const [autonomy, setAutonomy] = useState(null);
  const [gptData, setGptData] = useState(null);
  const [aiNarrative, setAiNarrative] = useState('');
  const [createdSkills, setCreatedSkills] = useState([]);
  const [createdAgent, setCreatedAgent] = useState(null);
  const [constellationReady, setConstellationReady] = useState(false);

  // Narrative history
  const [history, setHistory] = useState([]);

  // Fetch options on mount
  useEffect(() => {
    (async () => {
      try {
        const [opts, roles] = await Promise.all([
          api('/api/personaboarding/options'),
          api('/api/personaboarding/roles'),
        ]);
        setOptions(opts);
        setAllRoles(roles);
      } catch (err) {
        console.error('Failed to load personaboarding options:', err);
      }
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, typing, step]);

  // Focus input
  useEffect(() => {
    if (step === 0 && !typing) setTimeout(() => inputRef.current?.focus(), 100);
  }, [step, typing]);

  // ── Narrative prompts ────────────────────────────────────────────────────
  const prompts = [
    "Commençons la genèse. Quel sera le nom de votre agent ?",
    `Je m'appellerai ${displayName}. Quel rôle souhaitez-vous me confier ?`,
    `En tant que ${role?.label || '...'}, j'aurai besoin de compétences spécifiques. Quelles sont les miennes ?`,
    `Mes ${selectedSkills.length} compétences sont acquises. Comment souhaitez-vous que je communique ?`,
    `Style ${commStyle?.label || '...'} noté. Quelle méthodologie de travail me guidera ?`,
    `Méthodologie ${methodology?.label || '...'} intégrée. De quels outils aurai-je besoin ?`,
    `Mes outils sont configurés. Quel cerveau IA souhaitez-vous me donner ?`,
    `Je fonctionnerai avec ${model?.label || '...'}. Quel sera mon degré de liberté ?`,
    `Configuration terminée. L'intelligence artificielle analyse votre vision et compose mon essence...`,
    aiNarrative || `${displayName} est prêt. Son existence commence maintenant.`,
  ];

  // ── Advance to next step ─────────────────────────────────────────────────
  function advance(narrativeText) {
    setHistory(prev => [...prev, narrativeText]);
    setTyping(true);
    setStep(prev => prev + 1);
  }

  // ── Step handlers ────────────────────────────────────────────────────────
  function handleNameSubmit() {
    const name = displayName.trim();
    if (!name) return;
    setDisplayName(name);
    advance(`Je vais créer un agent qui s'appellera ${name}.`);
  }

  function handleRoleSelect(r) {
    setRole(r);
    const roleData = allRoles.find(ar => ar.id === r.id);
    setSkills(roleData?.skills || []);
    setSelectedSkills([]);
    advance(`${displayName} sera ${r.label}.`);
  }

  function handleSkillsValidate() {
    if (selectedSkills.length === 0) return;
    const list = selectedSkills.join(', ');
    advance(`${displayName} maîtrisera ${list}.`);
  }

  function handleCommStyleSelect(cs) {
    setCommStyle(cs);
    advance(`${displayName} communiquera de manière ${cs.label.toLowerCase()}.`);
  }

  function handleMethodologySelect(m) {
    setMethodology(m);
    advance(`${displayName} travaillera selon la méthodologie ${m.label}.`);
  }

  function handleToolsValidate() {
    if (selectedTools.length === 0) return;
    const list = selectedTools.join(', ');
    advance(`${displayName} utilisera les outils : ${list}.`);
  }

  function handleModelSelect(m) {
    setModel(m);
    advance(`Son moteur d'intelligence sera ${m.label}.`);
  }

  function handleAutonomySelect(a) {
    setAutonomy(a);
    advance(`Son niveau d'autonomie sera ${a.label.toLowerCase()}.`);
  }

  // AI Enhancement step
  async function handleAiEnhance() {
    setEnhancing(true);
    setError(null);
    try {
      const res = await api('/api/personaboarding/ai-enhance', {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          role: role.id,
          selectedSkills,
          commStyle: commStyle.id,
          methodology: methodology.id,
          selectedTools,
          model: model.id,
          autonomy: autonomy.id,
        }),
      });
      setGptData(res.gptData);
      setAiNarrative(res.narrative);
      setEnhancing(false);
      // Auto advance after showing AI narrative
      advance(`L'IA a parlé : "${res.narrative}"`);
    } catch (err) {
      // Fallback if GPT unavailable
      const fallbackNarrative = `Ainsi naquit ${displayName}, prêt à transformer chaque défi en opportunité.`;
      setAiNarrative(fallbackNarrative);
      setEnhancing(false);
      advance(`L'IA a parlé : "${fallbackNarrative}"`);
    }
  }

  // Final creation
  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api('/api/personaboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          role: role.id,
          selectedSkills,
          commStyle: commStyle.id,
          methodology: methodology.id,
          selectedTools,
          model: model.id,
          autonomy: autonomy.id,
          gptData: gptData || null,
        }),
      });
      setCreatedAgent(res.agent);
      // Build skill objects with colors from the role skills data
      const roleSkills = allRoles.find(r => r.id === role.id)?.skills || [];
      const skillsWithMeta = selectedSkills.map(name => {
        const meta = roleSkills.find(s => s.name === name);
        return { name, color: meta?.color || t.violet, category: meta?.category || '' };
      });
      setCreatedSkills(skillsWithMeta);
      setSuccess(true);
      // Don't redirect immediately — let constellation play first
    } catch (err) {
      setError(err.message || 'Erreur lors de la création');
      setSubmitting(false);
    }
  }

  // ── Build node values for the flow graph ─────────────────────────────────
  function getNodeValues() {
    return [
      displayName || null,
      role?.label || null,
      selectedSkills.length > 0 ? `${selectedSkills.length} skills` : null,
      commStyle?.label || null,
      methodology?.label || null,
      selectedTools.length > 0 ? `${selectedTools.length} outils` : null,
      model?.label || null,
      autonomy?.label || null,
      gptData ? 'Enhanced' : null,
      success ? 'Créé' : null,
    ];
  }

  // ── Render chip area per step ────────────────────────────────────────────
  function renderInput() {
    if (typing) return null;

    const fadeIn = { animation: 'fadeInUp 0.35s ease' };

    switch (step) {
      case 0:
        return (
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', ...fadeIn }}>
            <input
              ref={inputRef}
              autoFocus
              style={{
                backgroundColor: t.bg, border: `1px solid ${t.borderS}`,
                borderRadius: '6px', padding: '11px 14px', color: '#fff',
                fontSize: '14px', flex: 1, outline: 'none', fontFamily: t.font,
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = t.violet}
              onBlur={e => e.target.style.borderColor = t.borderS}
              placeholder="Nom de l'agent..."
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
            />
            <button
              disabled={!displayName.trim()}
              onClick={handleNameSubmit}
              style={{
                backgroundColor: displayName.trim() ? t.tp : t.surfaceEl,
                color: displayName.trim() ? t.bg : t.tm,
                border: 'none', borderRadius: '6px', padding: '0 22px',
                fontSize: '12px', fontWeight: 600,
                cursor: displayName.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              Continuer <ArrowRight size={14} />
            </button>
          </div>
        );

      case 1:
        if (!options) return <LoadingText />;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px', ...fadeIn }}>
            {options.roles.map(r => (
              <Chip key={r.id} label={r.label} subtitle={`${r.skillCount} compétences`}
                selected={role?.id === r.id} onClick={() => handleRoleSelect(r)} />
            ))}
          </div>
        );

      case 2:
        if (skills.length === 0) return <LoadingText text="Chargement des compétences..." />;
        return (
          <div style={{ marginTop: '20px', ...fadeIn }}>
            {selectedSkills.length > 0 && <SelectedBadges items={selectedSkills} />}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {skills.map(skill => (
                <Chip
                  key={skill.name} label={skill.name} subtitle={skill.description}
                  multi selected={selectedSkills.includes(skill.name)}
                  color={skill.color}
                  onClick={() => {
                    setSelectedSkills(prev =>
                      prev.includes(skill.name) ? prev.filter(s => s !== skill.name) : [...prev, skill.name]
                    );
                  }}
                />
              ))}
            </div>
            <ValidateButton disabled={selectedSkills.length === 0} onClick={handleSkillsValidate} label="Valider la maîtrise" />
          </div>
        );

      case 3:
        if (!options) return <LoadingText />;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px', ...fadeIn }}>
            {options.commStyles.map(cs => (
              <Chip key={cs.id} label={cs.label} subtitle={cs.description}
                selected={commStyle?.id === cs.id} onClick={() => handleCommStyleSelect(cs)} />
            ))}
          </div>
        );

      case 4:
        if (!options) return <LoadingText />;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px', ...fadeIn }}>
            {options.methodologies.map(m => (
              <Chip key={m.id} label={m.label} subtitle={m.description}
                selected={methodology?.id === m.id} onClick={() => handleMethodologySelect(m)} />
            ))}
          </div>
        );

      case 5:
        if (!options) return <LoadingText />;
        return (
          <div style={{ marginTop: '20px', ...fadeIn }}>
            {selectedTools.length > 0 && <SelectedBadges items={selectedTools} />}
            {/* Group tools by category */}
            {['files', 'system', 'search', 'web', 'agents'].map(cat => {
              const catTools = options.tools.filter(tl => tl.category === cat);
              if (catTools.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {cat}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {catTools.map(tl => (
                      <Chip
                        key={tl.id} label={tl.label} subtitle={tl.description}
                        multi selected={selectedTools.includes(tl.id)}
                        onClick={() => {
                          setSelectedTools(prev =>
                            prev.includes(tl.id) ? prev.filter(x => x !== tl.id) : [...prev, tl.id]
                          );
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <ValidateButton disabled={selectedTools.length === 0} onClick={handleToolsValidate} label="Valider les outils" />
          </div>
        );

      case 6:
        if (!options) return <LoadingText />;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px', ...fadeIn }}>
            {options.models.map(m => (
              <Chip key={m.id} label={m.label} subtitle={m.description}
                selected={model?.id === m.id} onClick={() => handleModelSelect(m)} />
            ))}
          </div>
        );

      case 7:
        if (!options) return <LoadingText />;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px', ...fadeIn }}>
            {options.autonomyLevels.map(a => (
              <Chip key={a.id} label={a.label} subtitle={a.description}
                selected={autonomy?.id === a.id} onClick={() => handleAutonomySelect(a)} />
            ))}
          </div>
        );

      case 8:
        return (
          <div style={{ marginTop: '24px', ...fadeIn }}>
            {enhancing ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '20px',
                backgroundColor: t.surface, borderRadius: '10px', border: `1px solid ${t.violetM}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: t.violetG, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PenTool size={16} color={t.violet} style={{ animation: 'quillWrite 1s ease-in-out infinite' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: t.tp, fontWeight: 500 }}>
                    L'IA compose votre agent...
                  </div>
                  <div style={{ fontSize: '11px', color: t.tm, marginTop: '4px' }}>
                    Optimisation de la matrice comportementale
                  </div>
                </div>
                <Loader2 size={16} color={t.violet} style={{ animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />
              </div>
            ) : (
              <button
                onClick={handleAiEnhance}
                style={{
                  backgroundColor: t.violet, color: '#fff', border: 'none', borderRadius: '10px',
                  padding: '14px 32px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '10px', fontFamily: t.font,
                  boxShadow: `0 0 24px ${t.violetG}`, transition: 'all 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Sparkles size={16} /> Lancer l'amélioration IA
              </button>
            )}
          </div>
        );

      case 9:
        return (
          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', ...fadeIn }}>
            {success ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
                padding: '32px', backgroundColor: t.surface, borderRadius: '12px',
                border: `1px solid ${t.violetM}`, animation: 'fadeInUp 0.5s ease',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  backgroundColor: `${t.success}22`, border: `2px solid ${t.success}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={28} color={t.success} />
                </div>
                <span style={{ fontSize: '15px', color: t.tp, fontWeight: 600 }}>
                  {displayName} est né
                </span>
                <span style={{ fontSize: '12px', color: t.ts, textAlign: 'center', maxWidth: '280px', lineHeight: '1.6' }}>
                  {createdSkills.length} compétences connectées. La constellation se forme...
                </span>
                {constellationReady && (
                  <button
                    onClick={() => navigate(`/agents/${createdAgent?.name || displayName.toLowerCase().replace(/\s+/g, '-')}`)}
                    style={{
                      backgroundColor: t.violet, color: '#fff', border: 'none', borderRadius: '10px',
                      padding: '12px 28px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px', fontFamily: t.font,
                      boxShadow: `0 0 24px ${t.violetG}`, transition: 'all 0.2s',
                      animation: 'fadeInUp 0.5s ease',
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <Sparkles size={15} /> Découvrir {displayName}
                  </button>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  style={{
                    backgroundColor: t.violet, color: '#fff', border: 'none', borderRadius: '10px',
                    padding: '14px 36px', fontSize: '15px', fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontFamily: t.font, boxShadow: `0 0 30px ${t.violetG}`,
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { if (!submitting) e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {submitting ? (
                    <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Création en cours...</>
                  ) : (
                    <><Sparkles size={18} /> Créer {displayName}</>
                  )}
                </button>
                {error && <span style={{ fontSize: '12px', color: t.danger }}>{error}</span>}
              </>
            )}
          </div>
        );

      default: return null;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const totalSteps = STEP_META.length;
  const nodeValues = getNodeValues();

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 56px)', backgroundColor: t.bg,
      color: t.tp, fontFamily: t.font, overflow: 'hidden',
    }}>
      <style>{KEYFRAMES}</style>

      {/* ── LEFT: Narrative Book ─────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 55%', display: 'flex', flexDirection: 'column',
        borderRight: `1px solid ${t.border}`, padding: '36px 40px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '4px 12px', borderRadius: '100px',
            backgroundColor: t.violetM, border: `1px solid rgba(139,92,246,0.3)`,
            color: t.violet, fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px',
          }}>
            <Sparkles size={11} /> Persona Onboarding
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: t.tp, margin: 0, letterSpacing: '-0.02em' }}>
            Créer votre agent personnel
          </h1>
          <p style={{ fontSize: '13px', color: t.tm, marginTop: '6px', margin: '6px 0 0' }}>
            Chaque choix construit l'histoire et les capacités de votre agent
          </p>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              width: i <= step ? '22px' : '6px', height: '4px', borderRadius: '100px',
              backgroundColor: i < step ? t.violet : i === step ? t.violet : t.surfaceEl,
              opacity: i < step ? 0.5 : i === step ? 1 : 0.25,
              transition: 'all 0.4s ease',
            }} />
          ))}
        </div>

        {/* Scrollable narrative area */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          {/* History lines */}
          {history.map((entry, idx) => (
            <p key={idx} style={{
              margin: '0 0 10px', fontSize: '15px', lineHeight: '1.7',
              color: t.ts, opacity: 0.5, fontStyle: 'italic',
            }}>
              {entry}
            </p>
          ))}

          {/* Current typing line */}
          <p style={{
            margin: '0 0 4px', fontSize: '17px', lineHeight: '1.7',
            color: t.tp, fontWeight: 500,
            display: 'flex', gap: step === 8 ? '10px' : '0',
          }}>
            {step === 8 && (
              <PenTool size={18} style={{ color: t.violet, marginTop: '4px', flexShrink: 0 }} />
            )}
            <TypewriterText
              key={`step-${step}`}
              text={prompts[step] || ''}
              onComplete={() => setTyping(false)}
            />
          </p>

          {/* Input area */}
          <div style={{ minHeight: '220px', marginTop: '8px' }}>
            {renderInput()}
          </div>

          <div ref={scrollRef} style={{ height: '20px' }} />
        </div>
      </div>

      {/* ── RIGHT: Flow Graph ────────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 45%', background: '#0a0a0a', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Dot grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(${t.border} 1px, transparent 1px)`,
          backgroundSize: '28px 28px', opacity: 0.4, pointerEvents: 'none',
        }} />

        {/* Ambient violet glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '30%',
          width: '200px', height: '200px', borderRadius: '50%',
          background: `radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)`,
          pointerEvents: 'none', filter: 'blur(40px)',
        }} />

        {/* Flow Graph or Constellation */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {success && createdSkills.length > 0 ? (
            <SkillConstellation
              agentName={displayName}
              roleLabel={role?.label || ''}
              skills={createdSkills}
              onComplete={() => setConstellationReady(true)}
            />
          ) : (
            <FlowGraphWithValues currentStep={step} nodeValues={nodeValues} />
          )}
        </div>

        {/* Step counter */}
        {!success && (
          <div style={{
            position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            fontSize: '11px', color: t.tm, fontFamily: t.mono,
          }}>
            {step + 1} / {totalSteps}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────
function LoadingText({ text = 'Chargement...' }) {
  return <span style={{ color: t.tm, fontSize: '12px', marginTop: '16px', display: 'block' }}>{text}</span>;
}

function SelectedBadges({ items }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px',
      marginBottom: '12px', padding: '10px 12px',
      backgroundColor: t.violetG, borderRadius: '8px', border: `1px solid ${t.violetM}`,
    }}>
      <span style={{
        fontSize: '11px', color: t.violet, fontWeight: 600, marginRight: '4px', lineHeight: '22px',
      }}>
        {items.length} sélectionnée{items.length > 1 ? 's' : ''} :
      </span>
      {items.map(s => (
        <span key={s} style={{
          fontSize: '11px', color: t.tp, backgroundColor: t.violetM,
          padding: '2px 8px', borderRadius: '100px', fontWeight: 500,
        }}>{s}</span>
      ))}
    </div>
  );
}

function ValidateButton({ disabled, onClick, label }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        backgroundColor: !disabled ? t.tp : t.surfaceEl,
        color: !disabled ? t.bg : t.tm,
        border: 'none', borderRadius: '6px', padding: '10px 24px',
        fontSize: '12px', fontWeight: 600,
        cursor: !disabled ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'all 0.2s',
      }}
    >
      {label} <ArrowRight size={14} />
    </button>
  );
}

// ── Flow Graph with node values ─────────────────────────────────────────
function FlowGraphWithValues({ currentStep, nodeValues }) {
  const nodeSpacing = 64;
  const cx = 90;
  const startY = 40;
  const svgH = startY + (STEP_META.length - 1) * nodeSpacing + 40;
  const nodes = STEP_META.map((s, i) => ({ ...s, x: cx, y: startY + i * nodeSpacing }));

  return (
    <svg width="230" height={svgH} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="pathGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.violet} />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>

      {/* Bezier paths */}
      {nodes.map((node, i) => {
        if (i >= nodes.length - 1) return null;
        const next = nodes[i + 1];
        const midY = (node.y + next.y) / 2;
        const d = `M ${node.x} ${node.y + 18} C ${node.x} ${midY}, ${next.x} ${midY}, ${next.x} ${next.y - 18}`;
        const isComplete = currentStep > i;
        return (
          <g key={`p-${i}`}>
            <path d={d} fill="none" stroke={t.border} strokeWidth="1.5" />
            {isComplete && (
              <path
                d={d} fill="none" stroke="url(#pathGrad)" strokeWidth="2"
                strokeDasharray="120"
                style={{ '--path-len': 120, animation: 'drawPath 0.8s ease-out forwards' }}
              />
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => {
        const isActive = currentStep === i;
        const isComplete = currentStep > i;
        const IconComp = node.Icon;
        const val = nodeValues[i];
        return (
          <g key={node.id}>
            {isActive && (
              <circle cx={node.x} cy={node.y} r="22" fill="none"
                stroke={t.violet} strokeWidth="1" opacity="0.4"
                style={{ transformOrigin: `${node.x}px ${node.y}px`, animation: 'pulse 2s ease-in-out infinite' }}
              />
            )}
            <circle
              cx={node.x} cy={node.y} r="18"
              fill={isComplete ? t.violet : isActive ? t.surfaceEl : t.surface}
              stroke={isComplete || isActive ? t.violet : t.border}
              strokeWidth={isActive ? 2 : 1.5}
              style={isComplete ? { animation: 'nodeGlow 3s ease-in-out infinite' } : {}}
            />
            <foreignObject x={node.x - 9} y={node.y - 9} width="18" height="18">
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isComplete ? '#fff' : isActive ? t.violet : t.tm,
                width: '100%', height: '100%',
              }}>
                <IconComp size={13} />
              </div>
            </foreignObject>
            <text x={node.x + 30} y={node.y + 4} style={{
              fontSize: '11px', fontWeight: isActive ? 600 : 400,
              fill: isActive ? t.tp : isComplete ? t.ts : t.tm,
              fontFamily: t.font,
            }}>
              {node.label}
            </text>
            {isComplete && val && (
              <text x={node.x + 30} y={node.y + 16} style={{
                fontSize: '9px', fill: t.violet, fontFamily: t.mono, opacity: 0.7,
              }}>
                {val.length > 20 ? val.slice(0, 20) + '…' : val}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Skill Constellation ─────────────────────────────────────────────────
function SkillConstellation({ agentName, roleLabel, skills = [], onComplete }) {
  const SIZE = 420;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const ORBIT = 150;
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;

  useEffect(() => {
    const total = (skills.length * 350) + 1500;
    const timer = setTimeout(() => cbRef.current?.(), total);
    return () => clearTimeout(timer);
  }, [skills.length]);

  // Compute skill positions around circle
  const nodes = skills.map((skill, i) => {
    const angle = ((i * 360) / skills.length - 90) * (Math.PI / 180);
    const x = CX + ORBIT * Math.cos(angle);
    const y = CY + ORBIT * Math.sin(angle);
    // Control point for curved connection
    const cpAngle = angle + 0.25;
    const cpR = ORBIT * 0.5;
    const cpx = CX + cpR * Math.cos(cpAngle);
    const cpy = CY + cpR * Math.sin(cpAngle);
    const path = `M ${CX} ${CY} Q ${cpx} ${cpy} ${x} ${y}`;
    return { ...skill, x, y, path, delay: i * 350 };
  });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '88%', height: '88%', overflow: 'visible' }}>
        <defs>
          <filter id="conGlow">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
        </defs>

        {/* Ambient rings */}
        {[0, 1, 2].map(i => (
          <circle key={`ring-${i}`} cx={CX} cy={CY} r="80" fill="none"
            stroke={t.violet} strokeWidth="0.8" opacity="0"
            style={{ transformOrigin: `${CX}px ${CY}px`, animation: `ambientRing ${3 + i}s ease-out infinite ${i * 1.2}s` }}
          />
        ))}

        {/* Connections — draw from center to each skill */}
        {nodes.map((node, i) => (
          <path
            key={`conn-${i}`}
            d={node.path}
            fill="none"
            stroke={node.color || t.violet}
            strokeWidth="1.5"
            strokeOpacity="0.35"
            strokeDasharray="300"
            strokeDashoffset="300"
            style={{ animation: `constellationDrawConn 1s ease-out forwards ${node.delay}ms` }}
          />
        ))}

        {/* Skill nodes */}
        {nodes.map((node, i) => {
          const isRight = node.x > CX;
          const isBottom = node.y > CY;
          return (
            <g key={`sn-${i}`}
              style={{
                transformOrigin: `${node.x}px ${node.y}px`,
                opacity: 0,
                animation: `constellationBirth 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards ${node.delay + 200}ms`,
              }}
            >
              {/* Outer glow */}
              <circle cx={node.x} cy={node.y} r="26" fill={node.color || t.violet} fillOpacity="0.08" />
              {/* Node circle */}
              <circle cx={node.x} cy={node.y} r="20"
                fill={t.surfaceEl} stroke={node.color || t.violet} strokeWidth="2"
              />
              {/* Inner dot */}
              <circle cx={node.x} cy={node.y} r="4" fill={node.color || t.violet} />
              {/* Skill name */}
              <text
                x={node.x + (isRight ? 28 : -28)}
                y={node.y - 1}
                textAnchor={isRight ? 'start' : 'end'}
                fill={t.tp}
                style={{ fontSize: '11px', fontWeight: 500, fontFamily: t.font }}
              >
                {node.name}
              </text>
              {/* Category */}
              <text
                x={node.x + (isRight ? 28 : -28)}
                y={node.y + 12}
                textAnchor={isRight ? 'start' : 'end'}
                fill={t.tm}
                style={{ fontSize: '8px', textTransform: 'uppercase', fontFamily: t.mono, letterSpacing: '0.06em' }}
              >
                {node.category}
              </text>
            </g>
          );
        })}

        {/* Center node — the agent */}
        <g style={{
          transformOrigin: `${CX}px ${CY}px`,
          animation: 'constellationBreathe 3s ease-in-out infinite',
        }}>
          {/* Layered glows */}
          <circle cx={CX} cy={CY} r="48" fill={t.violet} fillOpacity="0.05" />
          <circle cx={CX} cy={CY} r="44" fill={t.violet} fillOpacity="0.08" />
          {/* Main circle */}
          <circle cx={CX} cy={CY} r="38"
            fill={t.bg} stroke={t.violet} strokeWidth="2.5"
            filter="url(#conGlow)"
          />
          {/* Agent name */}
          <text x={CX} y={CY - 3} textAnchor="middle" fill={t.tp}
            style={{ fontSize: '14px', fontWeight: 700, fontFamily: t.font, letterSpacing: '-0.01em' }}
          >
            {agentName}
          </text>
          {/* Role label */}
          <text x={CX} y={CY + 13} textAnchor="middle" fill={t.ts}
            style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: t.mono, letterSpacing: '0.05em', opacity: 0.8 }}
          >
            {roleLabel}
          </text>
        </g>

        {/* Ambient particles drifting outward */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i * 36) * (Math.PI / 180);
          const dx = Math.cos(a) * 220;
          const dy = Math.sin(a) * 220;
          return (
            <circle key={`p-${i}`} cx={CX} cy={CY} r="1.5" fill={t.tp}
              style={{
                '--dx': `${dx}px`, '--dy': `${dy}px`,
                opacity: 0,
                animation: `particleDrift ${2.5 + (i % 3) * 0.5}s ease-out infinite ${i * 0.4}s`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
