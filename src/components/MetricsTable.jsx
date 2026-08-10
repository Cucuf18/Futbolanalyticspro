import React from 'react';

export default function MetricsTable({ standings, homeTeamId, awayTeamId, onSelectHomeTeam, onSelectAwayTeam }) {
  if (!standings || !standings.teams) return null;

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '20px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Tabla de Posiciones — {standings.league?.name}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {standings.teams.length} equipos | Temporada {standings.league?.season} | Selecciona los equipos del enfrentamiento a analizar
          </p>
        </div>
        {standings.dataSource && (
          <span style={{
            fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            padding: '4px 10px', borderRadius: '8px',
            background: standings.dataSource === 'live' ? 'rgba(0,230,118,0.1)' : 'rgba(255,170,0,0.08)',
            color: standings.dataSource === 'live' ? 'var(--accent-green)' : 'var(--accent-gold)',
            border: `1px solid ${standings.dataSource === 'live' ? 'rgba(0,230,118,0.3)' : 'rgba(255,170,0,0.2)'}`,
          }}>
            {standings.dataSource === 'live' ? 'En Vivo' : 'Simulado'}
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 8px', width: '36px' }}>#</th>
              <th style={{ padding: '10px 8px' }}>Equipo</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>PJ</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>G/E/P</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>GF:GC</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>DG</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>xG</th>
              <th style={{ padding: '10px 8px' }}>Racha</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Pts</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Analizar</th>
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
                    transition: 'var(--transition-fast)',
                  }}
                >
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: team.position <= 4 ? 'var(--accent-cyan)' : 'var(--text-muted)', fontSize: '12px' }}>
                    {team.position}
                  </td>
                  
                  <td style={{ padding: '10px 8px', fontWeight: 600, fontSize: '13px' }}>
                    {team.crest && <img src={team.crest} alt="" style={{ width: '18px', height: '18px', marginRight: '8px', verticalAlign: 'middle', borderRadius: '2px' }} />}
                    <span style={{ verticalAlign: 'middle' }}>{team.name}</span>
                  </td>

                  <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>{team.played}</td>
                  
                  <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {team.won}/{team.drawn}/{team.lost}
                  </td>

                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <span style={{ color: 'var(--accent-green)' }}>{team.goalsFor}</span>:<span style={{ color: 'var(--accent-red)' }}>{team.goalsAgainst}</span>
                  </td>

                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: (team.goalDifference || team.goalsFor - team.goalsAgainst) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {(team.goalDifference || team.goalsFor - team.goalsAgainst) > 0 ? '+' : ''}{team.goalDifference || team.goalsFor - team.goalsAgainst}
                  </td>

                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--accent-purple)' }}>
                    {team.xG || '—'}
                  </td>

                  <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                    {team.form?.slice(0, 5).map((f, i) => (
                      <span key={i} className={`badge-form ${f.toLowerCase()}`}>{f}</span>
                    ))}
                  </td>

                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, fontSize: '14px', color: 'var(--accent-cyan)' }}>
                    {team.points}
                  </td>

                  <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
                      {isHome ? 'Local >' : 'Local'}
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
                      {isAway ? 'Visit. >' : 'Visit.'}
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
