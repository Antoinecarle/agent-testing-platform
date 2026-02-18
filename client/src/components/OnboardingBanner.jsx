import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Mail, User, Building2, Bot, FolderPlus, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
};

const STEP_ICONS = {
  verify_email: Mail,
  complete_profile: User,
  create_org: Building2,
  create_agent: Bot,
  create_project: FolderPlus,
};

const STEP_ROUTES = {
  verify_email: '/settings?tab=security',
  complete_profile: '/settings?tab=profile',
  create_org: '/settings?tab=organizations',
  create_agent: '/agents/new',
  create_project: null,
};

export default function OnboardingBanner({ steps = [], completed = 0, total = 5, percentage = 0, onDismiss, onNewProject }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const allDone = completed === total;

  const handleStepClick = (step) => {
    if (step.completed) return;
    if (step.id === 'create_project' && onNewProject) {
      onNewProject();
      return;
    }
    const route = STEP_ROUTES[step.id];
    if (route) navigate(route);
  };

  if (allDone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '24px',
      }}
    >
      {/* Violet gradient accent line */}
      <div style={{
        height: '2px',
        background: `linear-gradient(90deg, ${t.violet}, rgba(139,92,246,0.3))`,
      }} />

      <div style={{ padding: '16px 20px' }}>
        {/* Header row */}
        <div className="onb-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '180px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={16} color={t.violet} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>
                Get started with GURU
              </div>
              <div style={{ fontSize: '11px', color: t.ts, marginTop: '2px' }}>
                {completed}/{total} steps completed
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="onb-progress" style={{ flex: 1, maxWidth: '200px' }}>
            <div style={{
              height: '4px', background: t.surfaceEl, borderRadius: '2px', overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ height: '100%', background: t.violet, borderRadius: '2px' }}
              />
            </div>
          </div>

          {/* Step dots */}
          <div className="onb-dots" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {steps.map((step) => (
              <div
                key={step.id}
                onClick={() => handleStepClick(step)}
                style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.completed ? t.success : t.surfaceEl,
                  border: `1px solid ${step.completed ? 'transparent' : t.borderS}`,
                  cursor: step.completed ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                }}
                title={step.label}
              >
                {step.completed ? (
                  <Check size={12} color="#fff" />
                ) : (
                  React.createElement(STEP_ICONS[step.id] || User, { size: 10, color: t.ts })
                )}
              </div>
            ))}
          </div>

          {/* Expand/collapse & dismiss */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none', border: 'none', color: t.ts, padding: '4px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronRight
                size={14}
                style={{
                  transition: 'transform 0.2s',
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
            </button>
            <button
              onClick={onDismiss}
              style={{
                background: 'none', border: 'none', color: t.tm, padding: '4px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
              title="Dismiss onboarding"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Expandable step list */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                marginTop: '16px', paddingTop: '16px',
                borderTop: `1px solid ${t.border}`,
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                {steps.map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleStepClick(step)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: step.completed ? 'transparent' : t.surfaceEl,
                      cursor: step.completed ? 'default' : 'pointer',
                      opacity: step.completed ? 0.5 : 1,
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: step.completed ? t.success : t.violetM,
                      flexShrink: 0,
                    }}>
                      {step.completed ? (
                        <Check size={10} color="#fff" />
                      ) : (
                        React.createElement(STEP_ICONS[step.id] || User, { size: 10, color: t.violet })
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '12px', fontWeight: '500', color: t.tp,
                        textDecoration: step.completed ? 'line-through' : 'none',
                      }}>
                        {step.label}
                      </div>
                      <div style={{ fontSize: '11px', color: t.tm }}>{step.description}</div>
                    </div>
                    {!step.completed && (
                      <ChevronRight size={12} color={t.ts} />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .onb-progress { display: none !important; }
          .onb-dots { display: none !important; }
        }
      `}</style>
    </motion.div>
  );
}
