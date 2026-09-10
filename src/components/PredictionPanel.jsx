import React, { useState } from 'react';
import { useBetSlip } from '../context/BetSlipContext';
import DepthMetrics from './DepthMetrics';
import MatchPicks from './MatchPicks';

export default function PredictionPanel({ predictionData, isPremium, onOpenPremiumModal }) {
  const { addToSlip } = useBetSlip();
  
  if (!predictionData || !predictionData.prediction) return null;

  const { matchInfo, h2h, prediction } = predictionData;

  const {
    probabilities = {},
    expectedGoals = {},
    probabilitiesSecondary = {},
    mostLikelyScore = 'N/A',
    fairOdds = {},
    marketOdds = {},
    confidenceScore = 0,
    matchPicks = null,
    dataQuality = null,
    leagueTendencies = [],
    expectedEvents = null,
    expectedEventsByTeam = null,
    league = null,
  } = prediction || {};

  // Match Summary stats from Monte Carlo
  const summary = prediction.monteCarlo?.matchSummary;

  const handleSavePick = (pick) => {
    addToSlip({
      matchId: `${matchInfo.homeTeam.id}-${matchInfo.awayTeam.id}-${pick.type}`,
      homeTeam: matchInfo.homeTeam.shortName,
      awayTeam: matchInfo.awayTeam.shortName,
      homeTeamFull: matchInfo.homeTeam.name,
      awayTeamFull: matchInfo.awayTeam.name,
      valueBetType: pick.label,
      probability: pick.probability,
      odds: pick.marketOdds || pick.fairOdds,
      breakEvenOdds: pick.breakEvenOdds || pick.fairOdds,
      marketType: pick.marketType,
    });
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Modelado Predictivo (Poisson + Dixon-Coles)
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {matchInfo.homeTeam.name} vs {matchInfo.awayTeam.name}
          </p>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
          background: isPremium ? 'linear-gradient(135deg, #ffe066 0%, #ffaa00 100%)' : 'rgba(255, 255, 255, 0.08)',
          color: isPremium ? '#000' : 'var(--text-muted)',
          border: '1px solid rgba(255,255,255,0.1)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {isPremium ? 'Acceso Premium' : 'Contenido Restringido'}
        </div>
      </div>

      {/* Prediction Content (blurred for free users) */}
      <div style={{
        filter: isPremium ? 'none' : 'blur(7px)',
        pointerEvents: isPremium ? 'auto' : 'none',
        userSelect: isPremium ? 'auto' : 'none',
        opacity: isPremium ? 1 : 0.45,
        transition: 'var(--transition-smooth)',
      }}>

        {/* ========== MATCH PICKS SECTION ========== */}
        <MatchPicks
          matchPicks={matchPicks}
          matchInfo={matchInfo}
          dataQuality={dataQuality}
          leagueTendencies={leagueTendencies}
        />

        {/* ========== MATCH SUMMARY SECTION ========== */}
        {summary && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px' }}>📊</span>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Resumen Total del Partido
              </h3>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-cyan)', background: 'rgba(0,242,254,0.1)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(0,242,254,0.2)' }}>
                BASADO EN 10,000 SIMULACIONES
              </div>
            </div>

            {/* Main predicted score */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(157, 78, 221, 0.15) 0%, rgba(0, 242, 254, 0.1) 100%)',
              border: '1px solid rgba(157, 78, 221, 0.3)',
              borderRadius: '16px', padding: '20px', marginBottom: '16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Marcador Más Probable
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '4px' }}>{matchInfo.homeTeam.shortName}</div>
                </div>
                <div style={{
                  fontSize: '36px', fontWeight: 900, color: 'var(--accent-gold)',
                  textShadow: '0 0 20px rgba(255,170,0,0.4)',
                  letterSpacing: '4px',
                }}>
                  {mostLikelyScore}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-red)', marginBottom: '4px' }}>{matchInfo.awayTeam.shortName}</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Confianza del modelo: <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{confidenceScore}%</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              
              {/* Total Goals */}
              <div style={{
                background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px',
                border: '1px solid var(--glass-border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>⚽</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)' }}>{summary?.avgTotalGoals ?? 'N/A'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '4px' }}>Media de Goles</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {summary?.avgHomeGoals ?? '0'} - {summary?.avgAwayGoals ?? '0'}
                </div>
              </div>

              {/* BTTS */}
              <div style={{
                background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px',
                border: '1px solid var(--glass-border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>🎯</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: (summary?.bttsPct ?? 0) > 42 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{summary?.bttsPct ?? 'N/A'}%</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '4px' }}>Ambos Anotan</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {(summary?.bttsPct ?? 0) > 42 ? 'Competitivo' : 'Poco probable'}
                </div>
              </div>

              {/* Yellow Cards */}
              <div style={{
                background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px',
                border: '1px solid var(--glass-border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>🟨</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffd700' }}>{summary?.avgYellowCards ?? 'N/A'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '4px' }}>Tarjetas Amarillas</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Media por partido
                </div>
              </div>

              {/* Offsides */}
              <div style={{
                background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px',
                border: '1px solid var(--glass-border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>🚩</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-purple)' }}>{summary?.avgOffsides ?? 'N/A'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '4px' }}>Fueras de Juego</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Media por partido
                </div>
              </div>

              {/* Shots on Target */}
              <div style={{
                background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px',
                border: '1px solid var(--glass-border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>🥅</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{summary?.avgShotsOnTarget ?? 'N/A'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '4px' }}>Tiros a Puerta</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Combinados
                </div>
              </div>

              {/* Corners */}
              <div style={{
                background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px',
                border: '1px solid var(--glass-border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>📐</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-gold)' }}>{summary?.avgCorners ?? 'N/A'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '4px' }}>Córners</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Combinados
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== WIN PROBABILITIES ========== */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Probabilidades de Resultado
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(0, 242, 254, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 600 }}>{matchInfo?.homeTeam?.shortName ?? 'Local'}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{probabilities?.homeWin ?? 'N/A'}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Victoria Local</div>
            </div>

            <div style={{ background: 'rgba(255, 170, 0, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 170, 0, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-gold)', fontWeight: 600 }}>Empate</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-gold)' }}>{probabilities?.draw ?? 'N/A'}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tablas</div>
            </div>

            <div style={{ background: 'rgba(255, 61, 113, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 61, 113, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600 }}>{matchInfo?.awayTeam?.shortName ?? 'Visita'}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-red)' }}>{probabilities?.awayWin ?? 'N/A'}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Victoria Visitante</div>
            </div>
          </div>
        </div>

        {/* ========== DEPTH METRICS ========== */}
        <DepthMetrics
          homeTeam={matchInfo.homeTeam}
          awayTeam={matchInfo.awayTeam}
          expectedByTeam={expectedEventsByTeam}
        />

        {/* ========== DETAILED METRICS ========== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          
          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goles Esperados (xG)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-purple)' }}>
              {expectedGoals?.home ?? 'N/A'} – {expectedGoals?.away ?? 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Total: {expectedGoals?.total ?? '0'} goles
            </div>
          </div>

          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Linea +2.5 Goles</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-green)' }}>
              {probabilitiesSecondary?.over25 ?? 'N/A'}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              BTTS: {probabilitiesSecondary?.btts ?? 'N/A'}%
            </div>
          </div>

          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Marcador Probable</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-gold)' }}>
              {mostLikelyScore ?? 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Confianza: {confidenceScore ?? 'N/A'}%
            </div>
          </div>
        </div>

        {/* ========== EVENTOS ESPERADOS DEL PARTIDO ========== */}
        {expectedEvents && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Eventos esperados en este cruce
              </div>
              {league && (
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Base de {league.name}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
              {[
                { key: 'corners', label: 'Corners', color: '#448aff' },
                { key: 'cards', label: 'Tarjetas', color: '#ffd600' },
                { key: 'fouls', label: 'Faltas', color: '#ffb300' },
                { key: 'shots', label: 'Remates', color: '#ff6d00' },
                { key: 'shotsOnTarget', label: 'Tiros a puerta', color: '#00e676' },
                { key: 'offsides', label: 'Fueras de juego', color: '#ff5252' },
              ].map((item) => (
                <div key={item.key} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  padding: '12px',
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: item.color, marginTop: '2px' }}>
                    {expectedEvents[item.key]}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.5 }}>
              Estas medias se calculan cruzando el rendimiento de los dos equipos con la base estadistica
              de la competicion. Son las que generan las lineas de los picks, por eso ningun partido
              comparte las mismas lineas que otro.
            </div>
          </div>
        )}

        {/* ========== CUOTAS ESTIMADAS 1X2 ========== */}
        {marketOdds && marketOdds.homeWin && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Cuotas estimadas del mercado principal
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: matchInfo.homeTeam.shortName, odds: marketOdds.homeWin, min: fairOdds.homeWin, prob: probabilities.homeWin },
                { label: 'Empate', odds: marketOdds.draw, min: fairOdds.draw, prob: probabilities.draw },
                { label: matchInfo.awayTeam.shortName, odds: marketOdds.awayWin, min: fairOdds.awayWin, prob: probabilities.awayWin },
              ].map((o, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{o.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent-cyan)', marginTop: '4px' }}>@{o.odds}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {o.prob}% · minima @{o.min}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== MONTE CARLO SIMULATION ========== */}
        {prediction.monteCarlo && (
          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>⚡</span> Simulador Monte Carlo
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Resultados de 10,000 partidos virtuales basados en xG</div>
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(255, 170, 0, 0.1)', color: 'var(--accent-gold)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,170,0,0.2)' }}>
                10,000 ITERACIONES
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Simulation Results Bar */}
              <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Distribución de Resultados</div>
                
                <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                  <div style={{ width: `${prediction.monteCarlo?.results?.homeWinPct ?? 0}%`, background: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#000', transition: 'width 1s ease-out' }}>
                    {(prediction.monteCarlo?.results?.homeWinPct ?? 0) > 10 ? `${prediction.monteCarlo?.results?.homeWinPct}%` : ''}
                  </div>
                  <div style={{ width: `${prediction.monteCarlo?.results?.drawPct ?? 0}%`, background: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#000', transition: 'width 1s ease-out' }}>
                    {(prediction.monteCarlo?.results?.drawPct ?? 0) > 10 ? `${prediction.monteCarlo?.results?.drawPct}%` : ''}
                  </div>
                  <div style={{ width: `${prediction.monteCarlo?.results?.awayWinPct ?? 0}%`, background: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#000', transition: 'width 1s ease-out' }}>
                    {(prediction.monteCarlo?.results?.awayWinPct ?? 0) > 10 ? `${prediction.monteCarlo?.results?.awayWinPct}%` : ''}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ color: 'var(--accent-cyan)' }}><span style={{ fontWeight: 700 }}>{prediction.monteCarlo?.results?.homeWins ?? '0'}</span> V. Local</div>
                  <div style={{ color: 'var(--accent-gold)' }}><span style={{ fontWeight: 700 }}>{prediction.monteCarlo?.results?.draws ?? '0'}</span> Empates</div>
                  <div style={{ color: 'var(--accent-red)' }}><span style={{ fontWeight: 700 }}>{prediction.monteCarlo?.results?.awayWins ?? '0'}</span> V. Vis.</div>
                </div>
              </div>

              {/* Top Scores */}
              <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Marcadores Frecuentes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {prediction.monteCarlo?.topScores?.map((scoreObj, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: idx === 0 ? '1px solid rgba(255,170,0,0.3)' : '1px solid transparent' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: idx === 0 ? 'var(--accent-gold)' : 'var(--text-primary)' }}>{scoreObj.score}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 700, color: idx === 0 ? 'var(--accent-gold)' : 'inherit' }}>{scoreObj.percentage}%</span> de probabilidad
                      </div>
                    </div>
                  )) ?? <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No hay datos</div>}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========== PAYWALL OVERLAY ========== */}
      {!isPremium && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(8, 12, 22, 0.78)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '20px', textAlign: 'center', zIndex: 10,
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(255, 170, 0, 0.15)', border: '2px solid rgba(255, 170, 0, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 800, color: 'var(--accent-gold)', marginBottom: '12px',
          }}>P</div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Predicciones Restringidas
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '20px', lineHeight: 1.6 }}>
            Las probabilidades Poisson, simulaciones xG y senales de cuotas estan reservadas para suscriptores <strong className="gradient-gold">Premium</strong>.
          </p>
          <button
            onClick={onOpenPremiumModal}
            style={{
              background: 'linear-gradient(135deg, #ffe066 0%, #ffaa00 100%)',
              color: '#000', fontWeight: 800, fontSize: '14px', padding: '12px 28px',
              borderRadius: '14px', boxShadow: '0 6px 20px rgba(255, 170, 0, 0.4)',
            }}
          >
            Desbloquear Predicciones
          </button>
        </div>
      )}
    </div>
  );
}
