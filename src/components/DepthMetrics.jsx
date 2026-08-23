import React from 'react';

function MetricBar({ label, homeValue, awayValue, colorHome, colorAway }) {
  const total = homeValue + awayValue;
  const homePct = total === 0 ? 50 : (homeValue / total) * 100;
  const awayPct = total === 0 ? 50 : (awayValue / total) * 100;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <span style={{ fontWeight: 700, color: '#fff' }}>{homeValue}</span>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: '#fff' }}>{awayValue}</span>
      </div>
      <div style={{ display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.1)' }}>
        <div style={{ width: `${homePct}%`, background: colorHome, transition: 'width 0.5s ease' }} />
        <div style={{ width: `${awayPct}%`, background: colorAway, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function DepthMetrics({ homeTeam, awayTeam }) {
  return (
    <div className="glass-card" style={{ padding: '20px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--accent-cyan)' }}>📊</span> Métricas de Profundidad (Promedios)
      </h3>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', fontWeight: 600 }}>
        <div style={{ color: 'var(--accent-cyan)' }}>{homeTeam.shortName}</div>
        <div style={{ color: 'var(--accent-gold)' }}>{awayTeam.shortName}</div>
      </div>

      <MetricBar 
        label="Remates Totales" 
        homeValue={homeTeam.avgShots || 0} 
        awayValue={awayTeam.avgShots || 0}
        colorHome="var(--accent-cyan)"
        colorAway="var(--accent-gold)"
      />
      <MetricBar 
        label="Tiros a Puerta" 
        homeValue={homeTeam.avgSOT || 0} 
        awayValue={awayTeam.avgSOT || 0}
        colorHome="var(--accent-cyan)"
        colorAway="var(--accent-gold)"
      />
      <MetricBar 
        label="Faltas Cometidas" 
        homeValue={homeTeam.avgFouls || 0} 
        awayValue={awayTeam.avgFouls || 0}
        colorHome="var(--accent-red)"
        colorAway="var(--accent-red)"
      />
      
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
        *Datos calculados en base al xG y rendimiento de los últimos 5 partidos.
      </div>
    </div>
  );
}
