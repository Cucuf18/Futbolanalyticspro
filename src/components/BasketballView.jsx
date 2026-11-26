import React, { useEffect, useState } from 'react';

const pct = (v) => (typeof v === 'number' ? `${(v * 100).toFixed(0)}%` : '—');

function ProbBar({ label, value, color }) {
  const w = typeof value === 'number' ? Math.round(value * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 40px', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ height: '8px', borderRadius: '99px', background: 'rgba(var(--ov), 0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: '99px' }} />
      </div>
      <span className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{pct(value)}</span>
    </div>
  );
}

function GameCard({ g }) {
  const m = g.model;
  const mk = g.market;
  const when = new Date(g.date);
  const live = g.state === 'in';
  const final = g.state === 'post';
  const diff = m && mk?.homeProb != null ? m.homeProb - mk.homeProb : null;
  return (
    <div className="glass-card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '17px', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            {g.away.name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>@</span> {g.home.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {g.away.record && `${g.away.abbr} ${g.away.record}`} {g.home.record && `· ${g.home.abbr} ${g.home.record}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {final || live ? (
            <div className="num" style={{ fontSize: '20px', fontWeight: 800, color: live ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
              {g.away.score} – {g.home.score}
            </div>
          ) : (
            <div className="num" style={{ fontSize: '15px', fontWeight: 700 }}>
              {when.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <div style={{ fontSize: '11px', color: live ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
            {final ? 'Final' : live ? `En juego · ${g.detail}` : when.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </div>
      </div>

      {m ? (
        <div style={{ marginTop: '14px', display: 'grid', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Probabilidad de que gane {g.home.abbr} (local)
          </div>
          <ProbBar label="Modelo" value={m.homeProb} color="var(--accent-blue)" />
          {mk?.homeProb != null ? (
            <ProbBar label="Mercado" value={mk.homeProb} color="var(--accent-gold)" />
          ) : (
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Sin cuota de mercado publicada todavía.</div>
          )}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <span>Margen esperado: <strong className="num">{m.expMargin > 0 ? g.home.abbr : g.away.abbr} por {Math.abs(m.expMargin).toFixed(1)}</strong></span>
            <span>Total esperado: <strong className="num">{m.expTotal.toFixed(1)}</strong>{mk?.overUnder ? <> (línea {mk.overUnder})</> : null}</span>
            {mk?.line && <span>Línea: <strong>{mk.line}</strong></span>}
          </div>
          {diff !== null && Math.abs(diff) >= 0.05 && (
            <div style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(245,184,61,0.08)', border: '1px solid rgba(245,184,61,0.25)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              El modelo difiere del mercado en {Math.abs(diff * 100).toFixed(0)} puntos. En el fútbol, estas discrepancias
              resultaron ser <strong>error del modelo</strong> y no información nueva; aquí todavía no hay datos para saberlo.
            </div>
          )}
          {m.limitedData && (
            <div style={{ fontSize: '11.5px', color: 'var(--accent-red)' }}>Datos limitados: pocos partidos jugados esta temporada.</div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Sin datos suficientes de estos equipos.</div>
      )}
    </div>
  );
}

function Report({ r }) {
  if (!r) return null;
  const cell = (label, value, hint) => (
    <div style={{ background: 'rgba(var(--ov), 0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div className="num" style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{value}</div>
      {hint && <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{hint}</div>}
    </div>
  );
  const better = r.brierModeloEnConMercado != null && r.brierMercado != null
    ? (r.brierModeloEnConMercado < r.brierMercado ? 'modelo' : 'mercado')
    : null;
  return (
    <div className="glass-card" style={{ padding: '22px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '17px', fontWeight: 800 }}>¿Acierta este modelo? Medición contra el mercado</h3>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '6px 0 14px', lineHeight: 1.55 }}>
        Cada partido se registra antes de empezar y se resuelve solo con el marcador final. Así se mide, con partidos reales, si el
        modelo sabe algo que la línea de las casas no sabe.
      </p>
      {r.partidos === 0 ? (
        <div style={{ padding: '14px', borderRadius: '10px', border: '1px dashed var(--glass-border)', fontSize: '13px', color: 'var(--text-muted)' }}>
          Todavía no hay partidos medidos ({r.pendientes} esperando a jugarse). Esta tabla se llena sola.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {cell('Partidos medidos', r.partidos, `${r.conMercado} con cuota de mercado`)}
            {cell('Acierto del favorito', r.aciertoFavorito === null ? '—' : `${r.aciertoFavorito}%`, r.ic95 ? `IC95 ${r.ic95[0]}–${r.ic95[1]}%` : null)}
            {cell('Error modelo (Brier)', r.brierModeloEnConMercado ?? r.brierModelo ?? '—', 'menor = mejor')}
            {cell('Error mercado (Brier)', r.brierMercado ?? '—', better ? `mejor: ${better}` : 'sin cuotas aún')}
            {cell('Yield simulado', r.yieldSimulado === null ? '—' : `${r.yieldSimulado > 0 ? '+' : ''}${r.yieldSimulado}%`, `${r.apuestasConVentaja} apuestas con ventaja`)}
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Fiabilidad de la medición: {r.confianza}.</strong> {r.nota}
          </div>
        </>
      )}
    </div>
  );
}

function FinishedList({ list }) {
  if (list.length === 0) return null;
  return (
    <section style={{ marginBottom: '26px' }}>
      <h3 className="eyebrow">Resultados recientes</h3>
      <div className="glass-card" style={{ padding: '4px 18px' }}>
        {list.map((g, i) => {
          const homeWon = g.home.score > g.away.score;
          return (
            <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center', padding: '12px 0', borderTop: i ? '1px solid var(--glass-border)' : 'none' }}>
              <div style={{ fontSize: '14px' }}>
                <span style={{ fontWeight: homeWon ? 500 : 800 }}>{g.away.name}</span>
                <span style={{ color: 'var(--text-muted)' }}> @ </span>
                <span style={{ fontWeight: homeWon ? 800 : 500 }}>{g.home.name}</span>
              </div>
              <div className="num" style={{ fontWeight: 700, fontSize: '14px' }}>{g.away.score} – {g.home.score}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function BasketballView() {
  const [games, setGames] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/basketball/games?days=3')
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (!ok || d.success === false) setError(d.error || 'No se pudo cargar.');
        else setGames(d.games);
      })
      .catch(() => alive && setError('No se pudo conectar con el servidor.'));
    fetch('/api/basketball/report').then((r) => r.json()).then((d) => alive && setReport(d.report)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const live = (games || []).filter((g) => g.state === 'in');
  const upcoming = (games || []).filter((g) => g.state === 'pre');
  const finished = (games || []).filter((g) => g.state === 'post').sort((a, b) => new Date(b.date) - new Date(a.date));

  const byDay = {};
  for (const g of upcoming) {
    const k = new Date(g.date).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    (byDay[k] = byDay[k] || []).push(g);
  }
  const grid = { display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))' };

  return (
    <div className="animate-fade-in">
      <header className="page-head">
        <div className="eyebrow" style={{ margin: 0 }}>Baloncesto</div>
        <h1>NBA</h1>
        <p>Próximos partidos con la línea del mercado y un modelo simple al lado, para compararlos.</p>
      </header>

      <div className="notice" style={{ marginBottom: '26px' }}>
        <strong>Esto no es una recomendación de apuesta.</strong> El modelo usa solo puntos a favor y en contra (no conoce lesiones, descanso ni
        viajes) y no hay evidencia de que mejore la línea de las casas. En fútbol, un modelo parecido perdió frente al mercado: aquí se está
        midiendo, y abajo verás el resultado real. Datos de ESPN (fuente no oficial, puede fallar).
      </div>

      {error && <div className="glass-card" style={{ padding: '20px', color: 'var(--accent-red)', fontSize: '14px' }}>{error}</div>}
      {!error && games === null && <div style={{ color: 'var(--text-muted)' }}>Cargando partidos...</div>}

      {live.length > 0 && (
        <section style={{ marginBottom: '26px' }}>
          <h3 className="eyebrow">En juego</h3>
          <div style={grid}>{live.map((g) => <GameCard key={g.id} g={g} />)}</div>
        </section>
      )}

      {games && upcoming.length === 0 && (
        <div className="glass-card" style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '26px' }}>
          No hay partidos programados en los próximos días.
        </div>
      )}
      {Object.entries(byDay).map(([day, list]) => (
        <section key={day} style={{ marginBottom: '26px' }}>
          <h3 className="eyebrow" style={{ textTransform: 'capitalize' }}>{day}</h3>
          <div style={grid}>{list.map((g) => <GameCard key={g.id} g={g} />)}</div>
        </section>
      ))}

      <FinishedList list={finished} />
      <Report r={report} />
    </div>
  );
}
