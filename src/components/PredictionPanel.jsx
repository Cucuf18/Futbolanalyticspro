import React from 'react';

export default function PredictionPanel({ predictionData, isPremium, onOpenPremiumModal }) {
  if (!predictionData || !predictionData.prediction) return null;

  const { matchInfo, prediction } = predictionData;
  const { probabilities, expectedGoals, probabilitiesSecondary, mostLikelyScore, recommendation, recommendedOdds, confidenceScore } = prediction;

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
      
      {/* Panel Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🤖</span> Modelado Predictivo & Algoritmo IA (Poisson + Dixon-Coles)
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Simulación estadística para {matchInfo.homeTeam.name} vs {matchInfo.awayTeam.name}
          </p>
        </div>

        {/* Premium Badge */}
        <div style={{
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 700,
          background: isPremium ? 'linear-gradient(135deg, #ffe066 0%, #ffaa00 100%)' : 'rgba(255, 255, 255, 0.08)',
          color: isPremium ? '#000' : 'var(--text-muted)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {isPremium ? '⭐ ACCESO PREMIUM ACTIVO' : '🔒 CONTENIDO RESTRINGIDO'}
        </div>
      </div>

      {/* Main Content (Blurred if not premium) */}
      <div style={{
        filter: isPremium ? 'none' : 'blur(7px)',
        pointerEvents: isPremium ? 'auto' : 'none',
        userSelect: isPremium ? 'auto' : 'none',
        opacity: isPremium ? 1 : 0.45,
        transition: 'var(--transition-smooth)'
      }}>

        {/* Win / Draw / Loss Probabilities */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Probabilidades de Resultado Final
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center', marginBottom: '12px' }}>
            
            <div style={{ background: 'rgba(0, 242, 254, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 600 }}>{matchInfo.homeTeam.shortName}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{probabilities.homeWin}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Victoria Local</div>
            </div>

            <div style={{ background: 'rgba(255, 170, 0, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 170, 0, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-gold)', fontWeight: 600 }}>Empate</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-gold)' }}>{probabilities.draw}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tablas</div>
            </div>

            <div style={{ background: 'rgba(255, 61, 113, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 61, 113, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600 }}>{matchInfo.awayTeam.shortName}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-red)' }}>{probabilities.awayWin}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Victoria Visitante</div>
            </div>

          </div>
        </div>

        {/* Expected Goals (xG) & Detailed Odds Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          
          {/* xG Card */}
          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Goles Esperados (xG)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-purple)' }}>
              {expectedGoals.home} - {expectedGoals.away}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Total Combinado: {expectedGoals.total} goles
            </div>
          </div>

          {/* Over 2.5 Goals */}
          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Línea +2.5 Goles</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-green)' }}>
              {probabilitiesSecondary.over25}% <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Prob.</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              BTTS (Ambos Anotan): {probabilitiesSecondary.btts}%
            </div>
          </div>

          {/* Most Likely Score */}
          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Marcador Más Probable</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-gold)' }}>
              {mostLikelyScore}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Índice de Confianza: {confidenceScore}%
            </div>
          </div>

        </div>

        {/* Value Bet Signal Box */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(157, 78, 221, 0.15) 100%)',
          border: '1px solid rgba(0, 242, 254, 0.3)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase' }}>
              🎯 Señal de Apuesta de Valor (Value Bet AI)
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
              {recommendation}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cuota Recomendada</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)' }}>
              @{recommendedOdds}
            </div>
          </div>
        </div>

      </div>

      {/* Paywall Overlay Gating for Standard Users */}
      {!isPremium && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(8, 12, 22, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          zIndex: 10,
        }}>
          <div style={{
            fontSize: '42px',
            marginBottom: '8px',
            filter: 'drop-shadow(0 0 10px rgba(255, 170, 0, 0.5))'
          }}>
            🔒
          </div>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Modelado Predictivo Restringido
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '440px', marginBottom: '20px' }}>
            El cálculo de probabilidades por Poisson, simulaciones xG y señales de cuotas de valor están reservados para suscriptores <strong className="gradient-gold">Pro & Premium</strong>.
          </p>
          <button
            onClick={onOpenPremiumModal}
            style={{
              background: 'linear-gradient(135deg, #ffe066 0%, #ffaa00 100%)',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              padding: '12px 28px',
              borderRadius: '14px',
              boxShadow: '0 6px 20px rgba(255, 170, 0, 0.4)',
            }}
          >
            ⭐ Desbloquear Pronósticos IA Ahora
          </button>
        </div>
      )}

    </div>
  );
}
