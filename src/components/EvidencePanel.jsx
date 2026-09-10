import React from 'react';

/**
 * Panel de evidencia: de donde salen las conclusiones del modelo.
 *
 * Antes la pagina daba un porcentaje sin enseñar en que se apoyaba, y
 * cuando el motor no tenia datos no habia forma de saberlo desde fuera.
 * Aqui se muestran las tres fuentes nuevas: rating acumulado, historial
 * real de cada equipo y rivales en comun.
 */

function FormBadges({ form }) {
  if (!form || form.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>sin datos</span>;
  return (
    <span>
      {form.map((r, i) => (
        <span key={i} className={`badge-form ${r.toLowerCase()}`}>{r}</span>
      ))}
    </span>
  );
}

function TeamRow({ label, name, history, elo, eloMatches }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--glass-border)',
      borderRadius: '10px',
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 8px' }}>
        {name}
      </div>

      {elo != null && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--accent-cyan)' }}>{elo}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Elo · {eloMatches} partidos</span>
        </div>
      )}

      {history ? (
        <>
          <div style={{ marginBottom: '6px' }}><FormBadges form={history.forma} /></div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {history.partidos} partidos analizados · {history.descanso} dias de descanso
          </div>
          {history.competiciones && history.competiciones.length > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {history.competiciones.join(' · ')}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: '11px', color: 'var(--accent-red)', lineHeight: 1.5 }}>
          Sin historial descargable. El modelo lo trata como un equipo promedio.
        </div>
      )}
    </div>
  );
}

export default function EvidencePanel({ matchInfo, ratings, historySummary, commonOpponents }) {
  const hasAnything = ratings || historySummary?.home || historySummary?.away || commonOpponents;
  if (!hasAnything) return null;

  const homeName = matchInfo.homeTeam.shortName || matchInfo.homeTeam.name;
  const awayName = matchInfo.awayTeam.shortName || matchInfo.awayTeam.name;

  return (
    <div style={{ marginTop: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ color: 'var(--accent-cyan)' }}>🔍</span>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
          En que se basa el modelo
        </h3>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
        El rating se alimenta de todos los partidos que la pagina ha visto, en cualquier competicion
        y temporada. Por eso puede comparar equipos que no se han enfrentado nunca.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <TeamRow
          label="Local"
          name={matchInfo.homeTeam.name}
          history={historySummary?.home}
          elo={ratings?.home}
          eloMatches={ratings?.homeMatches}
        />
        <TeamRow
          label="Visitante"
          name={matchInfo.awayTeam.name}
          history={historySummary?.away}
          elo={ratings?.away}
          eloMatches={ratings?.awayMatches}
        />
      </div>

      {commonOpponents && commonOpponents.count > 0 && (
        <div style={{
          marginTop: '14px',
          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.06) 0%, rgba(157, 78, 221, 0.06) 100%)',
          border: '1px solid rgba(0, 242, 254, 0.25)',
          borderRadius: '12px',
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rivales en comun ({commonOpponents.count})
            </div>
            <div style={{
              fontSize: '11px', fontWeight: 800,
              color: commonOpponents.edge > 0 ? 'var(--accent-green)' : commonOpponents.edge < 0 ? 'var(--accent-red)' : 'var(--text-muted)',
            }}>
              Ventaja: {commonOpponents.edge > 0 ? homeName : awayName} {commonOpponents.edge > 0 ? '+' : ''}{commonOpponents.edge} goles
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
            Aunque no se hayan enfrentado, los dos jugaron contra estos equipos. Se compara como le fue
            a cada uno.
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', minWidth: '340px' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 6px', fontWeight: 700 }}>Rival comun</th>
                  <th style={{ padding: '4px 6px', fontWeight: 700 }}>{homeName}</th>
                  <th style={{ padding: '4px 6px', fontWeight: 700 }}>{awayName}</th>
                </tr>
              </thead>
              <tbody>
                {commonOpponents.opponents.map((o) => (
                  <tr key={o.opponentId} style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '6px', color: 'var(--text-primary)', fontWeight: 600 }}>{o.opponentName}</td>
                    <td style={{ padding: '6px', color: o.teamADiff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {o.teamAResults.join(', ')}
                    </td>
                    <td style={{ padding: '6px', color: o.teamBDiff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {o.teamBResults.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
