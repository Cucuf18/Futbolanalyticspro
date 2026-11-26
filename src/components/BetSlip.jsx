import React, { useState, useEffect } from 'react';
import { useBetSlip } from '../context/BetSlipContext';
import { useNavigate } from 'react-router-dom';
import { betsApi, getToken } from '../api/betsApi';

const MINIMIZED_KEY = 'bet_slip_minimized';

export default function BetSlip() {
  const { slip, removeFromSlip, clearSlip, settleBet } = useBetSlip();
  const navigate = useNavigate();

  // Registro de la apuesta REAL (monto y cuota de tu casa).
  const [stake, setStake] = useState('');
  const [totalOdds, setTotalOdds] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok: bool, text }

  // Se recuerda si lo dejaste minimizado, para que no vuelva a taparte
  // el contenido cada vez que cambias de partido o recargas.
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem(MINIMIZED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!msg?.ok || slip.length > 0) return undefined;
    const t = setTimeout(() => setMsg(null), 7000);
    return () => clearTimeout(t);
  }, [msg, slip.length]);

  useEffect(() => {
    try {
      localStorage.setItem(MINIMIZED_KEY, String(isMinimized));
    } catch {
      /* modo privado o almacenamiento bloqueado: no es critico */
    }
  }, [isMinimized]);

  if (slip.length === 0) {
    // Tras registrar la apuesta el boleto queda vacio: solo se muestra la confirmacion.
    if (!msg) return null;
    return (
      <div style={{
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, maxWidth: 'min(320px, calc(100vw - 40px))',
        background: 'rgba(var(--panel), 0.95)', border: `1px solid ${msg.ok ? 'var(--accent-green)' : 'var(--accent-red)'}`,
        borderRadius: '12px', padding: '12px 14px', fontSize: '12px', lineHeight: 1.45,
        color: msg.ok ? 'var(--accent-green)' : 'var(--accent-red)', display: 'flex', gap: '10px', alignItems: 'flex-start',
      }}>
        <span style={{ flex: 1 }}>{msg.text}</span>
        <button onClick={() => setMsg(null)} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
      </div>
    );
  }

  const num = (v) => parseFloat(String(v).replace(',', '.'));
  const registerBet = async () => {
    const s = num(stake);
    const o = num(totalOdds);
    if (!getToken()) {
      setMsg({ ok: false, text: 'Primero guarda tu clave en Rendimiento → Mis apuestas reales.' });
      return;
    }
    if (!(s > 0) || !(o > 1)) {
      setMsg({ ok: false, text: 'Escribe el monto y la cuota total que te da tu casa.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await betsApi.add({
        stake: s,
        odds: o,
        legs: slip.map((p) => ({
          matchLabel: `${p.homeTeamFull || p.homeTeam} vs ${p.awayTeamFull || p.awayTeam}`,
          label: p.valueBetType,
          marketType: p.marketType,
          probability: p.probability,
          odds: p.odds,
          leagueId: p.leagueId,
          homeTeamId: p.homeTeamId,
          awayTeamId: p.awayTeamId,
          settle: p.settle,
        })),
      });
      clearSlip();
      setStake('');
      setTotalOdds('');
      setMsg({ ok: true, text: 'Apuesta registrada. Se resolverá sola cuando termine el partido.' });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  // ── Vista minimizada: solo una pastilla con el contador ──
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        title="Abrir mi combinada"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(var(--panel), 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid var(--accent-gold)',
          borderRadius: '999px',
          padding: '10px 16px',
          color: 'var(--accent-gold)',
          fontSize: '13px',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '20px',
          height: '20px',
          borderRadius: '999px',
          background: 'var(--accent-gold)',
          color: 'var(--on-accent)',
          fontSize: '11px',
          fontWeight: 900,
          padding: '0 6px',
        }}>
          {slip.length}
        </span>
        Mi Combinada
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>▲</span>
      </button>
    );
  }

  // ── Vista completa ──
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: 'min(320px, calc(100vw - 40px))',
      background: 'rgba(var(--panel), 0.95)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid var(--accent-gold)',
      borderRadius: '16px',
      padding: '16px',
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-gold)' }}>
          Mi Combinada ({slip.length})
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={clearSlip}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}
          >
            Limpiar
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            title="Minimizar"
            aria-label="Minimizar el boleto"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              background: 'rgba(var(--ov), 0.06)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            −
          </button>
        </div>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slip.map((pick) => (
          <div key={pick.matchId} style={{
            background: 'rgba(var(--ov), 0.05)',
            borderRadius: '8px',
            padding: '10px',
            position: 'relative',
          }}>
            <button
              onClick={() => removeFromSlip(pick.matchId)}
              style={{ position: 'absolute', top: '4px', right: '4px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              ✕
            </button>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', paddingRight: '16px' }}>
              {pick.homeTeamFull || pick.homeTeam} vs {pick.awayTeamFull || pick.awayTeam}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Pick: <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{pick.valueBetType}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '8px' }}>Prob: {pick.probability}%</span>
                <span style={{ fontSize: '10px', color: 'var(--accent-green)', fontWeight: 700 }}>@{pick.odds}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  title="Marcar como Acertado"
                  onClick={() => settleBet(pick.matchId, 'WON')}
                  style={{ background: 'rgba(67, 217, 160, 0.1)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '10px', fontWeight: 700 }}
                >
                  Ok
                </button>
                <button
                  title="Marcar como Fallado"
                  onClick={() => settleBet(pick.matchId, 'LOST')}
                  style={{ background: 'rgba(255, 59, 48, 0.1)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '10px', fontWeight: 700 }}
                >
                  Err
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          ¿La apostaste de verdad? Regístrala:
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)}
            placeholder="Monto S/"
            style={{ flex: 1, minWidth: 0, background: 'rgba(var(--ov), 0.06)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', padding: '7px 8px', fontSize: '12px' }}
          />
          <input
            inputMode="decimal" value={totalOdds} onChange={(e) => setTotalOdds(e.target.value)}
            placeholder="Cuota total"
            style={{ flex: 1, minWidth: 0, background: 'rgba(var(--ov), 0.06)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', padding: '7px 8px', fontSize: '12px' }}
          />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 6px', lineHeight: 1.4 }}>
          Usa la cuota total exacta que muestra tu casa en su boleto{slip.length > 1 ? ' (las combinadas no siempre multiplican igual)' : ''}.
        </div>
        <button
          onClick={registerBet} disabled={busy}
          style={{ width: '100%', background: 'rgba(67, 217, 160, 0.12)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', padding: '8px', borderRadius: '8px', cursor: busy ? 'wait' : 'pointer', fontWeight: 800, fontSize: '12px' }}
        >
          {busy ? 'Guardando...' : slip.length > 1 ? `Registrar combinada (${slip.length})` : 'Registrar apuesta'}
        </button>
        {msg && (
          <div style={{ fontSize: '11px', marginTop: '6px', color: msg.ok ? 'var(--accent-green)' : 'var(--accent-red)', lineHeight: 1.4 }}>
            {msg.text}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/combinadas')}
        style={{
          width: '100%',
          marginTop: '12px',
          background: 'linear-gradient(135deg, #ffe066 0%, #f2b84b 100%)',
          color: '#000',
          border: 'none',
          padding: '10px',
          borderRadius: '10px',
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: '12px',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => (e.target.style.transform = 'scale(1.02)')}
        onMouseOut={(e) => (e.target.style.transform = 'scale(1)')}
      >
        Ver boleto completo
      </button>
    </div>
  );
}
