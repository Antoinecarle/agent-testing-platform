import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, FolderPlus, Zap, Brain, Check, ChevronLeft, ChevronRight,
  X, Sparkles, Rocket, ArrowRight, BookOpen, Star, Terminal
} from 'lucide-react';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

// ─── Particle background ────────────────────────────────────────
function Particles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 0,
        pointerEvents: 'none', opacity: 0.7,
      }}
    />
  );
}

// ─── Confetti for final step ────────────────────────────────────
function Confetti() {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    const colors = ['#8B5CF6', '#a78bfa', '#c4b5fd', '#22c55e', '#f59e0b', '#F4F4F5'];
    const newPieces = [];
    for (let i = 0; i < 80; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        duration: Math.random() * 2 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 4,
        rotation: Math.random() * 360,
      });
    }
    setPieces(newPieces);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: 0, rotate: p.rotation + 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: '1px',
          }}
        />
      ))}
    </div>
  );
}

// ─── Floating agent cards for step 1 ───────────────────────────
function FloatingAgentCards() {
  const agents = [
    { name: 'Web Designer', icon: Sparkles, color: '#8B5CF6' },
    { name: 'Code Reviewer', icon: Terminal, color: '#22c55e' },
    { name: 'Content Writer', icon: BookOpen, color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '32px', flexWrap: 'wrap', padding: '0 16px' }}>
      {agents.map((agent, i) => (
        <motion.div
          key={agent.name}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: [0, -8, 0], scale: 1 }}
          transition={{
            opacity: { delay: 0.3 + i * 0.15, duration: 0.4 },
            y: { delay: 0.5 + i * 0.15, duration: 3, repeat: Infinity, ease: 'easeInOut' },
            scale: { delay: 0.3 + i * 0.15, duration: 0.4 },
          }}
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            minWidth: '120px',
          }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `${agent.color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <agent.icon size={20} color={agent.color} />
          </div>
          <span style={{ fontSize: '11px', color: t.ts, fontWeight: 500 }}>{agent.name}</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            {[...Array(5)].map((_, j) => (
              <Star key={j} size={8} color={t.violet} fill={j < 4 ? t.violet : 'none'} />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Mock project card for step 2 ──────────────────────────────
function MockProjectCard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        maxWidth: '320px',
        margin: '32px auto 0',
      }}
    >
      {/* Fake browser bar */}
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
        <div style={{
          flex: 1, marginLeft: '8px', padding: '4px 10px',
          background: t.bg, borderRadius: '4px', fontSize: '10px', color: t.tm,
          fontFamily: t.mono,
        }}>
          index.html
        </div>
      </div>
      {/* Fake content */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <motion.div
          animate={{ width: ['0%', '80%'] }}
          transition={{ delay: 0.6, duration: 1.2, ease: 'easeOut' }}
          style={{ height: '8px', background: t.violetM, borderRadius: '4px' }}
        />
        <motion.div
          animate={{ width: ['0%', '60%'] }}
          transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
          style={{ height: '8px', background: t.violetG, borderRadius: '4px' }}
        />
        <motion.div
          animate={{ width: ['0%', '95%'] }}
          transition={{ delay: 1.0, duration: 1.4, ease: 'easeOut' }}
          style={{ height: '8px', background: t.violetM, borderRadius: '4px' }}
        />
        <motion.div
          animate={{ width: ['0%', '45%'] }}
          transition={{ delay: 1.2, duration: 0.8, ease: 'easeOut' }}
          style={{ height: '8px', background: t.violetG, borderRadius: '4px' }}
        />
      </div>
      <div style={{
        padding: '10px 14px',
        borderTop: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '10px', color: t.tm, fontFamily: t.mono }}>
          <motion.span
            animate={{ opacity: [0, 1] }}
            transition={{ delay: 1.5, duration: 0.3 }}
          >
            v1 generated
          </motion.span>
        </span>
        <motion.div
          animate={{ opacity: [0, 1] }}
          transition={{ delay: 1.5, duration: 0.3 }}
          style={{
            fontSize: '9px', padding: '3px 8px', borderRadius: '100px',
            background: `${t.success}22`, color: t.success, fontWeight: 600,
          }}
        >
          LIVE
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Skill cards for step 3 ─────────────────────────────────────
function SkillCards() {
  const skills = [
    { cmd: '/commit', desc: 'Git analysis', icon: Terminal },
    { cmd: '/review-pr', desc: 'PR audit', icon: BookOpen },
    { cmd: '/refactor', desc: 'Code cleanup', icon: Zap },
  ];

  return (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px', flexWrap: 'wrap' }}>
      {skills.map((skill, i) => (
        <motion.div
          key={skill.cmd}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: '12px',
            minWidth: '160px',
          }}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: t.violetM,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <skill.icon size={16} color={t.violet} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: t.tp, fontFamily: t.mono }}>
              {skill.cmd}
            </div>
            <div style={{ fontSize: '10px', color: t.tm, marginTop: '2px' }}>{skill.desc}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Knowledge graph for step 4 ─────────────────────────────────
function KnowledgeGraph() {
  const nodes = [
    { x: 50, y: 30, label: 'Docs', size: 18 },
    { x: 25, y: 60, label: 'API', size: 14 },
    { x: 75, y: 55, label: 'Code', size: 16 },
    { x: 40, y: 80, label: 'FAQs', size: 12 },
    { x: 65, y: 85, label: 'Data', size: 12 },
  ];

  const edges = [[0,1],[0,2],[1,3],[2,4],[0,4],[1,2]];

  return (
    <div style={{ position: 'relative', width: '280px', height: '160px', margin: '32px auto 0' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        {edges.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke={t.violet}
            strokeOpacity={0.2}
            strokeWidth={0.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
          />
        ))}
      </svg>
      {nodes.map((node, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 200 }}
          style={{
            position: 'absolute',
            left: `${node.x}%`, top: `${node.y}%`,
            transform: 'translate(-50%, -50%)',
            width: node.size * 2, height: node.size * 2,
            borderRadius: '50%',
            background: t.violetM,
            border: `1px solid ${t.violet}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '7px', color: t.ts, fontWeight: 600 }}>{node.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Step definitions ───────────────────────────────────────────
const STEPS = [
  {
    id: 'welcome',
    title: null, // welcome has custom layout
  },
  {
    id: 'agents',
    icon: Bot,
    title: 'Meet Your AI Agents',
    description: 'Browse 35+ specialized agents or create your own. Each agent has unique skills and personality.',
    visual: FloatingAgentCards,
    cta: { label: 'Browse Agents', path: '/agents' },
  },
  {
    id: 'projects',
    icon: FolderPlus,
    title: 'Launch Projects',
    description: 'Assign agents to projects. Watch them generate beautiful iterations in real-time.',
    visual: MockProjectCard,
    cta: { label: 'Create Project', path: '/project/new' },
  },
  {
    id: 'skills',
    icon: Zap,
    title: 'Powerful Skills',
    description: 'Extend your agents with custom skills. From git commits to code reviews, skills make agents powerful.',
    visual: SkillCards,
    cta: { label: 'Explore Skills', path: '/skills' },
  },
  {
    id: 'knowledge',
    icon: Brain,
    title: 'Knowledge Bases',
    description: 'Feed your agents with custom knowledge. Semantic search, embeddings, and context injection.',
    visual: KnowledgeGraph,
    cta: { label: 'Create Knowledge', path: '/knowledge' },
  },
  {
    id: 'complete',
    title: null, // complete has custom layout
  },
];

// ─── Slide variants ─────────────────────────────────────────────
const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

// ─── Main Component ─────────────────────────────────────────────
export default function OnboardingWizard({ onComplete, onNavigate }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const totalSteps = STEPS.length;

  const goNext = useCallback(() => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }, [step, totalSteps]);

  const goBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const skip = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      else if (e.key === 'ArrowLeft') goBack();
      else if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goBack, skip]);

  // ─── Welcome step ────────────────────────────────────────────
  const renderWelcome = () => (
    <motion.div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', textAlign: 'center',
        position: 'relative', zIndex: 2, padding: '24px',
      }}
    >
      {/* Gradient orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: '400px', height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          top: '20%', left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        style={{
          position: 'absolute',
          width: '300px', height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
          top: '35%', left: '35%',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 150 }}
        style={{
          width: '80px', height: '80px', borderRadius: '20px',
          background: `linear-gradient(135deg, ${t.violet}, #6d28d9)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 60px rgba(139,92,246,0.3)`,
          marginBottom: '32px',
        }}
      >
        <Rocket size={36} color="#fff" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{
          fontSize: '42px',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${t.tp}, ${t.ts})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0, lineHeight: 1.1,
        }}
      >
        Welcome to GURU
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        style={{
          fontSize: '16px', color: t.ts,
          marginTop: '12px', maxWidth: '400px', lineHeight: 1.5,
        }}
      >
        Your AI Agent Testing Platform.
        <br />
        Let us show you around.
      </motion.p>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        whileHover={{ scale: 1.04, boxShadow: `0 0 30px rgba(139,92,246,0.3)` }}
        whileTap={{ scale: 0.97 }}
        onClick={goNext}
        style={{
          marginTop: '40px',
          padding: '14px 36px',
          background: `linear-gradient(135deg, ${t.violet}, #7c3aed)`,
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        Let's get started <ArrowRight size={16} />
      </motion.button>
    </motion.div>
  );

  // ─── Complete / celebration step ──────────────────────────────
  const renderComplete = () => (
    <motion.div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', textAlign: 'center',
        position: 'relative', zIndex: 2, padding: '24px',
      }}
    >
      <Confetti />

      {/* Success glow */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          position: 'absolute',
          width: '200px', height: '200px', borderRadius: '50%',
          background: `radial-gradient(circle, rgba(34,197,94,0.2) 0%, transparent 70%)`,
          filter: 'blur(40px)', pointerEvents: 'none',
        }}
      />

      {/* Checkmark */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${t.success}, #16a34a)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 60px rgba(34,197,94,0.3)`,
          marginBottom: '28px',
        }}
      >
        <Check size={40} color="#fff" strokeWidth={3} />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          fontSize: '36px', fontWeight: 700, color: t.tp,
          letterSpacing: '-0.02em', margin: 0,
        }}
      >
        You're All Set!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        style={{ fontSize: '15px', color: t.ts, marginTop: '10px', maxWidth: '360px', lineHeight: 1.5 }}
      >
        Start building amazing things with GURU.
        <br />
        Your agents are ready.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        whileHover={{ scale: 1.04, boxShadow: `0 0 30px rgba(139,92,246,0.3)` }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onComplete?.()}
        style={{
          marginTop: '36px',
          padding: '14px 36px',
          background: `linear-gradient(135deg, ${t.violet}, #7c3aed)`,
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        Go to Dashboard <ArrowRight size={16} />
      </motion.button>
    </motion.div>
  );

  // ─── Content step (steps 1-4) ─────────────────────────────────
  const renderContentStep = (stepData) => {
    const Icon = stepData.icon;
    const Visual = stepData.visual;

    return (
      <motion.div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', textAlign: 'center',
          position: 'relative', zIndex: 2, padding: '24px',
        }}
      >
        {/* Step icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: 'spring' }}
          style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: t.violetM,
            border: `1px solid ${t.violet}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '24px',
          }}
        >
          <Icon size={28} color={t.violet} />
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            fontSize: '28px', fontWeight: 700, color: t.tp,
            letterSpacing: '-0.02em', margin: 0,
          }}
        >
          {stepData.title}
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            fontSize: '14px', color: t.ts, marginTop: '10px',
            maxWidth: '420px', lineHeight: 1.6,
          }}
        >
          {stepData.description}
        </motion.p>

        {/* Visual */}
        {Visual && <Visual />}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{ display: 'flex', gap: '12px', marginTop: '32px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {/* CTA to navigate */}
          {stepData.cta && (
            <motion.button
              whileHover={{ scale: 1.03, borderColor: t.violet }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onComplete?.();
                onNavigate?.(stepData.cta.path);
              }}
              style={{
                padding: '10px 24px',
                background: 'transparent',
                color: t.violet,
                border: `1px solid ${t.violet}66`,
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'border-color 0.2s',
              }}
            >
              {stepData.cta.label} <ArrowRight size={14} />
            </motion.button>
          )}
          {/* Continue tour button */}
          <motion.button
            whileHover={{ scale: 1.03, background: t.surfaceEl }}
            whileTap={{ scale: 0.97 }}
            onClick={goNext}
            style={{
              padding: '10px 24px',
              background: t.surface,
              color: t.ts,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            Continue tour <ChevronRight size={14} />
          </motion.button>
        </motion.div>
      </motion.div>
    );
  };

  // ─── Render current step ──────────────────────────────────────
  const renderStep = () => {
    if (step === 0) return renderWelcome();
    if (step === totalSteps - 1) return renderComplete();
    return renderContentStep(STEPS[step]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: t.bg,
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Background */}
      <Particles />

      {/* Skip button - top right */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        whileHover={{ color: t.tp }}
        onClick={skip}
        style={{
          position: 'absolute', top: '24px', right: '24px', zIndex: 10,
          background: 'none', border: 'none',
          color: t.tm, fontSize: '13px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'color 0.2s',
        }}
      >
        Skip tour <X size={14} />
      </motion.button>

      {/* Step counter - top left */}
      {step > 0 && step < totalSteps - 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'absolute', top: '24px', left: '24px', zIndex: 10,
            fontSize: '12px', color: t.tm, fontFamily: t.mono,
          }}
        >
          {step}/{totalSteps - 2}
        </motion.div>
      )}

      {/* Content area with transitions */}
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {step > 0 && step < totalSteps - 1 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ background: t.surfaceEl }}
          onClick={goBack}
          style={{
            position: 'absolute', left: '24px', top: '50%',
            transform: 'translateY(-50%)', zIndex: 10,
            width: '40px', height: '40px', borderRadius: '50%',
            background: t.surface,
            border: `1px solid ${t.border}`,
            color: t.ts, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          <ChevronLeft size={18} />
        </motion.button>
      )}

      {step > 0 && step < totalSteps - 1 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ background: t.surfaceEl }}
          onClick={goNext}
          style={{
            position: 'absolute', right: '24px', top: '50%',
            transform: 'translateY(-50%)', zIndex: 10,
            width: '40px', height: '40px', borderRadius: '50%',
            background: t.surface,
            border: `1px solid ${t.border}`,
            color: t.ts, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          <ChevronRight size={18} />
        </motion.button>
      )}

      {/* Progress dots - bottom center */}
      <div style={{
        position: 'absolute', bottom: '32px', left: '50%',
        transform: 'translateX(-50%)', zIndex: 10,
        display: 'flex', gap: '8px', alignItems: 'center',
      }}>
        {STEPS.map((_, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.3 }}
            onClick={() => {
              setDirection(i > step ? 1 : -1);
              setStep(i);
            }}
            style={{
              width: i === step ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: i === step ? t.violet : i < step ? `${t.violet}88` : t.surfaceEl,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              padding: 0,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
