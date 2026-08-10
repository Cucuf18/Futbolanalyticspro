import React from 'react';

export default function LeagueSelector({ leagues, selectedLeague, onSelectLeague }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Competencia:</span>
      {leagues.map((league) => {
        const isSelected = selectedLeague === league.id;
        return (
          <button
            key={league.id}
            onClick={() => onSelectLeague(league.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: isSelected ? 700 : 500,
              whiteSpace: 'nowrap',
              background: isSelected ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.2) 0%, rgba(79, 172, 254, 0.2) 100%)' : 'rgba(15, 22, 41, 0.6)',
              color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              border: isSelected ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid var(--glass-border)',
              boxShadow: isSelected ? '0 4px 12px rgba(0, 242, 254, 0.15)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{league.country}</span>
            <span>{league.name}</span>
          </button>
        );
      })}
    </div>
  );
}
