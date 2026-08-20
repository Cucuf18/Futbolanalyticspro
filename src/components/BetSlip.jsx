import React from 'react';
import { useBetSlip } from '../context/BetSlipContext';

export default function BetSlip() {
  const { slip, removeFromSlip, clearSlip, settleBet } = useBetSlip();

  if (slip.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '320px',
      background: 'rgba(15, 22, 41, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--accent-gold)',
      borderRadius: '16px',
      padding: '16px',
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-gold)' }}>
          🎟️ Mi Combinada ({slip.length})
        </h3>
        <button 
          onClick={clearSlip}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}
        >
          Limpiar
        </button>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slip.map((pick) => (
          <div key={pick.matchId} style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '10px',
            position: 'relative'
          }}>
            <button 
              onClick={() => removeFromSlip(pick.matchId)}
              style={{ position: 'absolute', top: '4px', right: '4px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              ✕
            </button>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', paddingRight: '16px' }}>
              {pick.homeTeam} vs {pick.awayTeam}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Pick: <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{pick.valueBetType}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '8px' }}>Prob: {pick.probability}%</span>
                <span style={{ fontSize: '10px', color: 'var(--accent-green)', fontWeight: 700 }}>@{pick.odds}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  title="Marcar como Acertado"
                  onClick={() => settleBet(pick.matchId, 'WON')}
                  style={{ background: 'rgba(0, 230, 118, 0.1)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '12px' }}
                >
                  ✅
                </button>
                <button 
                  title="Marcar como Fallado"
                  onClick={() => settleBet(pick.matchId, 'LOST')}
                  style={{ background: 'rgba(255, 59, 48, 0.1)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '12px' }}
                >
                  ❌
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
