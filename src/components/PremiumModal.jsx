import React from 'react';

export default function PremiumModal({ isOpen, onClose, onActivatePremium }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div className="glass-card animate-fade-in" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '32px',
        border: '1px solid rgba(255, 170, 0, 0.3)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 170, 0, 0.15)',
        position: 'relative',
      }}>
        
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px', right: '16px',
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-muted)',
            width: '32px', height: '32px',
            borderRadius: '50%',
            fontSize: '16px',
          }}
        >
          x
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #ffe066 0%, #ffaa00 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: '22px', fontWeight: 800, color: '#000',
            fontFamily: 'var(--font-heading)',
            boxShadow: '0 6px 20px rgba(255, 170, 0, 0.3)',
          }}>
            P
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }} className="gradient-gold">
            FutbolAnalytics PRO
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Motor completo de predicciones estadisticas y senales de valor.
          </p>
        </div>

        {/* Feature List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
          {[
            'Probabilidades de victoria por Poisson + xG sin limite.',
            'Alertas de Value Bets y cuotas minimas recomendadas.',
            'Historial H2H extendido con matriz de marcadores probables.',
            'Experiencia sin publicidad (Ad-Free).',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px' }}>
              <span style={{
                color: 'var(--accent-green)', fontSize: '14px', fontWeight: 800, lineHeight: '20px', flexShrink: 0,
              }}>+</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{
          background: 'rgba(15, 22, 41, 0.9)', padding: '16px', borderRadius: '16px',
          border: '1px solid var(--glass-border)', textAlign: 'center', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acceso Total</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>
            $14.99 <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>/ mes</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-green)' }}>Cancela en cualquier momento.</div>
        </div>

        <button
          onClick={() => { onActivatePremium(); onClose(); }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #ffe066 0%, #ffaa00 100%)',
            color: '#000',
            fontWeight: 800,
            fontSize: '15px',
            padding: '14px',
            borderRadius: '14px',
            boxShadow: '0 6px 20px rgba(255, 170, 0, 0.4)',
          }}
        >
          Activar Suscripcion Premium
        </button>
      </div>
    </div>
  );
}
