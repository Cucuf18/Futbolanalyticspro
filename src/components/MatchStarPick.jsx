import React from 'react';
import { useBetSlip } from '../context/BetSlipContext';

// Market type configuration: icon, color scheme, and category label
const MARKET_CONFIG = {
  RESULTADO: { icon: '1X2', color: '#00f2fe', gradient: 'rgba(0, 242, 254, 0.15)', border: 'rgba(0, 242, 254, 0.4)', label: 'RESULTADO' },
  HANDICAP: { icon: 'AH', color: '#9d4edd', gradient: 'rgba(157, 78, 221, 0.15)', border: 'rgba(157, 78, 221, 0.4)', label: 'HANDICAP' },
  GOLES: { icon: 'GOL', color: '#00e676', gradient: 'rgba(0, 230, 118, 0.15)', border: 'rgba(0, 230, 118, 0.4)', label: 'GOLES' },
  TARJETAS: { icon: 'TAR', color: '#ffd600', gradient: 'rgba(255, 214, 0, 0.15)', border: 'rgba(255, 214, 0, 0.4)', label: 'TARJETAS' },
  TIROS: { icon: 'TIR', color: '#ff6d00', gradient: 'rgba(255, 109, 0, 0.15)', border: 'rgba(255, 109, 0, 0.4)', label: 'TIROS AL ARCO' },
  CORNERS: { icon: 'COR', color: '#448aff', gradient: 'rgba(68, 138, 255, 0.15)', border: 'rgba(68, 138, 255, 0.4)', label: 'CORNERS' },
  OFFSIDES: { icon: 'OFF', color: '#ff5252', gradient: 'rgba(255, 82, 82, 0.15)', border: 'rgba(255, 82, 82, 0.4)', label: 'FUERAS DE JUEGO' },
};

export default function MatchStarPick({ starPick, matchInfo }) {
  const { addToSlip } = useBetSlip();

  if (!starPick) return null;

  const isEV = starPick.evThreshold === 'EV+';
  const marketType = starPick.marketType || 'RESULTADO';
  const config = MARKET_CONFIG[marketType] || MARKET_CONFIG.RESULTADO;

  const handleSavePick = () => {
    addToSlip({
      matchId: `${matchInfo.homeTeam.id}-${matchInfo.awayTeam.id}-${starPick.type}`,
      homeTeam: matchInfo.homeTeam.shortName,
      awayTeam: matchInfo.awayTeam.shortName,
      homeTeamFull: matchInfo.homeTeam.name,
      awayTeamFull: matchInfo.awayTeam.name,
      valueBetType: starPick.label,
      probability: starPick.probability,
      odds: starPick.fairOdds
    });
  };

  return (
    <div style={{
      background: `linear-gradient(135deg, ${config.gradient} 0%, rgba(255, 255, 255, 0.02) 100%)`,
      border: `1px solid ${config.border}`,
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '28px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 8px 32px ${config.gradient}`
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px',
        background: `radial-gradient(circle, ${config.gradient} 0%, rgba(0,0,0,0) 70%)`,
        borderRadius: '50%', zIndex: 0
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          {/* Market type icon badge */}
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: `linear-gradient(135deg, ${config.color}33 0%, ${config.color}11 100%)`,
            border: `1.5px solid ${config.color}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 900, color: config.color,
            letterSpacing: '-0.02em', fontFamily: 'var(--font-heading)',
          }}>
            {config.icon}
          </div>

          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: config.color, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
              Pick Estrella
            </h3>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Mercado: {config.label}
            </div>
          </div>

          {isEV && (
            <div style={{
              fontSize: '10px', fontWeight: 800, color: '#000',
              background: 'var(--accent-green)', padding: '3px 8px',
              borderRadius: '4px', marginLeft: 'auto', letterSpacing: '0.02em'
            }}>
              VALUE BET
            </div>
          )}
        </div>

        {/* Main prediction content */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
              {starPick.label}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Probabilidad Matematica: <span style={{ color: config.color, fontWeight: 700 }}>{starPick.probability}%</span>
            </div>
            <div style={{
              marginTop: '8px', height: '4px', borderRadius: '2px',
              background: 'rgba(255,255,255,0.06)', overflow: 'hidden', maxWidth: '240px'
            }}>
              <div style={{
                width: `${starPick.probability}%`, height: '100%',
                background: `linear-gradient(90deg, ${config.color} 0%, ${config.color}88 100%)`,
                borderRadius: '2px', transition: 'width 1s ease-out'
              }} />
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
              Cuota Justa
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: config.color }}>
              @{starPick.fairOdds}
            </div>
          </div>
        </div>

        <button
          onClick={handleSavePick}
          style={{
            marginTop: '16px', width: '100%', padding: '12px', borderRadius: '10px',
            background: `linear-gradient(90deg, ${config.color} 0%, ${config.color}99 100%)`,
            color: '#000', fontSize: '14px', fontWeight: 800, border: 'none',
            cursor: 'pointer', boxShadow: `0 4px 15px ${config.color}44`,
            transition: 'transform 0.2s ease',
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          + Guardar en el Boleto
        </button>
      </div>
    </div>
  );
}
