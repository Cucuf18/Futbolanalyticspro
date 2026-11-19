import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar({ isPremium, onTogglePremium, onOpenPremiumModal, dataSource }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isTracker = location.pathname === '/tracker';
  const isCombinadas = location.pathname === '/combinadas';

  const path = location.pathname;
  const tabs = [
    { key: 'liga', label: 'Liga', active: path.startsWith('/standings') || path === '/', go: () => navigate('/standings') },
    {
      key: 'pred', label: 'Predictor', active: path.startsWith('/predict'),
      go: () => { if (!path.startsWith('/predict')) navigate('/predict/PL/65/66'); },
      title: !path.startsWith('/predict') ? 'Selecciona un partido desde la tabla' : '',
    },
    { key: 'bask', label: 'Baloncesto', active: path.startsWith('/baloncesto'), go: () => navigate('/baloncesto') },
    { key: 'boleto', label: 'Boleto', active: isCombinadas, go: () => navigate('/combinadas') },
    { key: 'rend', label: 'Rendimiento', active: isTracker, go: () => navigate('/tracker') },
  ];

  return (
    <header className="glass-card" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '14px clamp(16px, 2.5vw, 56px)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ width: '100%', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(145deg, #1b2a45 0%, #14203a 100%)',
              border: '1px solid rgba(108, 196, 240, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800,
              color: '#6cc4f0',
              boxShadow: '0 6px 18px -6px rgba(108, 196, 240, 0.45)',
              letterSpacing: '-0.04em',
              fontFamily: 'var(--font-heading)',
            }}>
              FA
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1.1 }}>
                Futbol<span className="gradient-text">Analytics</span>
                <span style={{ fontSize: '11px', background: 'rgba(108,196,240,0.1)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '8px', border: '1px solid rgba(108,196,240,0.28)', marginLeft: '8px', fontWeight: 600, letterSpacing: '0.04em' }}>PRO</span>
              </h1>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Estadística, mercado y tu rendimiento real</p>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Secciones">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={t.go}
                className={`nav-tab${t.active ? ' active' : ''}`}
                title={t.title}
                aria-current={t.active ? 'page' : undefined}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Status & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          
          {/* Data Source Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: dataSource === 'live' ? 'rgba(67, 217, 160, 0.1)' : 'rgba(242, 184, 75, 0.1)',
            border: `1px solid ${dataSource === 'live' ? 'rgba(67, 217, 160, 0.25)' : 'rgba(242, 184, 75, 0.25)'}`,
            fontSize: '12px',
            color: dataSource === 'live' ? 'var(--accent-green)' : 'var(--accent-gold)',
            fontWeight: 500,
          }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: dataSource === 'live' ? 'var(--accent-green)' : 'var(--accent-gold)',
              display: 'inline-block',
              boxShadow: dataSource === 'live' ? '0 0 6px rgba(67, 217, 160,0.6)' : 'none',
            }} />
            {dataSource === 'live' ? 'Datos en Vivo' : 'Datos Simulados'}
          </div>

          {/* Premium Simulation Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 22, 41, 0.9)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            padding: '3px 4px',
          }}>
            <button
              onClick={() => onTogglePremium(false)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 600,
                background: !isPremium ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: !isPremium ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              Gratuito
            </button>
            <button
              onClick={() => onTogglePremium(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 700,
                background: isPremium ? 'linear-gradient(135deg, #ffe066 0%, #f2b84b 100%)' : 'transparent',
                color: isPremium ? '#000' : 'var(--accent-gold)',
                boxShadow: isPremium ? '0 2px 10px rgba(242, 184, 75, 0.4)' : 'none',
              }}
            >
              Premium
            </button>
          </div>

          {/* Upgrade CTA */}
          {!isPremium && (
            <button
              onClick={onOpenPremiumModal}
              style={{
                background: 'linear-gradient(135deg, #6cc4f0 0%, #6e9bf5 100%)',
                color: '#080c16',
                fontWeight: 700,
                fontSize: '13px',
                padding: '8px 16px',
                borderRadius: '12px',
                boxShadow: '0 4px 14px rgba(108, 196, 240, 0.3)',
              }}
            >
              Desbloquear IA
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
