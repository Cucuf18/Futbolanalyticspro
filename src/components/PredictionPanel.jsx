import React from 'react';

export default function PredictionPanel({ predictionData, isPremium, onOpenPremiumModal }) {
  if (!predictionData || !predictionData.prediction) return null;

  const { matchInfo, prediction } = predictionData;
  const { probabilities, expectedGoals, probabilitiesSecondary, mostLikelyScore, recommendation, recommendedOdds, confidenceScore } = prediction;

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
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 700,
          background: isPremium ? 'linear-gradient(135deg, #ffe066 0%, #ffaa00 100%)' : 'rgba(255, 255, 255, 0.08)',
          color: isPremium ? '#000' : 'var(--text-muted)',
          border: '1px solid rgba(255,255,255,0.1)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
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

        {/* Win Probabilities */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Probabilidades de Resultado
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

        {/* Detailed Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          
          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goles Esperados (xG)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-purple)' }}>
              {expectedGoals.home} – {expectedGoals.away}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Total: {expectedGoals.total} goles
            </div>
          </div>

          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Linea +2.5 Goles</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-green)' }}>
              {probabilitiesSecondary.over25}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              BTTS: {probabilitiesSecondary.btts}%
            </div>
          </div>

          <div style={{ background: 'rgba(15, 22, 41, 0.7)', padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Marcador Probable</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-gold)' }}>
              {mostLikelyScore}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Confianza: {confidenceScore}%
            </div>
          </div>
        </div>

        {/* Value Bet Signal */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.12) 0%, rgba(157, 78, 221, 0.12) 100%)',
          border: '1px solid rgba(0, 242, 254, 0.25)',
          borderRadius: '14px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Senal Value Bet
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
              {recommendation}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cuota Min.</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)' }}>
              @{recommendedOdds}
            </div>
          </div>
        </div>
      </div>

      {/* Paywall Overlay */}
      {!isPremium && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(8, 12, 22, 0.78)',
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
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(255, 170, 0, 0.15)',
            border: '2px solid rgba(255, 170, 0, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 800, color: 'var(--accent-gold)',
            marginBottom: '12px',
          }}>
            P
          </div>
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
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              padding: '12px 28px',
              borderRadius: '14px',
              boxShadow: '0 6px 20px rgba(255, 170, 0, 0.4)',
            }}
          >
            Desbloquear Predicciones
          </button>
        </div>
      )}
    </div>
  );
}
