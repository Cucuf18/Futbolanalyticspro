import React, { useState, useEffect } from 'react';
import { useBetSlip } from '../context/BetSlipContext';
import { useNavigate } from 'react-router-dom';

export default function CombinadasView() {
  const { slip, history, removeFromSlip, clearSlip, settleBet, clearHistory } = useBetSlip();
  const navigate = useNavigate();
  const [modelWeights, setModelWeights] = useState(null);

  // Load current weights for transparency/debug
  useEffect(() => {
    fetch('/api/weights')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setModelWeights(data.weights);
        }
      })
      .catch(err => console.error('Error fetching engine weights:', err));
  }, [history]);

  const totalBets = history.length;
  const wonBets = history.filter(b => b.status === 'WON').length;
  const lostBets = history.filter(b => b.status === 'LOST').length;
  const hitRate = totalBets > 0 ? ((wonBets / totalBets) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Boleto de Apuestas</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Gestiona tus combinadas activas y entrena el motor de aprendizaje
          </p>
        </div>
        <button
          onClick={() => navigate('/standings')}
          style={{
            background: 'transparent',
            border: '1.5px solid var(--glass-border)',
            color: 'var(--text-primary)',
            padding: '10px 20px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
          onMouseOver={(e) => e.target.style.borderColor = 'var(--accent-cyan)'}
          onMouseOut={(e) => e.target.style.borderColor = 'var(--glass-border)'}
        >
          Volver a la Tabla
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
        {/* LEFT COLUMN: ACTIVE COMBINADA */}
        <div className="glass-card" style={{ padding: '28px', minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-gold)' }}>
              Picks Seleccionados ({slip.length})
            </h3>
            {slip.length > 0 && (
              <button
                onClick={clearSlip}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Limpiar todo
              </button>
            )}
          </div>

          {slip.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '60px 20px',
              border: '2px dashed var(--glass-border)',
              borderRadius: '16px',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>El boleto esta vacio</p>
              <p style={{ fontSize: '12px', maxWidth: '300px' }}>
                Navega por el Predictor y selecciona recomendaciones del modelo para agregarlas aqui.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {slip.map((pick) => (
                <div
                  key={pick.matchId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1.5px solid var(--glass-border)',
                    borderRadius: '14px',
                    padding: '20px',
                    position: 'relative',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromSlip(pick.matchId)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ✕
                  </button>

                  {/* Teams info with full names */}
                  <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)', paddingRight: '20px' }}>
                    {pick.homeTeamFull || pick.homeTeam} vs {pick.awayTeamFull || pick.awayTeam}
                  </div>

                  {/* Pick details */}
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Prediccion: <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{pick.valueBetType}</span>
                  </div>

                  {/* Actions & Metrics */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Confianza: <strong style={{ color: '#fff' }}>{pick.probability}%</strong>
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Cuota: <strong style={{ color: 'var(--accent-green)' }}>@{pick.odds}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => settleBet(pick.matchId, 'WON')}
                        style={{
                          background: 'rgba(0, 230, 118, 0.1)',
                          border: '1px solid var(--accent-green)',
                          color: 'var(--accent-green)',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Acertado
                      </button>
                      <button
                        onClick={() => settleBet(pick.matchId, 'LOST')}
                        style={{
                          background: 'rgba(255, 82, 82, 0.1)',
                          border: '1px solid var(--accent-red)',
                          color: 'var(--accent-red)',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Fallado
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PERFORMANCE & LEARNING LOOP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Engine Calibration Board */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: '16px' }}>
              Calibracion del Modelo Predictivo
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              El bucle de auto-aprendizaje optimiza los coeficientes del motor cada vez que resuelves un pronostico.
            </p>

            {modelWeights ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ventaja Local</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '4px' }}>
                    {modelWeights.homeAdvantage?.toFixed(3)}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fuerza Ataque Local</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '4px' }}>
                    {modelWeights.homeAttackMultiplier?.toFixed(3)}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fuerza Ataque Vis.</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '4px' }}>
                    {modelWeights.awayAttackMultiplier?.toFixed(3)}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Base H2H</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '4px' }}>
                    {modelWeights.h2hBaseWeight?.toFixed(3)}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cargando parametros del modelo...</div>
            )}
          </div>

          {/* Resolved History & Metrics */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Historial de Aciertos</h3>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Limpiar historial
                </button>
              )}
            </div>

            {/* Micro Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Muestra</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{totalBets}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', textAlign: 'center', borderBottom: '2.5px solid var(--accent-green)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Aciertos</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-green)', marginTop: '4px' }}>{wonBets}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', textAlign: 'center', borderBottom: '2.5px solid var(--accent-red)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fallos</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-red)', marginTop: '4px' }}>{lostBets}</div>
              </div>
            </div>

            {/* Hit rate big view */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.05) 0%, rgba(157, 78, 221, 0.05) 100%)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tasa de Acierto (Hit Rate)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff', marginTop: '6px' }}>
                {hitRate}%
              </div>
            </div>

            {/* List of past bets */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No tienes predicciones registradas aun.
                </div>
              ) : (
                history.map((bet, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.01)',
                      borderLeft: `4px solid ${bet.status === 'WON' ? 'var(--accent-green)' : 'var(--accent-red)'}`
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>
                        {bet.homeTeamFull || bet.homeTeam} vs {bet.awayTeamFull || bet.awayTeam}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Pick: {bet.valueBetType} | Prob: {bet.probability}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: bet.status === 'WON' ? 'var(--accent-green)' : 'var(--accent-red)'
                      }}>
                        {bet.status === 'WON' ? 'ACERTADO' : 'FALLADO'}
                      </span>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(bet.settledAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
