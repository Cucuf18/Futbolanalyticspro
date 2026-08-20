import React from 'react';
import { useBetSlip } from '../context/BetSlipContext';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';

export default function HistoryTracker() {
  const { history, clearHistory } = useBetSlip();
  const navigate = useNavigate();

  const totalBets = history.length;
  const wonBets = history.filter(b => b.status === 'WON').length;
  const lostBets = history.filter(b => b.status === 'LOST').length;
  const hitRate = totalBets > 0 ? ((wonBets / totalBets) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar 
        isPremium={false} 
        onTogglePremium={() => {}} 
        onOpenPremiumModal={() => {}} 
        dataSource="live" 
      />
      
      <main style={{ maxWidth: '800px', width: '100%', margin: '0 auto', padding: '40px 16px', flex: 1 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Rendimiento Histórico</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Métricas de asertividad del motor predictivo</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            style={{ 
              background: 'transparent', border: '1px solid var(--glass-border)', 
              color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' 
            }}
          >
            ← Volver al Dashboard
          </button>
        </div>

        {/* METRICS ROW */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' 
        }}>
          <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Muestra Analizada</div>
            <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px' }}>{totalBets}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Predicciones Totales</div>
          </div>
          
          <div className="glass-card" style={{ padding: '24px', textAlign: 'center', borderTop: '2px solid var(--accent-green)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aciertos</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-green)', marginTop: '8px' }}>{wonBets}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Predicciones Exitosas</div>
          </div>

          <div className="glass-card" style={{ padding: '24px', textAlign: 'center', borderTop: '2px solid var(--accent-red)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fallos</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-red)', marginTop: '8px' }}>{lostBets}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Predicciones Erradas</div>
          </div>

          <div className="glass-card" style={{ padding: '24px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,242,254,0.05) 0%, rgba(157,78,221,0.05) 100%)', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Hit Rate (Tasa de Acierto)</div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{hitRate}%</div>
          </div>
        </div>

        {/* LIST ROW */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Registro de Predicciones</h3>
            {history.length > 0 && (
              <button onClick={clearHistory} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>Limpiar Historial</button>
            )}
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No tienes predicciones registradas aún. Guarda picks en tu boleto y márcalos como ✅ o ❌.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((bet, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderLeft: `4px solid ${bet.status === 'WON' ? 'var(--accent-green)' : 'var(--accent-red)'}`
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{bet.homeTeam} vs {bet.awayTeam}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Pick: <span style={{ color: 'var(--accent-cyan)' }}>{bet.valueBetType}</span> &nbsp;|&nbsp; 
                      Prob: {bet.probability}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: bet.status === 'WON' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {bet.status === 'WON' ? 'ACERTADO' : 'FALLADO'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {new Date(bet.settledAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
