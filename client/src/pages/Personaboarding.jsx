import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Shield, Zap, MessageSquare, GitBranch, Wrench,
  Cpu, Settings, Sparkles, Check, Loader2, PenTool, ArrowRight,
  Linkedin, X, ExternalLink, Link as LinkIcon, Upload, Camera,
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
@keyframes phaseReveal {
  0% { opacity:0; transform:translateY(20px) scale(0.97); filter:blur(6px); }
  100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
}
@keyframes phasePulse {
  0%,100% { box-shadow:0 0 0 0 rgba(139,92,246,0.3); }
  50% { box-shadow:0 0 0 8px rgba(139,92,246,0); }
}
@keyframes phaseLineGrow {
  from { transform:scaleY(0); }
  to { transform:scaleY(1); }
}
@keyframes bookGlow {
  0%,100% { box-shadow:0 0 40px rgba(139,92,246,0.03), 0 0 80px rgba(139,92,246,0.02); }
  50% { box-shadow:0 0 60px rgba(139,92,246,0.06), 0 0 120px rgba(139,92,246,0.03); }
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
  const [customSkills, setCustomSkills] = useState([]);
  const [createdSkills, setCreatedSkills] = useState([]);
  const [createdAgent, setCreatedAgent] = useState(null);
  const [constellationReady, setConstellationReady] = useState(false);

  const [customRoleInput, setCustomRoleInput] = useState('');

  // LinkedIn / Source mode
  const [sourceMode, setSourceMode] = useState(null); // null | 'linkedin' | 'manual' | 'linkedin-done' | 'oauth-headline'
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinSuggestions, setLinkedinSuggestions] = useState(null);
  const [linkedinPhase, setLinkedinPhase] = useState('input');
  const [aiSkillsLoading, setAiSkillsLoading] = useState(false);
  const [profilePicUploading, setProfilePicUploading] = useState(false);
  const profilePicInputRef = useRef(null);
  const [oauthProfile, setOauthProfile] = useState(null); // stores raw OAuth data
  const [oauthHeadline, setOauthHeadline] = useState('');

  // Narrative history
  const [history, setHistory] = useState([]);

  // Fetch options on mount + handle LinkedIn OAuth callback
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

      // Check for LinkedIn OAuth callback data in URL
      const params = new URLSearchParams(window.location.search);
      const linkedinDataParam = params.get('linkedin_data');
      const linkedinError = params.get('linkedin_error');
      if (linkedinError) {
        setError(`LinkedIn OAuth error: ${linkedinError}`);
        window.history.replaceState({}, '', '/personaboarding');
      } else if (linkedinDataParam) {
        try {
          const profile = JSON.parse(decodeURIComponent(linkedinDataParam));
          window.history.replaceState({}, '', '/personaboarding');
          // Store OAuth profile and show headline input step
          setOauthProfile(profile);
          setSourceMode('oauth-headline');
          if (profile.given_name) setDisplayName(profile.given_name);
        } catch (err) {
          console.error('LinkedIn OAuth data processing failed:', err);
          setError("Erreur lors du traitement des données LinkedIn");
          window.history.replaceState({}, '', '/personaboarding');
        }
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

  // ── LinkedIn OAuth: analyze with headline ─────────────────────────────
  async function handleOAuthAnalyze() {
    if (!oauthProfile) return;
    setLinkedinLoading(true);
    setSourceMode('linkedin');
    setLinkedinPhase('analyzing');
    setError(null);
    try {
      const res = await api('/api/personaboarding/linkedin/analyze-oauth', {
        method: 'POST',
        body: JSON.stringify({ ...oauthProfile, headline: oauthHeadline.trim() || undefined }),
      });
      setLinkedinSuggestions(res.suggestions);
      if (res.suggestions?.displayName) setDisplayName(res.suggestions.displayName);
      setLinkedinPhase('results');
    } catch (err) {
      setError(err.message || "Erreur lors de l'analyse");
      setSourceMode('oauth-headline');
    }
    setLinkedinLoading(false);
  }

  // ── LinkedIn OAuth handler ────────────────────────────────────────────
  async function handleLinkedinOAuth() {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await api(`/api/personaboarding/linkedin/auth?token=${encodeURIComponent(token)}`);
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        setError('LinkedIn OAuth non configuré');
      }
    } catch (err) {
      setError(err.message || 'Erreur LinkedIn OAuth');
    }
  }

  // ── LinkedIn & AI handlers ─────────────────────────────────────────────
  async function handleLinkedinAnalyze() {
    if (!linkedinUrl.trim()) return;
    setLinkedinLoading(true);
    setLinkedinPhase('analyzing');
    setError(null);
    try {
      const res = await api('/api/personaboarding/linkedin-analyze', {
        method: 'POST',
        body: JSON.stringify({ url: linkedinUrl.trim() }),
      });
      setLinkedinSuggestions(res.suggestions);
      if (res.suggestions?.displayName) setDisplayName(res.suggestions.displayName);
      setLinkedinPhase('results');
    } catch (err) {
      setError(err.message || "Impossible d'analyser ce profil LinkedIn");
      setLinkedinPhase('input');
    }
    setLinkedinLoading(false);
  }

  function handleLinkedinContinue() {
    setLinkedinPhase('done');
    setSourceMode('linkedin-done');
    // Pre-fill multi-select from suggestions
    if (linkedinSuggestions?.tools) setSelectedTools(linkedinSuggestions.tools);
  }

  function handleManualMode() {
    setSourceMode('manual');
  }

  async function handleProfilePicUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePicUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/personaboarding/upload-profile-pic', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data = await res.json();
      if (data.profileImageUrl) {
        setLinkedinSuggestions(prev => ({ ...prev, profileImageUrl: data.profileImageUrl }));
      }
    } catch (err) {
      console.error('Profile pic upload failed:', err);
    }
    setProfilePicUploading(false);
  }

  async function fetchAiSkills(roleId) {
    // If LinkedIn already found skills, use them directly (don't regenerate)
    if (linkedinSuggestions?.skills?.length > 0) {
      const liSkills = linkedinSuggestions.skills;
      setSkills(liSkills);
      setSelectedSkills(liSkills.map(s => s.name));
      return;
    }

    // No LinkedIn skills — generate via AI
    setAiSkillsLoading(true);
    try {
      const res = await api('/api/personaboarding/ai-suggest-skills', {
        method: 'POST',
        body: JSON.stringify({
          role: roleId,
          linkedinData: null,
        }),
      });
      setSkills(res.skills || []);
    } catch {
      const roleData = allRoles.find(ar => ar.id === roleId);
      setSkills(roleData?.skills || []);
    }
    setAiSkillsLoading(false);
  }

  // ── Narrative prompts ────────────────────────────────────────────────────
  const hasLinkedin = !!linkedinSuggestions;
  const prompts = [
    hasLinkedin
      ? `LinkedIn m'a parlé de vous. Confirmez le nom de votre agent ?`
      : "Commençons la genèse. Quel sera le nom de votre agent ?",
    hasLinkedin
      ? `${displayName} est un beau nom. Votre profil suggère un rôle. Lequel vous correspond ?`
      : `Je m'appellerai ${displayName}. Quel rôle souhaitez-vous me confier ?`,
    hasLinkedin
      ? `En tant que ${role?.label || '...'}, voici les compétences suggérées par votre profil. Validez ou personnalisez.`
      : `En tant que ${role?.label || '...'}, j'aurai besoin de compétences spécifiques. Quelles sont les miennes ?`,
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
    setSelectedSkills([]);
    advance(`${displayName} sera ${r.label}.`);
    fetchAiSkills(r.id);
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
          skillsData: skills,
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
          customSkills,
          skillsData: skills,
          commStyle: commStyle.id,
          methodology: methodology.id,
          selectedTools,
          model: model.id,
          autonomy: autonomy.id,
          gptData: gptData || null,
          profileImageUrl: linkedinSuggestions?.profileImageUrl || null,
        }),
      });
      setCreatedAgent(res.agent);
      // Build skill objects with colors from role skills + custom skills
      const roleSkills = allRoles.find(r => r.id === role.id)?.skills || [];
      const skillsWithMeta = selectedSkills.map(name => {
        const meta = roleSkills.find(s => s.name === name);
        const custom = customSkills.find(s => s.name === name);
        return { name, color: meta?.color || custom?.color || t.violet, category: meta?.category || custom?.category || '' };
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

  // ── Source Picker ───────────────────────────────────────────────────────
  function renderSourcePicker() {
    return (
      <div style={{ animation: 'fadeInUp 0.5s ease' }}>
        <div style={{
          fontSize: '20px', fontWeight: 700, color: t.tp, marginBottom: '8px',
          letterSpacing: '-0.02em',
        }}>
          Comment souhaitez-vous créer votre agent ?
        </div>
        <p style={{ fontSize: '13px', color: t.tm, marginBottom: '28px', lineHeight: '1.6' }}>
          Importez votre profil LinkedIn pour des suggestions intelligentes, ou créez manuellement.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* LinkedIn OAuth Card */}
          <button
            onClick={handleLinkedinOAuth}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0A66C215'; e.currentTarget.style.borderColor = '#0A66C240'; e.currentTarget.style.boxShadow = '0 0 20px rgba(10,102,194,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.surface; e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '20px 24px', backgroundColor: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.25s ease', boxShadow: 'none',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '12px',
              backgroundColor: '#0A66C215', border: '1px solid #0A66C230',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Linkedin size={22} color="#0A66C2" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: t.tp, marginBottom: '4px' }}>
                Connecter LinkedIn
              </div>
              <div style={{ fontSize: '12px', color: t.ts, lineHeight: '1.5' }}>
                Connectez-vous via LinkedIn pour importer automatiquement votre nom, photo de profil et email.
              </div>
            </div>
            <ArrowRight size={18} color={t.tm} style={{ flexShrink: 0 }} />
          </button>

          {/* LinkedIn URL Paste Card */}
          <button
            onClick={() => { setSourceMode('linkedin'); setLinkedinPhase('input'); }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1e3a5f20'; e.currentTarget.style.borderColor = '#3B82F640'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.surface; e.currentTarget.style.borderColor = t.border; }}
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '20px 24px', backgroundColor: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.25s ease',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '12px',
              backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <LinkIcon size={20} color="#3B82F6" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: t.tp, marginBottom: '4px' }}>
                Coller une URL LinkedIn
              </div>
              <div style={{ fontSize: '12px', color: t.ts, lineHeight: '1.5' }}>
                Collez une URL LinkedIn publique — l'IA analysera les métadonnées du profil.
              </div>
            </div>
            <ArrowRight size={18} color={t.tm} style={{ flexShrink: 0 }} />
          </button>

          {/* Manual Card */}
          <button
            onClick={handleManualMode}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.surfaceEl; e.currentTarget.style.borderColor = t.borderS; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.surface; e.currentTarget.style.borderColor = t.border; }}
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '20px 24px', backgroundColor: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.25s ease',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '12px',
              backgroundColor: t.violetG, border: `1px solid ${t.violetM}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <PenTool size={20} color={t.violet} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: t.tp, marginBottom: '4px' }}>
                Création manuelle
              </div>
              <div style={{ fontSize: '12px', color: t.ts, lineHeight: '1.5' }}>
                Configurez chaque aspect de votre agent étape par étape, en toute liberté.
              </div>
            </div>
            <ArrowRight size={18} color={t.tm} style={{ flexShrink: 0 }} />
          </button>
        </div>
      </div>
    );
  }

  // ── OAuth Headline Step ───────────────────────────────────────────────
  function renderOAuthHeadlineStep() {
    return (
      <div style={{ animation: 'fadeInUp 0.5s ease' }}>
        {/* Profile card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '20px', backgroundColor: t.surface, border: `1px solid ${t.border}`,
          borderRadius: '12px', marginBottom: '24px',
        }}>
          {oauthProfile?.picture ? (
            <img
              src={oauthProfile.picture}
              alt={oauthProfile.name}
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${t.violet}` }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%', backgroundColor: t.violetG,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${t.violet}`,
            }}>
              <User size={24} color={t.violet} />
            </div>
          )}
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: t.tp }}>{oauthProfile?.name}</div>
            <div style={{ fontSize: '13px', color: t.ts }}>{oauthProfile?.email || 'LinkedIn Connected'}</div>
          </div>
          <div style={{
            marginLeft: 'auto', padding: '4px 12px', borderRadius: '100px',
            backgroundColor: '#22c55e18', border: '1px solid #22c55e30',
            fontSize: '11px', fontWeight: 600, color: '#22c55e',
          }}>
            <Check size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Connecté
          </div>
        </div>

        {/* Headline input */}
        <div style={{ fontSize: '16px', fontWeight: 600, color: t.tp, marginBottom: '6px' }}>
          Quel est votre poste actuel ?
        </div>
        <p style={{ fontSize: '13px', color: t.tm, marginBottom: '16px', lineHeight: '1.5' }}>
          Sélectionnez ou écrivez votre rôle pour que l'IA génère des compétences précises.
        </p>

        {/* Quick-select role chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {[
            'Product Manager', 'Développeur Full-Stack', 'Data & AI Consultant',
            'UX/UI Designer', 'DevOps Engineer', 'Growth Marketer',
            'CTO / Tech Lead', 'Business Analyst', 'Freelance Developer',
          ].map(label => (
            <button
              key={label}
              onClick={() => setOauthHeadline(label)}
              style={{
                padding: '7px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 500,
                backgroundColor: oauthHeadline === label ? `${t.violet}22` : t.surface,
                border: `1px solid ${oauthHeadline === label ? t.violet : t.border}`,
                color: oauthHeadline === label ? t.tp : t.ts,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          autoFocus
          style={{
            backgroundColor: t.bg, border: `1px solid ${t.borderS}`,
            borderRadius: '8px', padding: '14px 16px', color: '#fff',
            fontSize: '15px', width: '100%', outline: 'none', fontFamily: t.font,
            transition: 'border-color 0.2s', boxSizing: 'border-box',
            marginBottom: '12px',
          }}
          onFocus={e => e.target.style.borderColor = t.violet}
          onBlur={e => e.target.style.borderColor = t.borderS}
          placeholder="Ou tapez votre poste exact..."
          value={oauthHeadline}
          onChange={e => setOauthHeadline(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && oauthHeadline.trim() && handleOAuthAnalyze()}
        />
        <button
          onClick={handleOAuthAnalyze}
          disabled={linkedinLoading || !oauthHeadline.trim()}
          style={{
            width: '100%', padding: '13px 20px',
            backgroundColor: oauthHeadline.trim() ? t.violet : t.surfaceEl,
            color: '#fff', border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600,
            cursor: oauthHeadline.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s', opacity: oauthHeadline.trim() ? 1 : 0.5,
          }}
        >
          {linkedinLoading ? (
            <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analyse en cours...</>
          ) : (
            <><Sparkles size={16} /> Analyser mon profil</>
          )}
        </button>
      </div>
    );
  }

  // ── LinkedIn Flow ─────────────────────────────────────────────────────
  function renderLinkedInFlow() {
    return (
      <div style={{ animation: 'fadeInUp 0.4s ease' }}>
        {linkedinPhase === 'input' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px',
              color: '#60A5FA', fontSize: '12px', fontWeight: 600,
            }}>
              <Linkedin size={15} /> Import LinkedIn
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: t.tp, marginBottom: '6px' }}>
              Collez votre URL LinkedIn
            </div>
            <p style={{ fontSize: '13px', color: t.tm, marginBottom: '20px', lineHeight: '1.5' }}>
              L'IA analysera les métadonnées de votre profil pour suggérer automatiquement les champs.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                autoFocus
                style={{
                  backgroundColor: t.bg, border: `1px solid ${t.borderS}`,
                  borderRadius: '8px', padding: '12px 16px', color: '#fff',
                  fontSize: '14px', flex: 1, outline: 'none', fontFamily: t.font,
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#3B82F6'}
                onBlur={e => e.target.style.borderColor = t.borderS}
                placeholder="https://linkedin.com/in/votre-profil"
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLinkedinAnalyze()}
              />
              <button
                disabled={!linkedinUrl.trim() || !linkedinUrl.includes('linkedin.com/in/')}
                onClick={handleLinkedinAnalyze}
                style={{
                  backgroundColor: linkedinUrl.includes('linkedin.com/in/') ? '#3B82F6' : t.surfaceEl,
                  color: '#fff', border: 'none', borderRadius: '8px', padding: '0 20px',
                  fontSize: '13px', fontWeight: 600, cursor: linkedinUrl.includes('linkedin.com/in/') ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.2s', fontFamily: t.font,
                }}
              >
                Analyser <ExternalLink size={13} />
              </button>
            </div>
            {error && <p style={{ fontSize: '12px', color: t.danger, marginTop: '10px' }}>{error}</p>}
            <button
              onClick={handleManualMode}
              style={{
                background: 'none', border: 'none', color: t.tm, fontSize: '12px',
                cursor: 'pointer', marginTop: '16px', padding: 0, fontFamily: t.font,
                textDecoration: 'underline', textUnderlineOffset: '3px',
              }}
            >
              Passer et créer manuellement
            </button>
          </div>
        )}

        {linkedinPhase === 'analyzing' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
            padding: '40px 20px', animation: 'fadeInUp 0.4s ease',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: '#1e3a5f20', border: '2px solid #3B82F640',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Linkedin size={28} color="#3B82F6" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: t.tp, marginBottom: '6px' }}>
                Analyse de votre profil LinkedIn...
              </div>
              <div style={{ fontSize: '12px', color: t.tm }}>
                Extraction des métadonnées et génération des suggestions
              </div>
            </div>
            <Loader2 size={20} color="#3B82F6" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {linkedinPhase === 'results' && linkedinSuggestions && (
          <div style={{ animation: 'fadeInUp 0.4s ease' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px',
              color: t.success, fontSize: '13px', fontWeight: 600,
            }}>
              <Check size={15} /> Profil analysé avec succès
            </div>

            {linkedinSuggestions.summary && (
              <div style={{
                padding: '14px 18px', backgroundColor: t.surface, borderRadius: '10px',
                border: `1px solid ${t.border}`, marginBottom: '20px',
                fontSize: '13px', color: t.ts, lineHeight: '1.6', fontStyle: 'italic',
              }}>
                "{linkedinSuggestions.summary}"
              </div>
            )}

            {/* Profile Image + Suggestion Preview Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {/* Profile pic: show image or upload button */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '14px 18px', backgroundColor: t.surface, borderRadius: '10px',
                border: `1px solid ${linkedinSuggestions.profileImageUrl ? '#3B82F630' : t.border}`, marginBottom: '4px',
              }}>
                {linkedinSuggestions.profileImageUrl ? (
                  <>
                    <img
                      src={linkedinSuggestions.profileImageUrl}
                      alt="Profile"
                      style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        objectFit: 'cover', border: `2px solid #3B82F640`,
                        boxShadow: '0 4px 12px rgba(59,130,246,0.15)',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: t.tp }}>
                        {linkedinSuggestions.displayName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#60A5FA', marginTop: '2px' }}>
                        Photo de profil importée
                      </div>
                    </div>
                    <button
                      onClick={() => profilePicInputRef.current?.click()}
                      style={{
                        background: 'none', border: `1px solid ${t.border}`, borderRadius: '6px',
                        padding: '4px 10px', color: t.ts, fontSize: '11px', cursor: 'pointer',
                        fontFamily: t.font, transition: 'all 0.2s',
                      }}
                    >
                      Changer
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => profilePicInputRef.current?.click()}
                      disabled={profilePicUploading}
                      style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        backgroundColor: '#3B82F610', border: `2px dashed #3B82F640`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
                      }}
                    >
                      {profilePicUploading
                        ? <Loader2 size={20} color="#3B82F6" style={{ animation: 'spin 1s linear infinite' }} />
                        : <Camera size={20} color="#3B82F6" />
                      }
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: t.tp }}>
                        Ajouter la photo de profil
                      </div>
                      <div style={{ fontSize: '11px', color: t.tm, marginTop: '2px', lineHeight: '1.4' }}>
                        Clic droit sur votre photo LinkedIn → Enregistrer, puis uploadez-la ici
                      </div>
                    </div>
                    <button
                      onClick={() => profilePicInputRef.current?.click()}
                      disabled={profilePicUploading}
                      style={{
                        backgroundColor: '#3B82F6', color: '#fff', border: 'none',
                        borderRadius: '8px', padding: '8px 14px', fontSize: '12px',
                        fontWeight: 600, cursor: 'pointer', fontFamily: t.font,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        transition: 'all 0.2s', flexShrink: 0,
                      }}
                    >
                      <Upload size={13} /> Upload
                    </button>
                  </>
                )}
                <input
                  ref={profilePicInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleProfilePicUpload}
                />
              </div>
              {[
                { label: 'Nom', value: linkedinSuggestions.displayName, icon: <User size={13} /> },
                { label: 'Rôle', value: linkedinSuggestions.role?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), icon: <Shield size={13} /> },
                { label: 'Compétences', value: `${linkedinSuggestions.skills?.length || 0} détectées`, icon: <Zap size={13} /> },
                { label: 'Style', value: linkedinSuggestions.commStyle?.charAt(0).toUpperCase() + linkedinSuggestions.commStyle?.slice(1), icon: <MessageSquare size={13} /> },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', backgroundColor: t.surface, borderRadius: '8px',
                  border: `1px solid ${t.border}`,
                }}>
                  <div style={{ color: '#3B82F6' }}>{item.icon}</div>
                  <span style={{ fontSize: '11px', color: t.tm, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '90px' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '13px', color: t.tp, fontWeight: 500 }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '11px', color: t.tm, marginBottom: '16px', lineHeight: '1.5' }}>
              Ces suggestions pré-rempliront les étapes suivantes. Vous pourrez modifier ou rejeter chaque suggestion.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleLinkedinContinue}
                style={{
                  backgroundColor: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '12px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', fontFamily: t.font,
                  transition: 'all 0.2s',
                }}
              >
                Continuer avec ces suggestions <ArrowRight size={14} />
              </button>
              <button
                onClick={handleManualMode}
                style={{
                  backgroundColor: t.surface, color: t.ts, border: `1px solid ${t.border}`,
                  borderRadius: '8px', padding: '12px 18px', fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer', fontFamily: t.font, transition: 'all 0.2s',
                }}
              >
                Ignorer
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Suggestion Badge ──────────────────────────────────────────────────
  function SuggestionBadge({ label }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
        padding: '8px 14px', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: '8px',
        border: '1px solid rgba(59,130,246,0.12)', fontSize: '12px', color: '#60A5FA',
      }}>
        <Linkedin size={13} /> Suggestion : <strong style={{ color: '#93C5FD' }}>{label}</strong>
      </div>
    );
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

      case 1: {
        if (!options) return <LoadingText />;
        // Build role list: predefined + LinkedIn suggestion if not already in list
        const roleOptions = [...options.roles];
        if (linkedinSuggestions?.role) {
          const liRole = linkedinSuggestions.role;
          if (!roleOptions.some(r => r.id === liRole)) {
            roleOptions.unshift({
              id: liRole,
              label: liRole.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              skillCount: 'IA',
              _linkedin: true,
            });
          }
        }
        const handleCustomRole = () => {
          const name = customRoleInput.trim();
          if (!name) return;
          const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          handleRoleSelect({ id, label: name, skillCount: 'IA' });
          setCustomRoleInput('');
        };
        return (
          <div style={{ marginTop: '20px', ...fadeIn }}>
            {linkedinSuggestions?.role && (
              <SuggestionBadge label={
                roleOptions.find(r => r.id === linkedinSuggestions.role)?.label
                || linkedinSuggestions.role.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
              } />
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {roleOptions.map(r => (
                <Chip key={r.id} label={r.label}
                  subtitle={r._linkedin ? 'Suggestion LinkedIn' : `${r.skillCount} compétences`}
                  selected={role?.id === r.id} onClick={() => handleRoleSelect(r)}
                  color={linkedinSuggestions?.role === r.id ? '#3B82F6' : r._linkedin ? '#3B82F6' : undefined} />
              ))}
            </div>
            {/* Custom role input */}
            <div style={{
              display: 'flex', gap: '8px', marginTop: '16px',
              padding: '12px 14px', backgroundColor: t.surface, borderRadius: '10px',
              border: `1px solid ${t.border}`,
            }}>
              <input
                style={{
                  backgroundColor: 'transparent', border: 'none', color: '#fff',
                  fontSize: '13px', flex: 1, outline: 'none', fontFamily: t.font,
                }}
                placeholder="Data Scientist, Growth Hacker, DevOps Engineer, UX Researcher..."
                value={customRoleInput}
                onChange={e => setCustomRoleInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomRole()}
              />
              <button
                disabled={!customRoleInput.trim()}
                onClick={handleCustomRole}
                style={{
                  backgroundColor: customRoleInput.trim() ? t.violet : 'transparent',
                  color: customRoleInput.trim() ? '#fff' : t.tm,
                  border: 'none', borderRadius: '6px', padding: '6px 14px',
                  fontSize: '12px', fontWeight: 600, cursor: customRoleInput.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s', fontFamily: t.font,
                }}
              >
                Valider
              </button>
            </div>
          </div>
        );
      }

      case 2:
        if (aiSkillsLoading) return (
          <div style={{ marginTop: '20px', ...fadeIn }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px', padding: '20px',
              backgroundColor: t.surface, borderRadius: '10px', border: `1px solid ${t.violetM}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                backgroundColor: t.violetG, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={16} color={t.violet} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: t.tp, fontWeight: 500 }}>L'IA génère vos compétences...</div>
                <div style={{ fontSize: '11px', color: t.tm, marginTop: '2px' }}>Analyse du profil et du rôle en cours</div>
              </div>
              <Loader2 size={16} color={t.violet} style={{ animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />
            </div>
          </div>
        );
        if (skills.length === 0) return <LoadingText text="Chargement des compétences..." />;
        return (
          <div style={{ marginTop: '20px', ...fadeIn }}>
            <div style={{
              fontSize: '12px', color: t.ts, marginBottom: '16px', lineHeight: '1.6',
              padding: '12px 16px', backgroundColor: t.surface, borderRadius: '8px',
              border: `1px solid ${t.border}`,
            }}>
              Cliquez sur les nodes dans la constellation pour connecter des compétences à {displayName}.
              Vous pouvez aussi créer vos propres skills.
            </div>
            {/* Inline Interactive Constellation */}
            <div style={{
              width: '100%',
              margin: '12px 0',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Subtle radial glow */}
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(circle at center, ${t.violetG} 0%, transparent 70%)`,
                pointerEvents: 'none',
                opacity: 0.8,
              }} />

              <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                <InteractiveConstellation
                  agentName={displayName}
                  roleLabel={role?.label || ''}
                  skills={skills}
                  selectedSkills={selectedSkills}
                  customSkills={customSkills}
                  onToggleSkill={(name) => {
                    setSelectedSkills(prev =>
                      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
                    );
                  }}
                  onAddCustomSkill={(skill) => {
                    setCustomSkills(prev => [...prev, skill]);
                    setSelectedSkills(prev => [...prev, skill.name]);
                  }}
                  onRemoveCustomSkill={(name) => {
                    setCustomSkills(prev => prev.filter(s => s.name !== name));
                    setSelectedSkills(prev => prev.filter(s => s !== name));
                  }}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        if (!options) return <LoadingText />;
        return (
          <div style={{ marginTop: '20px', ...fadeIn }}>
            {linkedinSuggestions?.commStyle && (
              <SuggestionBadge label={options.commStyles.find(c => c.id === linkedinSuggestions.commStyle)?.label || linkedinSuggestions.commStyle} />
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {options.commStyles.map(cs => (
                <Chip key={cs.id} label={cs.label} subtitle={cs.description}
                  selected={commStyle?.id === cs.id} onClick={() => handleCommStyleSelect(cs)}
                  color={linkedinSuggestions?.commStyle === cs.id ? '#3B82F6' : undefined} />
              ))}
            </div>
          </div>
        );

      case 4:
        if (!options) return <LoadingText />;
        return (
          <div style={{ marginTop: '20px', ...fadeIn }}>
            {linkedinSuggestions?.methodology && (
              <SuggestionBadge label={options.methodologies.find(m => m.id === linkedinSuggestions.methodology)?.label || linkedinSuggestions.methodology} />
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {options.methodologies.map(m => (
                <Chip key={m.id} label={m.label} subtitle={m.description}
                  selected={methodology?.id === m.id} onClick={() => handleMethodologySelect(m)}
                  color={linkedinSuggestions?.methodology === m.id ? '#3B82F6' : undefined} />
              ))}
            </div>
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
          </div>
        );

      case 6:
        if (!options) return <LoadingText />;
        return (
          <div style={{ marginTop: '20px', ...fadeIn }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {options.models.map(m => (
                <Chip key={m.id} label={m.label} subtitle={m.description}
                  selected={model?.id === m.id} onClick={() => handleModelSelect(m)} />
              ))}
            </div>
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
        if (!enhancing) return null;
        return (
          <div style={{ marginTop: '24px', ...fadeIn }}>
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
                width: '100%',
              }}>
                {linkedinSuggestions?.profileImageUrl ? (
                  <img
                    src={linkedinSuggestions.profileImageUrl}
                    alt={displayName}
                    style={{
                      width: '64px', height: '64px', borderRadius: '50%',
                      objectFit: 'cover', border: `3px solid ${t.success}`,
                      boxShadow: `0 0 20px ${t.success}30`,
                    }}
                  />
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    backgroundColor: `${t.success}22`, border: `2px solid ${t.success}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={28} color={t.success} />
                  </div>
                )}
                <span style={{ fontSize: '15px', color: t.tp, fontWeight: 600 }}>
                  {displayName} est né
                </span>
                <span style={{ fontSize: '12px', color: t.ts, textAlign: 'center', maxWidth: '280px', lineHeight: '1.6' }}>
                  {createdSkills.length} compétences connectées. La constellation se forme...
                </span>
                {/* Inline Final Constellation */}
                {createdSkills.length > 0 && (
                  <div style={{
                    width: '100%', marginTop: '8px',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <SkillConstellation
                      agentName={displayName}
                      roleLabel={role?.label || ''}
                      skills={createdSkills}
                      onComplete={() => setConstellationReady(true)}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );

      default: return null;
    }
  }

  // ── Action footer (always visible at bottom) ────────────────────────────
  function renderActionFooter() {
    if (typing) return null;
    if (sourceMode === null || sourceMode === 'oauth-headline' || (sourceMode === 'linkedin' && linkedinPhase !== 'done')) return null;

    switch (step) {
      case 2:
        if (aiSkillsLoading || skills.length === 0) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedSkills.length > 0 && <SelectedBadges items={selectedSkills} />}
            <ValidateButton disabled={selectedSkills.length === 0} onClick={handleSkillsValidate} label={`Valider ${selectedSkills.length} compétence${selectedSkills.length > 1 ? 's' : ''}`} />
          </div>
        );

      case 5:
        if (!options) return null;
        return (
          <ValidateButton disabled={selectedTools.length === 0} onClick={handleToolsValidate} label="Valider les outils" />
        );

      case 8:
        if (enhancing) return null;
        return (
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
        );

      case 9:
        if (success) {
          if (!constellationReady) return null;
          return (
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
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          </div>
        );

      default:
        return null;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const totalSteps = STEP_META.length;
  const nodeValues = getNodeValues();
  const showPhases = sourceMode !== null && sourceMode !== 'oauth-headline' && !(sourceMode === 'linkedin' && linkedinPhase !== 'done');

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 56px)', backgroundColor: t.bg,
      color: t.tp, fontFamily: t.font, overflow: 'hidden',
    }}>
      <style>{KEYFRAMES}</style>

      {/* ── LEFT: Phase Timeline Sidebar ──────────────────────────────────── */}
      {showPhases && (
        <div style={{
          flex: '0 0 56px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          paddingTop: '16px', paddingBottom: '16px',
          borderRight: `1px solid ${t.border}`,
          background: `linear-gradient(180deg, ${t.surface} 0%, ${t.bg} 100%)`,
          overflowY: 'auto', overflowX: 'hidden',
          scrollbarWidth: 'none',
        }}>
          {STEP_META.map((meta, i) => {
            const isActive = step === i;
            const isComplete = step > i;
            const isFuture = step < i;
            const IconComp = meta.Icon;
            const val = nodeValues[i];
            return (
              <React.Fragment key={meta.id}>
                {/* Connector line */}
                {i > 0 && (
                  <div style={{
                    width: '2px', height: '12px', flexShrink: 0,
                    background: isComplete ? `linear-gradient(180deg, ${t.violet}, ${t.violet}80)` : t.border,
                    borderRadius: '1px',
                    transformOrigin: 'top',
                    animation: isComplete ? 'phaseLineGrow 0.4s ease-out forwards' : 'none',
                  }} />
                )}
                {/* Phase icon node */}
                <div
                  title={`${meta.label}${val ? ` — ${val}` : ''}`}
                  style={{
                    width: isActive ? '34px' : '30px', height: isActive ? '34px' : '30px',
                    borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', cursor: 'default',
                    background: isComplete ? t.violet : isActive ? t.surfaceEl : t.surface,
                    border: `2px solid ${isComplete ? t.violet : isActive ? t.violet : t.border}`,
                    transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                    animation: isActive ? 'phasePulse 2s ease-in-out infinite' : 'none',
                    boxShadow: isActive ? `0 0 16px ${t.violetG}` : isComplete ? `0 0 8px rgba(139,92,246,0.15)` : 'none',
                  }}
                >
                  {isComplete ? (
                    <Check size={14} color="#fff" strokeWidth={3} />
                  ) : (
                    <IconComp size={14} color={isActive ? t.violet : isFuture ? t.tm : t.ts} />
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── CENTER: The Book ──────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Subtle ambient background */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(ellipse 60% 50% at 50% 30%, rgba(139,92,246,0.04) 0%, transparent 70%)`,
        }} />

        {/* Book content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          width: '100%', minHeight: 0,
          padding: '0 64px',
          position: 'relative', zIndex: 1,
          animation: 'bookGlow 6s ease-in-out infinite',
        }}>
          {/* Header - fixed (non-scrollable) */}
          <div style={{
            flexShrink: 0,
            paddingTop: '32px',
            paddingBottom: '24px',
            borderBottom: `1px solid ${t.border}`,
            marginBottom: '32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 14px', borderRadius: '100px',
                backgroundColor: linkedinSuggestions ? 'rgba(59,130,246,0.12)' : t.violetG,
                border: `1px solid ${linkedinSuggestions ? 'rgba(59,130,246,0.2)' : t.border}`,
                color: linkedinSuggestions ? '#60A5FA' : t.violet,
                fontSize: '11px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {linkedinSuggestions ? <><Linkedin size={12} /> LinkedIn Import</> : <><Sparkles size={12} /> Persona Onboarding</>}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: t.tp, margin: 0, letterSpacing: '-0.03em' }}>
                  Créer votre agent personnel
                </h1>
              </div>
              {linkedinSuggestions?.profileImageUrl && sourceMode === 'linkedin-done' && (
                <div style={{ position: 'relative' }}>
                  <img
                    src={linkedinSuggestions.profileImageUrl}
                    alt=""
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      objectFit: 'cover', border: `2px solid ${t.violet}`,
                      boxShadow: `0 0 20px ${t.violetG}`,
                    }}
                  />
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 12, height: 12, borderRadius: '50%',
                    backgroundColor: t.success, border: `2px solid ${t.bg}`,
                  }} />
                </div>
              )}
            </div>

            {/* Progress bar - Full width */}
            {showPhases && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                <div style={{
                  flex: 1, height: '4px', borderRadius: '100px', backgroundColor: t.surfaceEl,
                  overflow: 'hidden', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${((step) / (totalSteps - 1)) * 100}%`,
                    background: `linear-gradient(90deg, ${t.violet}, #A78BFA)`,
                    borderRadius: '100px',
                    boxShadow: `0 0 12px ${t.violetM}`,
                    transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: t.tp, fontWeight: 600 }}>
                    {STEP_META[step]?.label}
                  </span>
                  <span style={{ fontSize: '11px', color: t.tm, fontFamily: t.mono, opacity: 0.8 }}>
                    [{step + 1}/{totalSteps}]
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable narrative area */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '8px' }}>
            {sourceMode === null ? (
              renderSourcePicker()
            ) : sourceMode === 'oauth-headline' ? (
              renderOAuthHeadlineStep()
            ) : sourceMode === 'linkedin' && linkedinPhase !== 'done' ? (
              renderLinkedInFlow()
            ) : (
              <>
                {/* History lines */}
                {history.map((entry, idx) => (
                  <p key={idx} style={{
                    margin: '0 0 10px', fontSize: '15px', lineHeight: '1.7',
                    color: t.ts, opacity: 0.5, fontStyle: 'italic',
                  }}>
                    {entry}
                  </p>
                ))}

                {/* Current phase content with reveal animation */}
                <div key={`phase-${step}`} style={{
                  animation: 'phaseReveal 0.5s ease-out forwards',
                }}>
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
                  <div style={{ marginTop: '8px' }}>
                    {renderInput()}
                  </div>
                </div>
              </>
            )}
            <div ref={scrollRef} style={{ height: '20px' }} />
          </div>

          {/* Action footer — always visible at bottom */}
          {(() => {
            const footer = renderActionFooter();
            if (!footer) return null;
            return (
              <div style={{
                flexShrink: 0,
                padding: '16px 0',
                borderTop: `1px solid ${t.border}`,
              }}>
                {footer}
              </div>
            );
          })()}
        </div>
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


// ── Interactive Constellation (Step 2 — skill selection) ────────────────
function InteractiveConstellation({ agentName, roleLabel, skills, selectedSkills, customSkills, onToggleSkill, onAddCustomSkill, onRemoveCustomSkill }) {
  const [newSkillName, setNewSkillName] = useState('');
  const [hovered, setHovered] = useState(null);
  const SIZE = 420;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const ORBIT = 120;
  // Expanded viewBox to include label text space on all sides
  const VB_PAD_X = 160;
  const VB_PAD_Y = 20;
  const VB = `${-VB_PAD_X} ${-VB_PAD_Y} ${SIZE + VB_PAD_X * 2} ${SIZE + VB_PAD_Y * 2}`;

  // Merge role skills + custom skills
  const allSkills = [
    ...skills.map(s => ({ ...s, custom: false })),
    ...customSkills.map(s => ({ ...s, custom: true })),
  ];
  const count = allSkills.length;

  // Position nodes in orbit
  const nodes = allSkills.map((skill, i) => {
    const angle = ((i * 360) / Math.max(count, 1) - 90) * (Math.PI / 180);
    const x = CX + ORBIT * Math.cos(angle);
    const y = CY + ORBIT * Math.sin(angle);
    const cpAngle = angle + 0.2;
    const cpR = ORBIT * 0.45;
    const cpx = CX + cpR * Math.cos(cpAngle);
    const cpy = CY + cpR * Math.sin(cpAngle);
    const path = `M ${CX} ${CY} Q ${cpx} ${cpy} ${x} ${y}`;
    const isSelected = selectedSkills.includes(skill.name);
    return { ...skill, x, y, path, isSelected, index: i };
  });

  function handleAddCustom() {
    const name = newSkillName.trim();
    if (!name) return;
    if (allSkills.some(s => s.name.toLowerCase() === name.toLowerCase())) return;
    onAddCustomSkill({ name, color: '#F59E0B', category: 'custom', description: 'Compétence personnalisée' });
    setNewSkillName('');
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <svg viewBox={VB} style={{ width: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
        <defs>
          <filter id="icGlow">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
        </defs>

        {/* Orbit ring */}
        <circle cx={CX} cy={CY} r={ORBIT} fill="none" stroke={t.border} strokeWidth="1" strokeDasharray="4 6" opacity="0.5" />

        {/* Connections */}
        {nodes.map((node, i) => (
          <path
            key={`ic-conn-${i}`}
            d={node.path} fill="none"
            stroke={node.isSelected ? (node.color || t.violet) : t.border}
            strokeWidth={node.isSelected ? 1.8 : 0.8}
            strokeOpacity={node.isSelected ? 0.5 : 0.15}
            style={{ transition: 'all 0.5s ease' }}
          />
        ))}

        {/* Skill nodes (clickable) */}
        {nodes.map((node, i) => {
          const isRight = node.x > CX;
          const isHov = hovered === i;
          const sel = node.isSelected;
          const col = node.color || t.violet;
          return (
            <g key={`ic-n-${i}`}
              style={{ cursor: 'pointer', pointerEvents: 'all', animation: `constellationBirth 0.5s ease-out forwards ${i * 80}ms`, opacity: 0, transformOrigin: `${node.x}px ${node.y}px` }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => node.custom && sel ? onRemoveCustomSkill(node.name) : onToggleSkill(node.name)}
            >
              {/* Hover/selected glow */}
              {(sel || isHov) && (
                <circle cx={node.x} cy={node.y} r="28" fill={col} fillOpacity={sel ? 0.1 : 0.05}
                  style={{ transition: 'all 0.3s' }} />
              )}
              {/* Node circle */}
              <circle cx={node.x} cy={node.y} r="20"
                fill={sel ? `${col}22` : isHov ? t.surfaceEl : t.surface}
                stroke={sel ? col : isHov ? t.borderS : t.border}
                strokeWidth={sel ? 2.5 : 1.5}
                style={{ transition: 'all 0.3s ease' }}
              />
              {/* Inner indicator */}
              {sel && <circle cx={node.x} cy={node.y} r="5" fill={col} style={{ transition: 'all 0.3s' }} />}
              {!sel && <circle cx={node.x} cy={node.y} r="2" fill={t.tm} />}
              {/* Custom badge */}
              {node.custom && (
                <text x={node.x} y={node.y - 24} textAnchor="middle" fill={t.warning}
                  style={{ fontSize: '8px', fontWeight: 700, fontFamily: t.mono }}>
                  CUSTOM
                </text>
              )}
              {/* Skill name */}
              <text
                x={node.x + (isRight ? 28 : -28)} y={node.y + 1}
                textAnchor={isRight ? 'start' : 'end'}
                fill={sel ? t.tp : isHov ? t.ts : t.tm}
                style={{ fontSize: '10px', fontWeight: sel ? 600 : 400, fontFamily: t.font, transition: 'all 0.2s', pointerEvents: 'none' }}
              >
                {node.name}
              </text>
              {/* Category */}
              <text
                x={node.x + (isRight ? 28 : -28)} y={node.y + 13}
                textAnchor={isRight ? 'start' : 'end'}
                fill={t.tm}
                style={{ fontSize: '7px', textTransform: 'uppercase', fontFamily: t.mono, letterSpacing: '0.05em', pointerEvents: 'none' }}
              >
                {node.category}
              </text>
            </g>
          );
        })}

        {/* Center node — agent */}
        <g>
          <circle cx={CX} cy={CY} r="44" fill={t.violet} fillOpacity="0.06" />
          <circle cx={CX} cy={CY} r="38" fill={t.bg} stroke={t.violet} strokeWidth="2.5"
            filter="url(#icGlow)" />
          <text x={CX} y={CY - 4} textAnchor="middle" fill={t.tp}
            style={{ fontSize: '13px', fontWeight: 700, fontFamily: t.font }}>
            {agentName}
          </text>
          <text x={CX} y={CY + 11} textAnchor="middle" fill={t.ts}
            style={{ fontSize: '9px', textTransform: 'uppercase', fontFamily: t.mono, letterSpacing: '0.04em', opacity: 0.8 }}>
            {roleLabel}
          </text>
          {/* Selected count badge */}
          <circle cx={CX + 30} cy={CY - 28} r="12" fill={t.violet} />
          <text x={CX + 30} y={CY - 24} textAnchor="middle" fill="#fff"
            style={{ fontSize: '10px', fontWeight: 700, fontFamily: t.mono }}>
            {selectedSkills.length}
          </text>
        </g>
      </svg>

      {/* Add custom skill input */}
      <div style={{
        display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center',
        marginTop: '8px',
      }}>
        <input
          value={newSkillName}
          onChange={e => setNewSkillName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
          placeholder="+ Ajouter une compétence..."
          style={{
            backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '100px',
            padding: '8px 16px', color: t.tp, fontSize: '12px', fontFamily: t.font,
            outline: 'none', width: '200px', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = t.violet}
          onBlur={e => e.target.style.borderColor = t.border}
        />
        <button
          onClick={handleAddCustom}
          disabled={!newSkillName.trim()}
          style={{
            backgroundColor: newSkillName.trim() ? t.violet : t.surfaceEl,
            color: '#fff', border: 'none', borderRadius: '100px',
            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: newSkillName.trim() ? 'pointer' : 'default', fontSize: '16px', fontWeight: 700,
            transition: 'all 0.2s',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Skill Constellation (Final — read-only) ─────────────────────────────
function SkillConstellation({ agentName, roleLabel, skills = [], onComplete }) {
  const SIZE = 420;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const ORBIT = 120;
  const VB_PAD_X = 160;
  const VB_PAD_Y = 20;
  const VB = `${-VB_PAD_X} ${-VB_PAD_Y} ${SIZE + VB_PAD_X * 2} ${SIZE + VB_PAD_Y * 2}`;
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
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox={VB} style={{ width: '100%', overflow: 'hidden' }}>
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
