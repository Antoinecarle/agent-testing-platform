// REQUIRED DEPENDENCIES:
// - lucide-react (npm install lucide-react)

import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Info } from 'lucide-react';

const tokens = {
  colors: {
    bg: '#0f0f0f',
    surface: '#1a1a1b',
    surfaceElevated: '#242426',
    border: 'rgba(255, 255, 255, 0.06)',
    borderStrong: 'rgba(255, 255, 255, 0.12)',
    violet: '#8B5CF6',
    violetMuted: 'rgba(139, 92, 246, 0.2)',
    violetGlow: 'rgba(139, 92, 246, 0.12)',
    textPrimary: '#F4F4F5',
    textSecondary: '#A1A1AA',
    textMuted: '#52525B',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '48px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  font: {
    family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  }
};

const formatTimeAgo = (date) => {
  if (!date) return null;
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
};

const StatusIndicator = ({ status = 'idle', timestamp = null, tooltip = '' }) => {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const styleId = 'status-indicator-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @keyframes pulse-violet {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        @keyframes pulse-danger {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const config = useMemo(() => {
    switch (status) {
      case 'running':
        return {
          color: tokens.colors.violet,
          animation: 'pulse-violet 2s infinite',
          label: 'Running'
        };
      case 'error':
        return {
          color: tokens.colors.danger,
          animation: 'pulse-danger 2s infinite',
          label: 'Error'
        };
      case 'success':
        return {
          color: tokens.colors.success,
          animation: 'none',
          label: 'Success'
        };
      default:
        return {
          color: tokens.colors.textMuted,
          animation: 'none',
          label: 'Idle'
        };
    }
  }, [status]);

  const containerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
    borderRadius: tokens.radius.sm,
    backgroundColor: isHovered ? tokens.colors.surfaceElevated : 'transparent',
    transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: tooltip ? 'help' : 'default',
    position: 'relative',
    userSelect: 'none',
    fontFamily: tokens.font.family,
  };

  const dotWrapperStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '12px',
    height: '12px',
  };

  const dotStyle = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: config.color,
    animation: config.animation,
  };

  const labelStyle = {
    fontSize: '12px',
    fontWeight: '500',
    color: tokens.colors.textPrimary,
    lineHeight: 1,
  };

  const timestampStyle = {
    fontSize: '11px',
    color: tokens.colors.textMuted,
    fontFamily: tokens.font.mono,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const tooltipStyle = {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: `translateX(-50%) translateY(${isHovered ? '-8px' : '0px'})`,
    backgroundColor: tokens.colors.surfaceElevated,
    border: `1px solid ${tokens.colors.borderStrong}`,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    zIndex: 50,
    width: 'max-content',
    maxWidth: '240px',
    opacity: isHovered ? 1 : 0,
    visibility: isHovered ? 'visible' : 'hidden',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none',
  };

  const tooltipTextStyle = {
    fontSize: '12px',
    color: tokens.colors.textSecondary,
    lineHeight: '1.4',
    margin: 0,
  };

  const tooltipHeaderStyle = {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: tokens.colors.textMuted,
    marginBottom: tokens.spacing.xs,
    display: 'block',
    fontWeight: '700',
  };

  return (
    <div
      style={containerStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {tooltip && (
        <div style={tooltipStyle}>
          <span style={tooltipHeaderStyle}>System Status</span>
          <p style={tooltipTextStyle}>{tooltip}</p>
          <div style={{
            position: 'absolute',
            bottom: '-5px',
            left: '50%',
            marginLeft: '-5px',
            borderWidth: '5px 5px 0',
            borderStyle: 'solid',
            borderColor: `${tokens.colors.borderStrong} transparent transparent transparent`
          }} />
        </div>
      )}

      <div style={dotWrapperStyle}>
        <div style={dotStyle} />
      </div>

      <span style={labelStyle}>{config.label}</span>

      {timestamp && (
        <>
          <div style={{ width: '1px', height: '10px', backgroundColor: tokens.colors.border }} />
          <div style={timestampStyle}>
            <Clock size={10} strokeWidth={2.5} />
            {formatTimeAgo(timestamp)}
          </div>
        </>
      )}

      {tooltip && isHovered && (
        <Info size={10} color={tokens.colors.violet} style={{ marginLeft: 'auto' }} />
      )}
    </div>
  );
};

export default StatusIndicator;
