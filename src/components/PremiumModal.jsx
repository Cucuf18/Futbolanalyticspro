import React from 'react';

export default function PremiumModal({ isOpen, onClose, onActivatePremium }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div className="glass-card animate-fade-in" style={{
        maxWidth: '500px',
        width: '100%',
        padding: '32px',
        border: '1px solid rgba(255, 170, 0, 0.3)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 170, 0, 0.2)',
        position: 'relative',
      }}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-muted)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            fontSize: '16px',
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>⚡⭐</div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }} className="gradient-gold">
            FutbolAnalytics PRO
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Accede al motor completo de predicciones por Inteligencia Artificial y señales de valor.
          </p>
        </div>

        {/* Feature List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
            <span style={{ color: 'var(--accent-green)', fontSize: '18px' }}>✓</span>
            <span>Acceso ilimitado a probabilidades de victoria por <strong>Poisson + xG</strong>.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
            <span style={{ color: 'var(--accent-green)', fontSize: '18px' }}>✓</span>
            <span>Alertas en tiempo real de <strong>Value Bets</strong> y cuotas recomendadas.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
            <span style={{ color: 'var(--accent-green)', fontSize: '18px' }}>✓</span>
            <span>Historial H2H extendido con <strong>matriz de 6x6 marcadores probables</strong>.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
            <span style={{ color: 'var(--accent-green)', fontSize: '18px' }}>✓</span>
            <span>Experiencia <strong>sin publicidad (Ad-Free)</strong>.</span>
          </div>

        </div>

        {/* Pricing & CTA */}
        <div style={{ background: 'rgba(15, 22, 41, 0.9)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)', textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pase de Acceso Total</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>
            $14.99 <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>/ mes</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-green)' }}>Cancela en cualquier momento sin compromiso.</div>
        </div>

        <button
          onClick={() => {
            onActivatePremium();
            onClose();
          }}
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
          🚀 Activar Suscripción Premium Ahora
        </button>

      </div>
    </div>
  );
}
