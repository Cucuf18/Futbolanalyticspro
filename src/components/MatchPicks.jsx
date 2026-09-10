import React, { useState } from 'react';
import { useBetSlip } from '../context/BetSlipContext';

const MARKET_CONFIG = {
  RESULTADO: { icon: '1X2', color: '#00f2fe', gradient: 'rgba(0, 242, 254, 0.15)', border: 'rgba(0, 242, 254, 0.4)', label: 'RESULTADO' },
  DOBLE: { icon: 'DC', color: '#26c6da', gradient: 'rgba(38, 198, 218, 0.15)', border: 'rgba(38, 198, 218, 0.4)', label: 'DOBLE OPORTUNIDAD' },
  HANDICAP: { icon: 'AH', color: '#9d4edd', gradient: 'rgba(157, 78, 221, 0.15)', border: 'rgba(157, 78, 221, 0.4)', label: 'HANDICAP' },
  GOLES: { icon: 'GOL', color: '#00e676', gradient: 'rgba(0, 230, 118, 0.15)', border: 'rgba(0, 230, 118, 0.4)', label: 'GOLES' },
  TARJETAS: { icon: 'TAR', color: '#ffd600', gradient: 'rgba(255, 214, 0, 0.15)', border: 'rgba(255, 214, 0, 0.4)', label: 'TARJETAS' },
  TIROS: { icon: 'TIR', color: '#ff6d00', gradient: 'rgba(255, 109, 0, 0.15)', border: 'rgba(255, 109, 0, 0.4)', label: 'TIROS / REMATES' },
  CORNERS: { icon: 'COR', color: '#448aff', gradient: 'rgba(68, 138, 255, 0.15)', border: 'rgba(68, 138, 255, 0.4)', label: 'CORNERS' },
  OFFSIDES: { icon: 'OFF', color: '#ff5252', gradient: 'rgba(255, 82, 82, 0.15)', border: 'rgba(255, 82, 82, 0.4)', label: 'FUERAS DE JUEGO' },
  FALTAS: { icon: 'FAL', color: '#ffb300', gradient: 'rgba(255, 179, 0, 0.15)', border: 'rgba(255, 179, 0, 0.4)', label: 'FALTAS' },
  BTTS: { icon: 'B2S', color: '#00e676', gradient: 'rgba(0, 230, 118, 0.15)', border: 'rgba(0, 230, 118, 0.4)', label: 'AMBOS ANOTAN' },
};

const RISK_CONFIG = {
  safe: { label: 'Seguros', color: 'var(--accent-green)', bg: 'rgba(0, 230, 118, 0.1)' },
  medium: { label: 'Medio Riesgo', color: 'var(--accent-gold)', bg: 'rgba(255, 170, 0, 0.1)' },
  risky: { label: 'Alto Riesgo', color: 'var(--accent-red)', bg: 'rgba(255, 82, 82, 0.1)' },
};

