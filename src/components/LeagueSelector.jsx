import React from 'react';

export default function LeagueSelector({ leagues, selectedLeague, onSelectLeague }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Liga:</span>
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
              background: isSelected ? 'linear-gradient(135deg, rgba(108, 196, 240, 0.2) 0%, rgba(110, 155, 245, 0.2) 100%)' : 'rgba(var(--panel), 0.6)',
              color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              border: isSelected ? '1px solid rgba(108, 196, 240, 0.4)' : '1px solid var(--glass-border)',
              boxShadow: isSelected ? '0 4px 12px rgba(108, 196, 240, 0.15)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{league.code}</span>
            <span>{league.name}</span>
          </button>
        );
      })}
    </div>
  );
}
