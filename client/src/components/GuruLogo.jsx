import React from 'react';

export default function GuruLogo({ size = 32, withText = false, glowing = false }) {
  const glowStyle = glowing ? {
    filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 4px rgba(139, 92, 246, 0.4))'
  } : {};

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <img
        src="/logo.png"
        alt="GURU"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.2,
          objectFit: 'cover',
          ...glowStyle,
        }}
      />
      {withText && (
        <div style={{
          fontFamily: '"Inter", -apple-system, sans-serif',
          fontSize: size * 0.45,
          fontWeight: '800',
          letterSpacing: '-0.03em',
          color: '#F4F4F5',
          lineHeight: 1,
          textShadow: glowing ? '0 0 10px rgba(139, 92, 246, 0.5)' : 'none'
        }}>
          GURU<span style={{ color: '#8B5CF6' }}>.ai</span>
        </div>
      )}
    </div>
  );
}

// Version compacte pour la navbar
export function GuruLogoCompact() {
  return <GuruLogo size={28} withText={true} />;
}

// Version avec glow pour landing pages
export function GuruLogoHero() {
  return <GuruLogo size={64} withText={true} glowing={true} />;
}
