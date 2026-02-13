import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, Loader2, ArrowRight } from 'lucide-react';
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

// ── Typewriter ──────────────────────────────────────────────────────────────
function TypewriterText({ text, onComplete, speed = 25, style = {} }) {
  const [displayed, setDisplayed] = useState('');
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        completeRef.current?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <span style={{ lineHeight: '1.7', ...style }}>{displayed}<span style={{ opacity: displayed.length < text.length ? 1 : 0, transition: 'opacity 0.3s' }}>|</span></span>;
}

// ── Chip ────────────────────────────────────────────────────────────────────
function Chip({ label, selected, onClick, subtitle, multi }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px',
        padding: subtitle ? '10px 16px' : '8px 14px',
        backgroundColor: selected ? t.violetG : hovered ? t.surfaceEl : t.surface,
        border: `1px solid ${selected ? t.violet : hovered ? t.borderS : t.border}`,
        borderRadius: '8px', cursor: 'pointer',
        transition: 'all 0.2s ease', textAlign: 'left',
        minWidth: subtitle ? '180px' : 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        {multi && (
          <div style={{
            width: 16, height: 16, borderRadius: 4,
            border: `1.5px solid ${selected ? t.violet : t.tm}`,
            backgroundColor: selected ? t.violet : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease', flexShrink: 0,
          }}>
            {selected && <Check size={10} color="#fff" strokeWidth={3} />}
          </div>
        )}
        <span style={{ fontSize: '13px', fontWeight: '500', color: selected ? t.tp : t.ts }}>
          {label}
        </span>
        {!multi && selected && <Check size={12} color={t.violet} style={{ marginLeft: 'auto' }} />}
      </div>
      {subtitle && (
        <span style={{ fontSize: '11px', color: t.tm, marginLeft: multi ? '24px' : 0 }}>
          {subtitle}
        </span>
      )}
    </button>
  );
}

