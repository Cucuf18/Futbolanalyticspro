import React from 'react';

function MetricBar({ label, homeValue, awayValue, homeSeason, awaySeason, colorHome, colorAway }) {
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
      {(homeSeason != null || awaySeason != null) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
          <span>temporada {homeSeason ?? '-'}</span>
          <span>temporada {awaySeason ?? '-'}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Muestra lo que se espera EN ESTE CRUCE (barra principal) junto al
 * promedio de temporada de cada equipo (linea inferior).
 *
 * Antes solo se veia el promedio de temporada, que no coincidia con las
 * lineas de los picks y daba la impresion de que el motor se contradecia.
 */
export default function DepthMetrics({ homeTeam, awayTeam, expectedByTeam }) {
  const eh = expectedByTeam?.home;
  const ea = expectedByTeam?.away;

  const val = (expected, fallback) => (typeof expected === 'number' ? expected : (fallback || 0));

  return (
    <div className="glass-card" style={{ padding: '20px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--accent-cyan)' }}>📊</span> Metricas esperadas en este partido
      </h3>
      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Barra: proyeccion para este cruce. Debajo: promedio de temporada de cada equipo.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', fontWeight: 600 }}>
        <div style={{ color: 'var(--accent-cyan)' }}>{homeTeam.shortName}</div>
        <div style={{ color: 'var(--accent-gold)' }}>{awayTeam.shortName}</div>
      </div>

      <MetricBar
        label="Remates Totales"
        homeValue={val(eh?.shots, homeTeam.avgShots)}
        awayValue={val(ea?.shots, awayTeam.avgShots)}
        homeSeason={homeTeam.avgShots}
        awaySeason={awayTeam.avgShots}
        colorHome="var(--accent-cyan)"
        colorAway="var(--accent-gold)"
      />
      <MetricBar
        label="Tiros a Puerta"
        homeValue={val(eh?.shotsOnTarget, homeTeam.avgSOT)}
        awayValue={val(ea?.shotsOnTarget, awayTeam.avgSOT)}
        homeSeason={homeTeam.avgSOT}
        awaySeason={awayTeam.avgSOT}
        colorHome="var(--accent-cyan)"
        colorAway="var(--accent-gold)"
      />
      <MetricBar
        label="Corners"
        homeValue={val(eh?.corners, 0)}
        awayValue={val(ea?.corners, 0)}
        colorHome="#448aff"
        colorAway="#448aff"
      />
      <MetricBar
        label="Faltas Cometidas"
        homeValue={val(eh?.fouls, homeTeam.avgFouls)}
        awayValue={val(ea?.fouls, awayTeam.avgFouls)}
        homeSeason={homeTeam.avgFouls}
        awaySeason={awayTeam.avgFouls}
        colorHome="var(--accent-red)"
        colorAway="var(--accent-red)"
      />
      <MetricBar
        label="Tarjetas Amarillas"
        homeValue={val(eh?.cards, 0)}
        awayValue={val(ea?.cards, 0)}
        colorHome="#ffd600"
        colorAway="#ffd600"
      />

      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
        *Proyeccion cruzando el rendimiento de ambos equipos con la base estadistica de la liga.
      </div>
    </div>
  );
}
