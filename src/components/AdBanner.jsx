import React, { useState } from 'react';

export default function AdBanner({ slotId = 'default-slot' }) {
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  return (
    <div style={{
      width: '100%',
      margin: '16px 0',
      padding: '12px 16px',
      background: 'rgba(15, 22, 41, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, rgba(0,242,254,0.03) 0%, rgba(157,78,221,0.03) 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
          AD
        </span>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {/* ─── Google AdSense / Affiliate placeholder ──────────────
             Insert your ad script here. Example:
             <ins class="adsbygoogle" data-ad-client="ca-pub-XXX" data-ad-slot="YYY"></ins>
             ────────────────────────────────────────────────────────── */}
          <strong>Espacio publicitario reservado</strong> — Conecta tu cuenta de Google AdSense o programa de afiliados para monetizar este slot.
        </div>
      </div>

      <button
        onClick={() => setClosed(true)}
        style={{
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: '14px',
          padding: '2px 6px',
          flexShrink: 0,
        }}
        title="Cerrar"
      >
        x
      </button>
    </div>
  );
}
