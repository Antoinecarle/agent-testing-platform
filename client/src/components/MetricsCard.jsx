import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from 'lucide-react';

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

const MetricsCard = ({
  label = "[Metric Label]",
  value = "[0.00]",
  icon,
  trend,
  progress,
  onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getTrendColor = (direction) => {
    if (direction === 'up') return tokens.colors.success;
    if (direction === 'down') return tokens.colors.danger;
    return tokens.colors.textMuted;
  };

  const TrendIcon = ({ direction }) => {
    const size = 14;
    if (direction === 'up') return <ArrowUpRight size={size} />;
    if (direction === 'down') return <ArrowDownRight size={size} />;
    return <Minus size={size} />;
  };

  const styles = {
    card: {
      position: 'relative',
      backgroundColor: isHovered ? tokens.colors.surfaceElevated : tokens.colors.surface,
      border: `1px solid ${isHovered ? tokens.colors.borderStrong : tokens.colors.border}`,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.md,
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.sm,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      minWidth: '220px',
      boxShadow: isHovered ? `0 8px 32px -12px ${tokens.colors.violetGlow}` : 'none',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
    },
    label: {
      fontSize: '10px',
      fontWeight: '600',
      color: tokens.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      fontFamily: tokens.font.family,
    },
    iconWrapper: {
      color: isHovered ? tokens.colors.violet : tokens.colors.textMuted,
      transition: 'color 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: {
      fontSize: '24px',
      fontWeight: '500',
      color: tokens.colors.textPrimary,
      fontFamily: tokens.font.mono,
      letterSpacing: '-0.02em',
      margin: `${tokens.spacing.xs} 0`,
    },
    trendContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '12px',
      fontWeight: '500',
      fontFamily: tokens.font.family,
      color: trend ? getTrendColor(trend.direction) : 'transparent',
    },
    progressTrack: {
      width: '100%',
      height: '4px',
      backgroundColor: tokens.colors.border,
      borderRadius: tokens.radius.sm,
      marginTop: tokens.spacing.xs,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: tokens.colors.violet,
      width: `${Math.min(Math.max(progress, 0), 100)}%`,
      borderRadius: tokens.radius.sm,
      transition: 'width 1s cubic-bezier(0.65, 0, 0.35, 1)',
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      fontSize: '11px',
      color: tokens.colors.violet,
      fontWeight: '500',
      opacity: isHovered ? 1 : 0,
      transform: isHovered ? 'translateY(0)' : 'translateY(4px)',
      transition: 'all 0.2s ease',
      marginTop: tokens.spacing.xs,
      fontFamily: tokens.font.family,
    },
    glow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '1px',
      background: `linear-gradient(90deg, transparent, ${tokens.colors.violet}, transparent)`,
      opacity: isHovered ? 0.5 : 0,
      transition: 'opacity 0.3s ease',
    }
  };

  return (
    <div
      style={styles.card}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={styles.glow} />

      <div style={styles.header}>
        <span style={styles.label}>{label}</span>
        {icon && <div style={styles.iconWrapper}>{icon}</div>}
      </div>

      <div style={styles.value}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '20px' }}>
        {trend && (
          <div style={styles.trendContainer}>
            <TrendIcon direction={trend.direction} />
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {typeof progress === 'number' && (
        <div style={styles.progressTrack}>
          <div style={styles.progressFill} />
        </div>
      )}

      <div style={styles.footer}>
        View details <ChevronRight size={12} style={{ marginLeft: '2px' }} />
      </div>
    </div>
  );
};

export default MetricsCard;
