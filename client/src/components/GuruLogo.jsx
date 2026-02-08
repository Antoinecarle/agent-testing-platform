import React from 'react';

// Logo pixel art minimaliste pour guru.ai
export default function GuruLogo({ size = 32, withText = false, glowing = false }) {
  const pixelSize = size / 8;
  
  const glowStyle = glowing ? {
    filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 4px rgba(139, 92, 246, 0.4))'
  } : {};

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* Logo pixel art - Tête de guru stylisée */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 16 16" 
        fill="none"
        style={{ imageRendering: 'pixelated', ...glowStyle }}
      >
        {/* Base - violet clair */}
        <rect x="5" y="3" width="6" height="1" fill="#a78bfa"/>
        <rect x="4" y="4" width="8" height="1" fill="#a78bfa"/>
        
        {/* Tête principale - violet */}
        <rect x="4" y="5" width="8" height="5" fill="#8B5CF6"/>
        
        {/* Yeux - blanc */}
        <rect x="6" y="7" width="1" height="1" fill="#F4F4F5"/>
        <rect x="9" y="7" width="1" height="1" fill="#F4F4F5"/>
        
        {/* Bouche/sourire - violet foncé */}
        <rect x="6" y="9" width="1" height="1" fill="#6d28d9"/>
        <rect x="7" y="9" width="2" height="1" fill="#6d28d9"/>
        <rect x="9" y="9" width="1" height="1" fill="#6d28d9"/>
        
        {/* Chapeau/aura - violet brillant */}
        <rect x="6" y="2" width="4" height="1" fill="#c4b5fd"/>
        <rect x="7" y="1" width="2" height="1" fill="#c4b5fd"/>
        
        {/* Base corps */}
        <rect x="5" y="10" width="6" height="1" fill="#7c3aed"/>
        <rect x="6" y="11" width="4" height="1" fill="#7c3aed"/>
        
        {/* Accent brillant */}
        <rect x="5" y="6" width="1" height="1" fill="#c4b5fd" opacity="0.6"/>
      </svg>

      {/* Texte guru.ai */}
      {withText && (
        <div style={{ 
          fontFamily: '"Press Start 2P", "JetBrains Mono", monospace',
          fontSize: size * 0.4,
          fontWeight: '400',
          letterSpacing: '0.05em',
          color: '#F4F4F5',
          lineHeight: 1,
          textShadow: glowing ? '0 0 10px rgba(139, 92, 246, 0.5)' : 'none'
        }}>
          guru<span style={{ color: '#8B5CF6' }}>.ai</span>
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
