import React, { useEffect, useState } from 'react';

const COMPS = [
  { id: 'el', name: 'Europa League' },
  { id: 'uecl', name: 'Conference League' },
];
const ZONE = {
  directo: { color: 'var(--accent-green)', label: 'Octavos directos (1–8)' },
  playoff: { color: 'var(--accent-gold)', label: 'Eliminatoria previa (9–24)' },
  fuera: { color: 'var(--accent-red)', label: 'Eliminados (25–36)' },
};
const pct = (v) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '—');

function Bar({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '78px 1fr 38px', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: '7px', borderRadius: '99px', background: 'rgba(var(--ov), 0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round((value || 0) * 100)}%`, height: '100%', background: 'var(--accent-gold)', borderRadius: '99px' }} />
      </div>
      <span className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{pct(value)}</span>
    </div>
  );
}

function MatchCard({ m }) {
  const when = new Date(m.date);
  const live = m.state === 'in';
  const p = m.market?.probs;
  return (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '16px', lineHeight: 1.25 }}>
          {m.home.name}
          <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '12px', margin: '1px 0' }}>vs</div>
          {m.away.name}
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          {live ? (
            <div className="num" style={{ fontSize: '19px', fontWeight: 800, color: 'var(--accent-gold)' }}>{m.home.score} – {m.away.score}</div>
          ) : (
            <div className="num" style={{ fontSize: '15px', fontWeight: 700 }}>{when.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
          )}
          <div style={{ fontSize: '11px', color: live ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
            {live ? `En juego · ${m.detail}` : when.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </div>
      </div>
      <div style={{ marginTop: '12px', display: 'grid', gap: '5px' }}>
        {p ? (
          <>
            <div className="eyebrow" style={{ margin: 0 }}>Probabilidad según el mercado</div>
            <Bar label={m.home.abbr || 'Local'} value={p.home} />
            <Bar label="Empate" value={p.draw} />
            <Bar label={m.away.abbr || 'Visita'} value={p.away} />
            {m.market.overUnder ? <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Línea de goles: {m.market.overUnder}</div> : null}
          </>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sin cuota de mercado publicada todavía.</div>
        )}
      </div>
    </div>
  );
}

function Standings({ rows, error }) {
  if (error && rows.length === 0) {
    return <div className="glass-card" style={{ padding: '18px', color: 'var(--text-muted)', fontSize: '13.5px' }}>No se pudo leer la tabla ahora mismo ({error}).</div>;
  }
  if (rows.length === 0) return null;
  const th = { textAlign: 'right', padding: '8px 8px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const td = { textAlign: 'right', padding: '8px', fontSize: '13px' };
  return (
    <div className="glass-card" style={{ padding: '6px 6px 14px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
        <thead>
          <tr><th style={{ ...th, textAlign: 'left', paddingLeft: '16px' }}>#</th><th style={{ ...th, textAlign: 'left' }}>Equipo</th>
            <th style={th}>PJ</th><th style={th}>G</th><th style={th}>E</th><th style={th}>P</th><th style={th}>GF</th><th style={th}>GC</th><th style={th}>DG</th><th style={{ ...th, paddingRight: '16px' }}>Pts</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team.id} style={{ borderTop: '1px solid var(--glass-border)' }}>
              <td style={{ ...td, textAlign: 'left', paddingLeft: '12px', borderLeft: `4px solid ${ZONE[r.zone].color}` }} className="num">{r.rank}</td>
              <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{r.team.name}</td>
              <td style={td} className="num">{r.gp}</td><td style={td} className="num">{r.w}</td><td style={td} className="num">{r.d}</td><td style={td} className="num">{r.l}</td>
              <td style={td} className="num">{r.gf}</td><td style={td} className="num">{r.ga}</td>
              <td style={td} className="num">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td style={{ ...td, paddingRight: '16px', fontWeight: 800 }} className="num">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '12px 16px 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
        {Object.values(ZONE).map((z) => (
          <span key={z.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: z.color }} /> {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function EuroCupsView() {
  const [comp, setComp] = useState('el');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetch(`/api/euro/${comp}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (!ok || d.success === false) setError(d.error || 'No se pudo cargar.');
        else setData(d);
      })
      .catch(() => alive && setError('No se pudo conectar con el servidor.'));
    return () => { alive = false; };
  }, [comp]);

  const name = COMPS.find((c) => c.id === comp).name;
  const grid = { display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' };

  return (
    <div className="animate-fade-in">
      <header className="page-head">
        <div className="eyebrow" style={{ margin: 0 }}>Fútbol · Copas de Europa</div>
        <h1>{name}</h1>
        <p>Tabla de la fase de liga, próximos partidos y lo que dice el mercado.</p>
      </header>

      <div role="tablist" aria-label="Competición" style={{ display: 'inline-flex', gap: '4px', padding: '4px', borderRadius: '12px', background: 'rgba(var(--ov), 0.07)', marginBottom: '18px' }}>
        {COMPS.map((c) => (
          <button
            key={c.id} role="tab" aria-selected={comp === c.id} onClick={() => setComp(c.id)}
            style={{
              padding: '8px 16px', borderRadius: '9px', fontSize: '14px', fontWeight: 600,
              background: comp === c.id ? 'var(--bg-card)' : 'transparent',
              color: comp === c.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: comp === c.id ? 'var(--shadow-card)' : 'none',
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="notice" style={{ marginBottom: '24px' }}>
        <strong>Aquí no hay predicción propia.</strong> En la fase de liga cada equipo juega apenas 6 u 8 partidos, muy pocos para estimar nada con seriedad, y
        en las ligas locales nuestro modelo perdió frente al mercado. Por eso se muestra la tabla y la probabilidad que implican las cuotas, cuando se publican.
        Datos de ESPN (fuente no oficial, puede fallar).
      </div>

      {error && <div className="glass-card" style={{ padding: '20px', color: 'var(--accent-red)', fontSize: '14px' }}>{error}</div>}
      {!error && !data && <div style={{ color: 'var(--text-muted)' }}>Cargando...</div>}

      {data && (
        <>
          <section style={{ marginBottom: '28px' }}>
            <h3 className="eyebrow">Próximos partidos</h3>
            {data.matchesError && data.upcoming.length === 0 ? (
              <div className="glass-card" style={{ padding: '18px', color: 'var(--text-muted)', fontSize: '13.5px' }}>No se pudieron leer los partidos ahora mismo ({data.matchesError}).</div>
            ) : data.upcoming.length === 0 ? (
              <div className="glass-card" style={{ padding: '18px', color: 'var(--text-muted)', fontSize: '13.5px' }}>No hay partidos programados en los próximos días.</div>
            ) : (
              <div style={grid}>{data.upcoming.map((m) => <MatchCard key={m.id} m={m} />)}</div>
            )}
          </section>

          {data.recent.length > 0 && (
            <section style={{ marginBottom: '28px' }}>
              <h3 className="eyebrow">Resultados recientes</h3>
              <div className="glass-card" style={{ padding: '4px 18px' }}>
                {data.recent.map((g, i) => (
                  <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', padding: '11px 0', borderTop: i ? '1px solid var(--glass-border)' : 'none', fontSize: '14px' }}>
                    <span>{g.home.name} <span style={{ color: 'var(--text-muted)' }}>vs</span> {g.away.name}</span>
                    <span className="num" style={{ fontWeight: 700 }}>{g.home.score} – {g.away.score}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="eyebrow">Fase de liga</h3>
            <Standings rows={data.standings} error={data.standingsError} />
          </section>
        </>
      )}
    </div>
  );
}