// ── Highlighted narrative line ──────────────────────────────────────────────
function NarrativeLine({ text, highlights }) {
  if (!highlights || highlights.length === 0) {
    return <span>{text}</span>;
  }
  // Find and highlight values within text
  let parts = [{ text, highlight: false }];
  for (const hl of highlights) {
    if (!hl) continue;
    const newParts = [];
    for (const part of parts) {
      if (part.highlight) { newParts.push(part); continue; }
      const idx = part.text.indexOf(hl);
      if (idx === -1) { newParts.push(part); continue; }
      if (idx > 0) newParts.push({ text: part.text.slice(0, idx), highlight: false });
      newParts.push({ text: hl, highlight: true });
      if (idx + hl.length < part.text.length) newParts.push({ text: part.text.slice(idx + hl.length), highlight: false });
    }
    parts = newParts;
  }
  return (
    <span>
      {parts.map((p, i) =>
        p.highlight
          ? <span key={i} style={{ color: t.violet, fontWeight: 600 }}>{p.text}</span>
          : <span key={i}>{p.text}</span>
      )}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Personaboarding() {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // API data
  const [options, setOptions] = useState(null);
  const [allRoles, setAllRoles] = useState([]);

  // User selections
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState(null);       // { id, label }
  const [skills, setSkills] = useState([]);      // [{ name, ... }]
  const [selectedSkills, setSelectedSkills] = useState([]); // [string names]
  const [commStyle, setCommStyle] = useState(null);
  const [methodology, setMethodology] = useState(null);
  const [model, setModel] = useState(null);
  const [autonomy, setAutonomy] = useState(null);

  // Narrative history: [{ text, highlights }]
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
        console.error('Failed to load options:', err);
      }
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, typing, step]);

  // Focus input on step 0
  useEffect(() => {
    if (step === 0 && !typing) inputRef.current?.focus();
  }, [step, typing]);

  // ── Step handlers ─────────────────────────────────────────────────────────
  function advance(narrativeText, highlights) {
    setHistory(prev => [...prev, { text: narrativeText, highlights }]);
    setTyping(true);
    setStep(prev => prev + 1);
  }

  function handleNameSubmit() {
    const name = displayName.trim();
    if (!name) return;
    setDisplayName(name);
    advance(`Je vais créer un agent qui s'appellera ${name}.`, [name]);
  }

  function handleRoleSelect(r) {
    setRole(r);
    // Load skills for this role
    const roleData = allRoles.find(ar => ar.id === r.id);
    setSkills(roleData?.skills || []);
    setSelectedSkills([]);
    advance(`${displayName} sera ${r.label}.`, [r.label]);
  }

  function handleSkillsValidate() {
    if (selectedSkills.length === 0) return;
    const list = selectedSkills.join(', ');
    advance(`${displayName} maîtrisera ${list}.`, selectedSkills);
  }

  function handleCommStyleSelect(cs) {
    setCommStyle(cs);
    advance(`${displayName} communiquera de manière ${cs.label.toLowerCase()}.`, [cs.label.toLowerCase()]);
  }

  function handleMethodologySelect(m) {
    setMethodology(m);
    advance(`${displayName} travaillera selon la méthodologie ${m.label}.`, [m.label]);
  }

  function handleModelSelect(m) {
    setModel(m);
    advance(`Son moteur d'intelligence sera ${m.label}.`, [m.label]);
  }

  function handleAutonomySelect(a) {
    setAutonomy(a);
    advance(`Son niveau d'autonomie sera ${a.label.toLowerCase()}.`, [a.label.toLowerCase()]);
  }

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
          model: model.id,
          autonomy: autonomy.id,
        }),
      });
      setSuccess(true);
      setTimeout(() => navigate(`/agents/${res.agent.name}`), 1500);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création');
      setSubmitting(false);
    }
  }

  // ── Step prompts ──────────────────────────────────────────────────────────
  const prompts = [
    "Je vais créer un agent qui s'appellera...",
    `${displayName} sera...`,
    `${displayName} maîtrisera...`,
    `${displayName} communiquera de manière...`,
    `${displayName} travaillera selon la méthodologie...`,
    "Son moteur d'intelligence sera...",
    "Son niveau d'autonomie sera...",
    `La genèse de ${displayName} est terminée.`,
  ];

  // ── Step inputs ───────────────────────────────────────────────────────────
  function renderInput() {
    if (typing) return null;

    const chipContainerStyle = {
      display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px',
      animation: 'fadeIn 0.3s ease',
    };

    switch (step) {
      // Step 0: Agent name
      case 0:
        return (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
            <input
              ref={inputRef}
              autoFocus
              style={{
                backgroundColor: t.bg, border: `1px solid ${t.borderS}`,
                borderRadius: '6px', padding: '10px 14px', color: '#fff',
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
                border: 'none', borderRadius: '6px', padding: '0 20px',
                fontSize: '12px', fontWeight: 600, cursor: displayName.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              Continuer <ArrowRight size={14} />
            </button>
          </div>
        );

      // Step 1: Role
      case 1:
        if (!options) return <span style={{ color: t.tm, fontSize: '12px' }}>Chargement...</span>;
        return (
          <div style={chipContainerStyle}>
            {options.roles.map(r => (
              <Chip key={r.id} label={r.label} subtitle={`${r.skillCount} compétences`}
                selected={role?.id === r.id} onClick={() => handleRoleSelect(r)} />
            ))}
          </div>
        );

      // Step 2: Skills (multi-select)
      case 2:
        if (skills.length === 0) return <span style={{ color: t.tm, fontSize: '12px' }}>Chargement des compétences...</span>;
        return (
          <div style={{ marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
            {selectedSkills.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px',
                marginBottom: '12px', padding: '10px 12px',
                backgroundColor: t.violetG, borderRadius: '8px',
                border: `1px solid ${t.violetM}`,
              }}>
                <span style={{ fontSize: '11px', color: t.violet, fontWeight: 600, marginRight: '4px', lineHeight: '22px' }}>
                  {selectedSkills.length} sélectionnée{selectedSkills.length > 1 ? 's' : ''} :
                </span>
                {selectedSkills.map(s => (
                  <span key={s} style={{
                    fontSize: '11px', color: t.tp, backgroundColor: t.violetM,
                    padding: '2px 8px', borderRadius: '100px', fontWeight: 500,
                  }}>{s}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {skills.map(skill => (
                <Chip
                  key={skill.name} label={skill.name} subtitle={skill.description}
                  multi selected={selectedSkills.includes(skill.name)}
                  onClick={() => {
                    setSelectedSkills(prev =>
                      prev.includes(skill.name) ? prev.filter(s => s !== skill.name) : [...prev, skill.name]
                    );
                  }}
                />
              ))}
            </div>
            <button
              disabled={selectedSkills.length === 0}
              onClick={handleSkillsValidate}
              style={{
                backgroundColor: selectedSkills.length > 0 ? t.tp : t.surfaceEl,
                color: selectedSkills.length > 0 ? t.bg : t.tm,
                border: 'none', borderRadius: '6px', padding: '10px 24px',
                fontSize: '12px', fontWeight: 600,
                cursor: selectedSkills.length > 0 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              Valider la maîtrise <ArrowRight size={14} />
            </button>
          </div>
        );

      // Step 3: Communication style
      case 3:
        return (
          <div style={chipContainerStyle}>
            {options?.commStyles?.map(cs => (
              <Chip key={cs.id} label={cs.label} subtitle={cs.description}
                selected={commStyle?.id === cs.id} onClick={() => handleCommStyleSelect(cs)} />
            ))}
          </div>
        );

      // Step 4: Methodology
      case 4:
        return (
          <div style={chipContainerStyle}>
            {options?.methodologies?.map(m => (
              <Chip key={m.id} label={m.label} subtitle={m.description}
                selected={methodology?.id === m.id} onClick={() => handleMethodologySelect(m)} />
            ))}
          </div>
        );

      // Step 5: Model
      case 5:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
            {options?.models?.map(m => (
              <Chip key={m.id} label={m.label} subtitle={m.description}
                selected={model?.id === m.id} onClick={() => handleModelSelect(m)} />
            ))}
          </div>
        );

      // Step 6: Autonomy
      case 6:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
            {options?.autonomyLevels?.map(a => (
              <Chip key={a.id} label={a.label} subtitle={a.description}
                selected={autonomy?.id === a.id} onClick={() => handleAutonomySelect(a)} />
            ))}
          </div>
        );

      // Step 7: Create button
      case 7:
        return (
          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', animation: 'fadeIn 0.5s ease' }}>
            {success ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                animation: 'fadeIn 0.5s ease',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  backgroundColor: t.violetG, border: `2px solid ${t.violet}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={28} color={t.violet} />
                </div>
                <span style={{ fontSize: '14px', color: t.violet, fontWeight: 600 }}>
                  {displayName} est prêt
                </span>
                <span style={{ fontSize: '12px', color: t.tm }}>Redirection...</span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  style={{
                    backgroundColor: t.violet, color: '#fff',
                    border: 'none', borderRadius: '10px',
                    padding: '14px 36px', fontSize: '15px', fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    transition: 'all 0.2s', fontFamily: t.font,
                    boxShadow: `0 0 30px ${t.violetG}`,
                  }}
                  onMouseOver={e => { if (!submitting) e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {submitting ? (
                    <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Création en cours...</>
                  ) : (
                    <><Sparkles size={18} /> Créer {displayName}</>
                  )}
                </button>
                {error && (
                  <span style={{ fontSize: '12px', color: t.danger }}>{error}</span>
                )}
              </>
            )}
          </div>
        );

      default: return null;
    }
  }

  // ── Progress dots ─────────────────────────────────────────────────────────
  const totalSteps = 8;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)', backgroundColor: t.bg, color: t.tp,
      fontFamily: t.font, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '60px 24px 120px',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.3); } 50% { box-shadow: 0 0 0 12px rgba(139,92,246,0); } }
      `}</style>

      <div style={{ maxWidth: '680px', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: '48px', textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
          <div style={{
            display: 'inline-flex', padding: '4px 14px', borderRadius: '100px',
            backgroundColor: t.violetM, border: `1px solid rgba(139,92,246,0.3)`,
            color: t.violet, fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px',
          }}>
            Persona Onboarding
          </div>
          <h1 style={{
            fontSize: '28px', fontWeight: 700, color: t.tp, margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Créer votre agent personnel
          </h1>
          <p style={{ fontSize: '13px', color: t.tm, marginTop: '8px' }}>
            Chaque choix construit l'histoire de votre agent
          </p>
        </div>

        {/* Progress */}
        <div style={{
          display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '40px',
        }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              width: i <= step ? '24px' : '8px', height: '4px',
              borderRadius: '100px',
              backgroundColor: i < step ? t.violet : i === step ? t.violet : t.surfaceEl,
              opacity: i < step ? 0.5 : i === step ? 1 : 0.3,
              transition: 'all 0.4s ease',
            }} />
          ))}
        </div>

        {/* Narrative */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.map((entry, idx) => (
            <p key={idx} style={{
              margin: 0, fontSize: '17px', lineHeight: '1.7',
              color: t.ts, opacity: 0.7,
              animation: 'fadeIn 0.3s ease',
            }}>
              <NarrativeLine text={entry.text} highlights={entry.highlights} />
            </p>
          ))}

          {/* Current typing line */}
          <p style={{ margin: 0, fontSize: '17px', lineHeight: '1.7', color: t.tp, fontWeight: 500 }}>
            <TypewriterText
              key={`step-${step}`}
              text={prompts[step] || ''}
              onComplete={() => setTyping(false)}
            />
          </p>
        </div>

        {/* Current input */}
        <div style={{ minHeight: '200px', marginTop: '20px' }}>
          {renderInput()}
        </div>

        <div ref={scrollRef} style={{ height: '40px' }} />
      </div>
    </div>
  );
}
