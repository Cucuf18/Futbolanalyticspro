import React from 'react';

export default function MetricsTable({ standings, homeTeamId, awayTeamId, onSelectHomeTeam, onSelectAwayTeam }) {
  if (!standings || !standings.teams) return null;

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '20px' }}>
      
      {/* Header & Quick Selector info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏆</span> Tabla de Posiciones & Rendimiento ({standings.league?.name})
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Haz clic en los botones para seleccionar los equipos del enfrentamiento a analizar.
          </p>
        </div>
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 8px', width: '36px' }}>Pos</th>
              <th style={{ padding: '10px 8px' }}>Equipo</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>PJ</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>G/E/P</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Goles</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>xG Avg</th>
              <th style={{ padding: '10px 8px' }}>Racha</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Pts</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Selección Partido</th>
            </tr>
          </thead>
          <tbody>
            {standings.teams.map((team) => {
              const isHome = homeTeamId === team.id;
              const isAway = awayTeamId === team.id;

              return (
                <tr
                  key={team.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: isHome ? 'rgba(0, 242, 254, 0.08)' : isAway ? 'rgba(255, 61, 113, 0.08)' : 'transparent',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: team.position <= 4 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                    {team.position}
                  </td>
                  
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                    <span style={{ marginRight: '8px', fontSize: '16px' }}>{team.logo}</span>
                    {team.name}
                  </td>

                  <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>{team.played}</td>
                  
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {team.won}/{team.drawn}/{team.lost}
                  </td>

                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <span style={{ color: 'var(--accent-green)' }}>{team.goalsFor}</span>:<span style={{ color: 'var(--accent-red)' }}>{team.goalsAgainst}</span>
                  </td>

                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--accent-purple)' }}>
                    {team.xG || '1.85'}
                  </td>

                  <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                    {team.form?.map((f, i) => (
                      <span key={i} className={`badge-form ${f.toLowerCase()}`}>{f}</span>
                    ))}
                  </td>

                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, fontSize: '14px', color: 'var(--accent-cyan)' }}>
                    {team.points}
                  </td>

                  <td style={{ padding: '12px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => onSelectHomeTeam(team.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        marginRight: '4px',
                        background: isHome ? 'var(--accent-cyan)' : 'rgba(0, 242, 254, 0.15)',
                        color: isHome ? '#080c16' : 'var(--accent-cyan)',
                        border: '1px solid rgba(0, 242, 254, 0.3)',
                      }}
                    >
                      {isHome ? '🏠 Local' : 'Local'}
                    </button>

                    <button
                      onClick={() => onSelectAwayTeam(team.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: isAway ? 'var(--accent-red)' : 'rgba(255, 61, 113, 0.15)',
                        color: isAway ? '#fff' : 'var(--accent-red)',
                        border: '1px solid rgba(255, 61, 113, 0.3)',
                      }}
                    >
                      {isAway ? '✈️ Visitante' : 'Visitante'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
