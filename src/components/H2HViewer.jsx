import React from 'react';

export default function H2HViewer({ h2hData }) {
  if (!h2hData || !h2hData.summary) return null;

  const { homeTeam, awayTeam, summary, matches } = h2hData;

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '20px' }}>
      
      {/* Title */}
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⚔️</span> Historial Directo (H2H): {homeTeam.shortName} vs {awayTeam.shortName}
      </h2>

      {/* Matchup Header Card */}
      <div style={{
        background: 'rgba(15, 22, 41, 0.8)',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid var(--glass-border)',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          
          {/* Home Team */}
          <div>
            <div style={{ fontSize: '28px' }}>{homeTeam.logo}</div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{homeTeam.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
              {summary.homeWins} victorias ({summary.homeWinPct}%)
            </div>
          </div>

          {/* vs Stats */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Partidos</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{summary.totalMatches}</div>
            <div style={{ fontSize: '12px', color: 'var(--accent-gold)', fontWeight: 600 }}>{summary.draws} empates ({summary.drawPct}%)</div>
          </div>

          {/* Away Team */}
          <div>
            <div style={{ fontSize: '28px' }}>{awayTeam.logo}</div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{awayTeam.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600 }}>
              {summary.awayWins} victorias ({summary.awayWinPct}%)
            </div>
          </div>

        </div>

        {/* Distribution Progress Bar */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ width: `${summary.homeWinPct}%`, background: 'var(--accent-cyan)' }} title={`Victoria Local: ${summary.homeWinPct}%`} />
            <div style={{ width: `${summary.drawPct}%`, background: 'var(--accent-gold)' }} title={`Empate: ${summary.drawPct}%`} />
            <div style={{ width: `${summary.awayWinPct}%`, background: 'var(--accent-red)' }} title={`Victoria Visitante: ${summary.awayWinPct}%`} />
          </div>
        </div>

      </div>

      {/* Historical Matches List */}
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Últimos Enfrentamientos Directos
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {matches.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(15, 22, 41, 0.5)',
              border: '1px solid rgba(255,255,255,0.04)',
              fontSize: '13px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '85px' }}>{m.date}</span>
            <div style={{ fontWeight: 600, flex: 1, textAlign: 'center' }}>
              <span style={{ color: m.winner === homeTeam.name ? 'var(--accent-cyan)' : 'inherit' }}>{homeTeam.shortName}</span>
              <span style={{
                margin: '0 10px',
                padding: '2px 10px',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.4)',
                fontWeight: 800,
                color: 'var(--accent-gold)'
              }}>
                {m.homeScore} - {m.awayScore}
              </span>
              <span style={{ color: m.winner === awayTeam.name ? 'var(--accent-red)' : 'inherit' }}>{awayTeam.shortName}</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '100px', textAlign: 'right' }}>
              {m.winner === 'Empate' ? '🤝 Empate' : `🏆 ${m.winner}`}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
