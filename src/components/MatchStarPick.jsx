import React from 'react';
import { useBetSlip } from '../context/BetSlipContext';

export default function MatchStarPick({ starPick, matchInfo }) {
  const { addToSlip } = useBetSlip();

  if (!starPick) return null;

  const isEV = starPick.evThreshold === 'EV+';

  const handleSavePick = () => {
    addToSlip({
      matchId: `${matchInfo.homeTeam.id}-${matchInfo.awayTeam.id}-${starPick.type}`,
      homeTeam: matchInfo.homeTeam.shortName,
      awayTeam: matchInfo.awayTeam.shortName,
      valueBetType: starPick.type,
      probability: starPick.probability,
      odds: starPick.fairOdds // Using fair odds as placeholder if market odds not available
    });
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255, 170, 0, 0.15) 0%, rgba(255, 61, 113, 0.1) 100%)',
      border: '1px solid rgba(255, 170, 0, 0.4)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '28px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(255, 170, 0, 0.1)'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px',
        background: 'radial-gradient(circle, rgba(255, 170, 0, 0.2) 0%, rgba(255,170,0,0) 70%)',
        borderRadius: '50%', zIndex: 0
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '20px', textShadow: '0 0 10px rgba(255,170,0,0.8)' }}>🔥</span>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            El Pick Estrella
          </h3>
          {isEV && (
             <div style={{ fontSize: '10px', fontWeight: 800, color: '#fff', background: 'var(--accent-green)', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto' }}>
               VALUE BET DETECTADO
             </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#fff', marginBottom: '4px', letterSpacing: '-0.02em' }}>
              {starPick.label}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Probabilidad Matemática: <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{starPick.probability}%</span>
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
              Cuota Justa
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent-gold)' }}>
              @{starPick.fairOdds}
            </div>
          </div>
        </div>

        <button
          onClick={handleSavePick}
          style={{
            marginTop: '16px', width: '100%', padding: '12px', borderRadius: '10px',
            background: 'linear-gradient(90deg, #ffaa00 0%, #ff3d71 100%)',
            color: '#fff', fontSize: '14px', fontWeight: 800, border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 61, 113, 0.3)',
            transition: 'transform 0.2s ease',
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          + Añadir al Boleto
        </button>
      </div>
    </div>
  );
}
