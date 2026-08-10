import React from 'react';

export default function Navbar({ isPremium, onTogglePremium, onOpenPremiumModal }) {
  return (
    <header className="glass-card" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            boxShadow: '0 4px 15px rgba(0, 242, 254, 0.4)'
          }}>
            ⚽
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1.1 }}>
              Futbol<span className="gradient-text">Analytics</span> <span style={{ fontSize: '12px', background: 'rgba(0,242,254,0.15)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(0,242,254,0.3)', marginLeft: '6px' }}>MVP</span>
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dashboard Estadístico & Modelado Predictivo AI</p>
          </div>
        </div>

        {/* Status & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          {/* API Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: 'rgba(0, 230, 118, 0.1)',
            border: '1px solid rgba(0, 230, 118, 0.25)',
            fontSize: '12px',
            color: 'var(--accent-green)',
            fontWeight: 500
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }} className="pulse-glow"></span>
            Motor Estadístico Activo
          </div>

          {/* Premium Simulation Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 22, 41, 0.9)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            padding: '3px 4px',
          }}>
            <button
              onClick={() => onTogglePremium(false)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 600,
                background: !isPremium ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: !isPremium ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              Plan Gratuito
            </button>
            <button
              onClick={() => onTogglePremium(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 700,
                background: isPremium ? 'linear-gradient(135deg, #ffe066 0%, #ffaa00 100%)' : 'transparent',
                color: isPremium ? '#000' : 'var(--accent-gold)',
                boxShadow: isPremium ? '0 2px 10px rgba(255, 170, 0, 0.4)' : 'none',
              }}
            >
              ⭐ Premium
            </button>
          </div>

          {/* Upgrade CTA */}
          {!isPremium && (
            <button
              onClick={onOpenPremiumModal}
              style={{
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                color: '#080c16',
                fontWeight: 700,
                fontSize: '13px',
                padding: '8px 16px',
                borderRadius: '12px',
                boxShadow: '0 4px 14px rgba(0, 242, 254, 0.3)',
              }}
            >
              🚀 Desbloquear IA
            </button>
          )}

        </div>

      </div>
    </header>
  );
}
