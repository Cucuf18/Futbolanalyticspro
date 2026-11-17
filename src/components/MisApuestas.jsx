import React, { useCallback, useEffect, useState } from 'react';
import { betsApi, getToken, setToken } from '../api/betsApi';

const sol = (n) => (n === null || n === undefined ? '—' : `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const sign = (n) => (n > 0 ? '+' : '');
const tone = (n) => (n === null || n === undefined || n === 0 ? undefined : n > 0 ? 'var(--accent-green)' : 'var(--accent-red)');

const STATUS = {
  WON: { label: 'GANADA', color: 'var(--accent-green)' },
  LOST: { label: 'PERDIDA', color: 'var(--accent-red)' },
  VOID: { label: 'DEVUELTA', color: 'var(--text-muted)' },
  PENDING: { label: 'PENDIENTE', color: 'var(--accent-gold)' },
};

function Stat({ label, value, hint, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: color || 'var(--text-primary)' }}>{value}</div>
      {hint && <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>{hint}</div>}
    </div>
  );
}

const btn = (color) => ({
  background: 'transparent', border: `1px solid ${color}`, color, borderRadius: '6px',
  cursor: 'pointer', padding: '3px 8px', fontSize: '11px', fontWeight: 700,
});

export default function MisApuestas() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [tokenInput, setTokenInput] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bankroll, setBankroll] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await betsApi.list());
    } catch (e) {
      if (e.status === 401) {
        setToken('');
        setAuthed(false);
        setError('La clave no es correcta.');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const run = async (fn) => {
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError(e.message);
    }
  };

  const wrap = { padding: '24px', marginBottom: '24px' };

  if (!authed) {
    return (
      <div className="glass-card" style={wrap}>
        <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Mis apuestas reales</h3>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '6px 0 14px', lineHeight: 1.5 }}>
          Aquí llevas tu banca y tu yield con las cuotas reales de tu casa. Son datos tuyos, así que están
          protegidos con una clave que tú defines en el servidor (variable BETS_TOKEN).
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Tu clave"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', padding: '8px 10px', fontSize: '13px', minWidth: '220px' }}
          />
          <button
            onClick={() => { if (tokenInput.trim()) { setToken(tokenInput.trim()); setAuthed(true); setTokenInput(''); } }}
            style={{ ...btn('var(--accent-cyan)'), padding: '8px 14px', fontSize: '12px' }}
          >
            Entrar
          </button>
        </div>
        {error && <div style={{ color: 'var(--accent-red)', fontSize: '12px', marginTop: '8px' }}>{error}</div>}
      </div>
    );
  }

  const s = data?.summary;
  return (
    <div className="glass-card" style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Mis apuestas reales</h3>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Con las cuotas reales de tu casa. Es lo único que dice si ganas dinero.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => run(betsApi.settleNow)} style={btn('var(--accent-cyan)')}>Comprobar resultados</button>
          <button onClick={() => { setToken(''); setAuthed(false); setData(null); }} style={btn('var(--text-muted)')}>Salir</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--accent-red)', fontSize: '12px', marginBottom: '10px' }}>{error}</div>}
      {loading && !data && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Cargando...</div>}

      {s && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <Stat label="Banca actual" value={sol(s.bancaActual)} hint={s.montoPendiente > 0 ? `${sol(s.montoPendiente)} en juego` : 'disponible'} />
            <Stat label="Ganancia" value={`${sign(s.ganancia)}${sol(s.ganancia)}`} color={tone(s.ganancia)} hint={`sobre ${sol(s.apostadoLiquidado)} apostado`} />
            <Stat label="Yield" value={s.yield === null ? '—' : `${sign(s.yield)}${s.yield}%`} color={tone(s.yield)} hint="ganancia / apostado" />
            <Stat label="Aciertos" value={s.hitRate === null ? '—' : `${s.hitRate}%`} hint={`${s.ganadas} de ${s.liquidadas}${s.ic95 ? ` · IC95 ${s.ic95[0]}–${s.ic95[1]}%` : ''}`} />
            <Stat label="Peor caída" value={sol(s.maxDrawdown)} hint="de pico a valle" />
            <Stat label="Pendientes" value={s.pendientes} hint={s.porRevisar > 0 ? `${s.porRevisar} por revisar a mano` : 'se resuelven solas'} />
          </div>

          <div style={{
            marginTop: '14px', padding: '12px 14px', borderRadius: '10px', fontSize: '12px', lineHeight: 1.55, color: 'var(--text-secondary)',
            background: s.confianza === 'muy baja' || s.confianza === 'baja' ? 'rgba(255,170,0,0.08)' : 'rgba(0,230,118,0.06)',
            border: `1px solid ${s.confianza === 'muy baja' || s.confianza === 'baja' ? 'rgba(255,170,0,0.3)' : 'rgba(0,230,118,0.3)'}`,
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>Fiabilidad de esta medición: {s.confianza}</strong> ({s.liquidadas} apuestas liquidadas).{' '}
            {s.aviso || 'Muestra grande: el yield ya es una guía sólida.'}
            {s.racha && <> Racha actual: {s.racha.cantidad} {s.racha.tipo === 'WON' ? 'ganada(s)' : 'perdida(s)'} seguida(s).</>}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Banca inicial:</span>
            <input
              inputMode="decimal" value={bankroll} onChange={(e) => setBankroll(e.target.value)}
              placeholder={String(data.settings?.initialBankroll ?? 0)}
              style={{ width: '110px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', padding: '6px 8px', fontSize: '12px' }}
            />
            <button
              onClick={() => { const v = parseFloat(bankroll.replace(',', '.')); if (Number.isFinite(v)) { run(() => betsApi.setBankroll(v)); setBankroll(''); } }}
              style={btn('var(--accent-cyan)')}
            >
              Guardar
            </button>
          </div>

          {(s.porTipo.length > 0 || s.porMercado.length > 0) && (
            <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '6px' }}>Desglose</th><th>Apuestas</th><th>Ganadas</th><th>Apostado</th><th>Ganancia</th><th>Yield</th>
                  </tr>
                </thead>
                <tbody>
                  {[...s.porTipo, ...s.porMercado.map((m) => ({ ...m, key: `Mercado: ${m.key}` }))].map((g) => (
                    <tr key={g.key} style={{ borderTop: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '6px', fontWeight: 600 }}>{g.key}</td>
                      <td>{g.apuestas}</td><td>{g.ganadas}</td><td>{sol(g.apostado)}</td>
                      <td style={{ color: tone(g.ganancia) }}>{sign(g.ganancia)}{sol(g.ganancia)}</td>
                      <td style={{ color: tone(g.yield) }}>{g.yield === null ? '—' : `${sign(g.yield)}${g.yield}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {data && data.bets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
          Aún no registraste apuestas. Agrega picks a tu boleto, escribe el monto y la cuota total de tu casa, y pulsa “Registrar”.
        </div>
      )}

      {data && data.bets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.bets.map((b) => {
            const st = STATUS[b.status] || STATUS.PENDING;
            const net = b.status === 'PENDING' ? null : (b.payout || 0) - b.stake;
            return (
              <div key={b.id} style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', borderLeft: `4px solid ${st.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {b.legs.length > 1 ? `Combinada de ${b.legs.length}` : 'Simple'} · {new Date(b.createdAt).toLocaleDateString('es-PE')} · {sol(b.stake)} a @{b.odds}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: st.color }}>{st.label}</span>
                    {net !== null && <span style={{ fontSize: '12px', fontWeight: 700, marginLeft: '8px', color: tone(net) }}>{sign(net)}{sol(net)}</span>}
                  </div>
                </div>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {b.legs.map((l, i) => (
                    <div key={i} style={{ fontSize: '12.5px' }}>
                      <span style={{ marginRight: '6px' }}>{l.result === true ? '✅' : l.result === false ? '❌' : l.result === 'void' ? '↩️' : '⏳'}</span>
                      <strong>{l.matchLabel}</strong> — <span style={{ color: 'var(--accent-cyan)' }}>{l.label}</span>
                      {l.finalScore && <span style={{ color: 'var(--text-muted)' }}> ({l.finalScore})</span>}
                      {!l.auto && l.result === null && <span style={{ color: 'var(--accent-gold)', fontSize: '11px' }}> · se resuelve a mano</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {b.status === 'PENDING' ? (
                    <>
                      <button style={btn('var(--accent-green)')} onClick={() => run(() => betsApi.resolve(b.id, 'WON'))}>Ganó</button>
                      <button style={btn('var(--accent-red)')} onClick={() => run(() => betsApi.resolve(b.id, 'LOST'))}>Perdió</button>
                      <button style={btn('var(--text-muted)')} onClick={() => run(() => betsApi.resolve(b.id, 'VOID'))}>Devuelta</button>
                    </>
                  ) : (
                    <button style={btn('var(--text-muted)')} onClick={() => run(() => betsApi.resolve(b.id, 'PENDING'))}>Reabrir</button>
                  )}
                  <button
                    style={btn('var(--text-muted)')}
                    onClick={() => { if (window.confirm('¿Borrar esta apuesta? Cambiará tu banca y tu yield.')) run(() => betsApi.remove(b.id)); }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
