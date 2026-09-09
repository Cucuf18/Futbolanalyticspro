import React, { useState } from 'react';
import { useBetSlip } from '../context/BetSlipContext';

const MARKET_CONFIG = {
  RESULTADO: { icon: '1X2', color: '#00f2fe', gradient: 'rgba(0, 242, 254, 0.15)', border: 'rgba(0, 242, 254, 0.4)', label: 'RESULTADO' },
  HANDICAP: { icon: 'AH', color: '#9d4edd', gradient: 'rgba(157, 78, 221, 0.15)', border: 'rgba(157, 78, 221, 0.4)', label: 'HANDICAP' },
  GOLES: { icon: 'GOL', color: '#00e676', gradient: 'rgba(0, 230, 118, 0.15)', border: 'rgba(0, 230, 118, 0.4)', label: 'GOLES' },
  TARJETAS: { icon: 'TAR', color: '#ffd600', gradient: 'rgba(255, 214, 0, 0.15)', border: 'rgba(255, 214, 0, 0.4)', label: 'TARJETAS' },
  TIROS: { icon: 'TIR', color: '#ff6d00', gradient: 'rgba(255, 109, 0, 0.15)', border: 'rgba(255, 109, 0, 0.4)', label: 'TIROS AL ARCO' },
  CORNERS: { icon: 'COR', color: '#448aff', gradient: 'rgba(68, 138, 255, 0.15)', border: 'rgba(68, 138, 255, 0.4)', label: 'CORNERS' },
  OFFSIDES: { icon: 'OFF', color: '#ff5252', gradient: 'rgba(255, 82, 82, 0.15)', border: 'rgba(255, 82, 82, 0.4)', label: 'FUERAS DE JUEGO' },
  FALTAS: { icon: 'FAL', color: '#ffb300', gradient: 'rgba(255, 179, 0, 0.15)', border: 'rgba(255, 179, 0, 0.4)', label: 'FALTAS' },
  BTTS: { icon: 'B2S', color: '#00e676', gradient: 'rgba(0, 230, 118, 0.15)', border: 'rgba(0, 230, 118, 0.4)', label: 'AMBOS ANOTAN' }
};

const RISK_CONFIG = {
  safe: { label: 'Seguros', color: 'var(--accent-green)', bg: 'rgba(0, 230, 118, 0.1)' },
  medium: { label: 'Medio Riesgo', color: 'var(--accent-gold)', bg: 'rgba(255, 170, 0, 0.1)' },
  risky: { label: 'Alto Riesgo', color: 'var(--accent-red)', bg: 'rgba(255, 82, 82, 0.1)' }
};

function PickCard({ pick, matchInfo, riskLevel }) {
  const { addToSlip } = useBetSlip();
  const marketType = pick.marketType || 'RESULTADO';
  const config = MARKET_CONFIG[marketType] || MARKET_CONFIG.RESULTADO;
  
  const handleSavePick = () => {
    addToSlip({
      matchId: `${matchInfo.homeTeam.id}-${matchInfo.awayTeam.id}-${pick.type}`,
      homeTeam: matchInfo.homeTeam.shortName,
      awayTeam: matchInfo.awayTeam.shortName,
      homeTeamFull: matchInfo.homeTeam.name,
      awayTeamFull: matchInfo.awayTeam.name,
      valueBetType: pick.label,
      probability: pick.probability,
      odds: pick.fairOdds,
      riskLevel: riskLevel
    });
  };

  return (
    <div style={{
      background: `linear-gradient(135deg, ${config.gradient} 0%, rgba(255, 255, 255, 0.02) 100%)`,
      border: `1px solid ${config.border}`,
      borderRadius: '12px', padding: '16px', marginBottom: '12px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: `linear-gradient(135deg, ${config.color}33 0%, ${config.color}11 100%)`,
          border: `1px solid ${config.color}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 900, color: config.color,
        }}>
          {config.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {pick.label}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {config.label}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 900, color: config.color }}>@{pick.fairOdds}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{pick.probability}% Prob</div>
        </div>
      </div>

      {pick.reasons && pick.reasons.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 12px',
          marginBottom: '12px', borderLeft: `2px solid ${config.color}`
        }}>
          {pick.reasons.map((r, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: i !== pick.reasons.length - 1 ? '4px' : 0, lineHeight: 1.4 }}>
              • {r}
            </div>
          ))}
        </div>
      )}

      <button onClick={handleSavePick} style={{
        width: '100%', padding: '10px', borderRadius: '8px',
        background: `linear-gradient(90deg, ${config.color} 0%, ${config.color}99 100%)`,
        color: '#000', fontSize: '13px', fontWeight: 800, border: 'none', cursor: 'pointer',
      }}>
        + Agregar al Boleto
      </button>
    </div>
  );
}

export default function MatchPicks({ matchPicks, matchInfo }) {
  if (!matchPicks) return null;

  const [activeTab, setActiveTab] = useState('safe');

  const tabs = [
    { id: 'safe', count: matchPicks.safe?.length || 0 },
    { id: 'medium', count: matchPicks.medium?.length || 0 },
    { id: 'risky', count: matchPicks.risky?.length || 0 }
  ];

  const currentPicks = matchPicks[activeTab] || [];

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px', background: 'var(--accent-cyan)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold'
        }}>
          !
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Picks del Partido
        </h3>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: '8px',
              background: activeTab === tab.id ? RISK_CONFIG[tab.id].bg : 'transparent',
              color: activeTab === tab.id ? RISK_CONFIG[tab.id].color : 'var(--text-muted)',
              fontSize: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
              border: activeTab === tab.id ? `1px solid ${RISK_CONFIG[tab.id].color}44` : '1px solid transparent'
            }}
          >
            {RISK_CONFIG[tab.id].label} ({tab.count})
          </button>
        ))}
      </div>

      <div>
        {currentPicks.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No hay picks disponibles en este nivel de riesgo.
          </div>
        ) : (
          currentPicks.map((pick, idx) => (
            <PickCard key={idx} pick={pick} matchInfo={matchInfo} riskLevel={activeTab.toUpperCase()} />
          ))
        )}
      </div>
    </div>
  );
}