function PickCard({ pick, matchInfo, riskLevel }) {
  const { addToSlip } = useBetSlip();
  const [realOdds, setRealOdds] = useState('');
  const marketType = pick.marketType || 'RESULTADO';
  const config = MARKET_CONFIG[marketType] || MARKET_CONFIG.RESULTADO;

  const breakEven = pick.breakEvenOdds || pick.fairOdds;
  const parsedOdds = parseFloat(String(realOdds).replace(',', '.'));
  const hasTypedOdds = Number.isFinite(parsedOdds) && parsedOdds > 1;
  // Valor real = solo si la cuota que ofrece TU casa supera la cuota
  // minima que exige el modelo. Si no, la apuesta pierde a largo plazo
  // aunque acierte muchas veces.
  const valueEdge = hasTypedOdds ? ((parsedOdds / breakEven - 1) * 100) : null;

  const handleSavePick = () => {
    addToSlip({
      matchId: `${matchInfo.homeTeam.id}-${matchInfo.awayTeam.id}-${pick.type}`,
      homeTeam: matchInfo.homeTeam.shortName,
      awayTeam: matchInfo.awayTeam.shortName,
      homeTeamFull: matchInfo.homeTeam.name,
      awayTeamFull: matchInfo.awayTeam.name,
      valueBetType: pick.label,
      probability: pick.probability,
      odds: hasTypedOdds ? Number(parsedOdds.toFixed(2)) : pick.marketOdds,
      breakEvenOdds: breakEven,
      marketType,
      riskLevel,
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
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: `linear-gradient(135deg, ${config.color}33 0%, ${config.color}11 100%)`,
          border: `1px solid ${config.color}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 900, color: config.color,
        }}>
          {config.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>
            {pick.label}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {config.label}
            {typeof pick.expectedMean === 'number' && ` · media esperada ${pick.expectedMean}`}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: config.color }}>{pick.probability}%</div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>probabilidad</div>
        </div>
      </div>

      {/* Bloque de cuotas: lo que paga la casa vs lo minimo que exige el modelo */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px',
      }}>
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '8px 10px' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cuota estimada
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>@{pick.marketOdds}</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '8px 10px' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cuota minima
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-gold)' }}>@{breakEven}</div>
        </div>
      </div>

      {/* Comprobador de valor real */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <input
          type="text"
          inputMode="decimal"
          value={realOdds}
          onChange={(e) => setRealOdds(e.target.value)}
          placeholder="Cuota real de tu casa"
          style={{
            flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--glass-border)', borderRadius: '8px',
            padding: '8px 10px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
          }}
        />
        {hasTypedOdds && (
          <span style={{
            padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap',
            background: valueEdge > 0 ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)',
            color: valueEdge > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            border: `1px solid ${valueEdge > 0 ? 'rgba(0,230,118,0.4)' : 'rgba(255,82,82,0.4)'}`,
          }}>
            {valueEdge > 0 ? `VALOR +${valueEdge.toFixed(1)}%` : `SIN VALOR ${valueEdge.toFixed(1)}%`}
          </span>
        )}
      </div>

      {pick.reasons && pick.reasons.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 12px',
          marginBottom: '12px', borderLeft: `2px solid ${config.color}`,
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

export default function MatchPicks({ matchPicks, matchInfo, dataQuality, leagueTendencies }) {
  const [activeTab, setActiveTab] = useState('safe');

  if (!matchPicks) return null;

  const tabs = [
    { id: 'safe', count: matchPicks.safe?.length || 0 },
    { id: 'medium', count: matchPicks.medium?.length || 0 },
    { id: 'risky', count: matchPicks.risky?.length || 0 },
  ];

  const currentPicks = matchPicks[activeTab] || [];

  // Aviso de correlacion: dos picks del mismo grupo suben y bajan juntos,
  // asi que combinarlos multiplica el riesgo en vez de repartirlo.
  const groups = currentPicks.map((p) => p.correlationGroup || p.marketType);
  const hasCorrelation = new Set(groups).size < groups.length;

  const lowData = typeof dataQuality === 'number' && dataQuality < 0.45;

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px', background: 'var(--accent-cyan)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold',
        }}>
          !
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Picks del Partido
        </h3>
        {typeof dataQuality === 'number' && (
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
            background: lowData ? 'rgba(255,82,82,0.12)' : 'rgba(0,230,118,0.12)',
            color: lowData ? 'var(--accent-red)' : 'var(--accent-green)',
            border: `1px solid ${lowData ? 'rgba(255,82,82,0.35)' : 'rgba(0,230,118,0.35)'}`,
          }}>
            CALIDAD DE DATOS {Math.round(dataQuality * 100)}%
          </span>
        )}
      </div>

      {leagueTendencies && leagueTendencies.length > 0 && (
        <div style={{
          background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)',
          borderRadius: '10px', padding: '10px 12px', marginBottom: '14px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Tendencias fijas de esta liga
          </div>
          {leagueTendencies.map((t, i) => (
            <div key={i} style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{t.market}:</strong> {t.note}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: '8px',
              background: activeTab === tab.id ? RISK_CONFIG[tab.id].bg : 'transparent',
              color: activeTab === tab.id ? RISK_CONFIG[tab.id].color : 'var(--text-muted)',
              fontSize: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
              border: activeTab === tab.id ? `1px solid ${RISK_CONFIG[tab.id].color}44` : '1px solid transparent',
            }}
          >
            {RISK_CONFIG[tab.id].label} ({tab.count})
          </button>
        ))}
      </div>

      {hasCorrelation && (
        <div style={{
          background: 'rgba(255, 170, 0, 0.08)', border: '1px solid rgba(255, 170, 0, 0.3)',
          borderRadius: '10px', padding: '10px 12px', marginBottom: '12px',
          fontSize: '11.5px', color: 'var(--accent-gold)', lineHeight: 1.45,
        }}>
          Hay picks correlacionados en esta lista (dependen del mismo suceso del partido).
          Combinarlos en el mismo boleto no reparte el riesgo: si falla uno, es probable que fallen los dos.
        </div>
      )}

      <div>
        {currentPicks.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No hay picks disponibles en este nivel de riesgo.
          </div>
        ) : (
          currentPicks.map((pick, idx) => (
            <PickCard key={pick.type || idx} pick={pick} matchInfo={matchInfo} riskLevel={activeTab.toUpperCase()} />
          ))
        )}
      </div>
    </div>
  );
}
