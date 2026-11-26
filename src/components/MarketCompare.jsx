import React, { useEffect, useState } from 'react';

const pct = (v) => (typeof v === 'number' ? `${(v * 100).toFixed(0)}%` : '—');

function Row({ label, model, market }) {
  const diff = typeof model === 'number' && typeof market === 'number' ? model - market : null;
  const big = diff !== null && Math.abs(diff) >= 0.05;
  const bar = (v, color) => (
    <div style={{ height: '7px', borderRadius: '99px', background: 'rgba(var(--ov), 0.08)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.round((v || 0) * 100)}%`, height: '100%', background: color, borderRadius: '99px' }} />
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr 1fr 64px', gap: '12px', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--glass-border)' }}>
      <span style={{ fontSize: '13px', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'grid', gap: '3px' }}>
        {bar(model, 'var(--accent-blue)')}
        <span className="num" style={{ fontSize: '12px' }}>{pct(model)}</span>
      </div>
      <div style={{ display: 'grid', gap: '3px' }}>
        {bar(market, 'var(--accent-gold)')}
        <span className="num" style={{ fontSize: '12px' }}>{pct(market)}</span>
      </div>
      <span className="num" style={{ fontSize: '12px', fontWeight: 700, textAlign: 'right', color: big ? 'var(--accent-red)' : 'var(--text-muted)' }}>
        {diff === null ? '' : `${diff > 0 ? '+' : ''}${(diff * 100).toFixed(0)} pts`}
      </span>
    </div>
  );
}

/**
 * Mercado vs Modelo. El mercado va primero: sus cuotas reales son la
 * referencia; el modelo es contexto. Una discrepancia grande se marca con
 * cautela, porque en las pruebas historicas solian ser error del modelo.
 */
export default function MarketCompare({ matchInfo, probabilities, probabilitiesSecondary }) {
  const [state, setState] = useState({ status: 'loading' });
  const leagueId = matchInfo?.league?.id;
  const home = matchInfo?.homeTeam?.name;
  const away = matchInfo?.awayTeam?.name;

  useEffect(() => {
    if (!leagueId || !home || !away) return undefined;
    let alive = true;
    setState({ status: 'loading' });
    fetch(`/api/market?league=${encodeURIComponent(leagueId)}&home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.success && d.found) setState({ status: 'ok', market: d.market });
        else setState({ status: 'none', reason: d.reason });
      })
      .catch(() => alive && setState({ status: 'error' }));
    return () => { alive = false; };
  }, [leagueId, home, away]);

  const card = { marginBottom: '24px', padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'rgba(var(--panel), 0.7)', border: '1px solid var(--glass-border)' };
  const title = <div className="eyebrow" style={{ marginBottom: '8px' }}>Mercado vs modelo</div>;

  if (state.status === 'loading') return <div style={{ ...card, color: 'var(--text-muted)', fontSize: '13px' }}>{title}Buscando las cuotas reales de este partido...</div>;
  if (state.status !== 'ok') {
    const msg = state.reason === 'liga-sin-cuotas'
      ? 'Esta liga no tiene cuotas en la fuente gratuita.'
      : state.status === 'error'
        ? 'No se pudieron consultar las cuotas ahora mismo.'
        : 'No hay cuotas publicadas para este partido todavía (la fuente solo trae los partidos de la semana).';
    return <div style={{ ...card, color: 'var(--text-muted)', fontSize: '13px' }}>{title}{msg}</div>;
  }

  const m = state.market;
  const mp = m.probs;
  const model = { home: (probabilities?.homeWin ?? NaN) / 100, draw: (probabilities?.draw ?? NaN) / 100, away: (probabilities?.awayWin ?? NaN) / 100 };
  const over = (probabilitiesSecondary?.over25 ?? NaN) / 100;
  const big = mp && ['home', 'draw', 'away'].some((k) => Math.abs(model[k] - mp[k]) >= 0.05);

  return (
    <div style={card}>
      {title}
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {m.kickoff.date} {m.kickoff.time} ({m.kickoff.zone}){m.referee ? ` · Árbitro: ${m.referee}` : ''} · Referencia: {m.reference}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr 1fr 64px', gap: '12px', fontSize: '10.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 0' }}>
        <span /><span style={{ color: 'var(--accent-blue)' }}>Modelo</span><span style={{ color: 'var(--accent-gold)' }}>Mercado</span><span />
      </div>
      {mp && (
        <>
          <Row label={matchInfo.homeTeam.shortName || 'Local'} model={model.home} market={mp.home} />
          <Row label="Empate" model={model.draw} market={mp.draw} />
          <Row label={matchInfo.awayTeam.shortName || 'Visita'} model={model.away} market={mp.away} />
        </>
      )}
      {m.over25 && <Row label="Más de 2.5" model={over} market={m.over25.over} />}
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.55 }}>
        {big
          ? 'El modelo se aleja del mercado más de 5 puntos. En 7.345 partidos de prueba, esas discrepancias fueron error del modelo y no información nueva: ante una diferencia así, es más prudente confiar en el mercado.'
          : 'El modelo y el mercado coinciden de forma razonable.'}
      </div>
      {m.odds?.pinnacle?.every(Boolean) && (
        <div className="num" style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
          Cuotas Pinnacle: {m.odds.pinnacle.map((o) => o.toFixed(2)).join(' · ')}
        </div>
      )}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{m.note} Fuente: football-data.co.uk.</div>
    </div>
  );
}
