import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/* Iconos de trazo simple, heredan el color del texto */
const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const I = {
  table: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></Icon>,
  target: <Icon><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></Icon>,
  ticket: <Icon><path d="M4 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h16v-2a2 2 0 0 1 0-4v0a2 2 0 0 1 0-4V6H4z" /><path d="M14 6v12" strokeDasharray="2 3" /></Icon>,
  ball: <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Icon>,
  chart: <Icon><path d="M4 20V8M10 20V4M16 20v-9M22 20H2" /></Icon>,
  chevron: <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>,
};

export default function Sidebar({ leagues, currentLeague, onSelectLeague, isFull, onToggleFull, theme, onSetTheme, open }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inFootball = pathname === '/' || pathname.startsWith('/standings') || pathname.startsWith('/predict') || pathname.startsWith('/combinadas');
  const [leaguesOpen, setLeaguesOpen] = useState(true);

  const onLeagues = pathname === '/' || pathname.startsWith('/standings');
  const onPredict = pathname.startsWith('/predict');

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Navegación principal">
      <div className="brand">
        <div className="brand-mark">FA</div>
        <div>
          <div className="brand-name">FutbolAnalytics</div>
          <div className="brand-tag">Estadística, mercado y tu rendimiento real</div>
        </div>
      </div>

      <div className="side-label">Fútbol</div>
      <button className={`side-link${onLeagues ? ' active' : ''}`} onClick={() => { navigate(`/standings/${currentLeague}`); setLeaguesOpen((v) => (onLeagues ? !v : true)); }} aria-expanded={leaguesOpen}>
        {I.table}<span>Ligas y tablas</span>{React.cloneElement(I.chevron, { className: `chev${leaguesOpen && inFootball ? ' open' : ''}` })}
      </button>
      {leaguesOpen && inFootball && (
        <div className="league-list">
          {leagues.map((l) => (
            <button key={l.id} className={`league-item${currentLeague === l.id ? ' active' : ''}`} onClick={() => onSelectLeague(l.id)}>
              <span className="league-code">{l.code}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
      <button className={`side-link${onPredict ? ' active' : ''}`} onClick={() => navigate(`/predict/${currentLeague}`)} title="Elige un partido de la liga seleccionada">
        {I.target}<span>Predictor</span>
      </button>
      <button className={`side-link${pathname.startsWith('/combinadas') ? ' active' : ''}`} onClick={() => navigate('/combinadas')}>
        {I.ticket}<span>Boleto</span>
      </button>

      <div className="side-label">Baloncesto</div>
      <button className={`side-link${pathname.startsWith('/baloncesto') ? ' active' : ''}`} onClick={() => navigate('/baloncesto')}>
        {I.ball}<span>NBA</span>
      </button>

      <div className="side-label">Mi banca</div>
      <button className={`side-link${pathname.startsWith('/tracker') ? ' active' : ''}`} onClick={() => navigate('/tracker')}>
        {I.chart}<span>Rendimiento</span>
      </button>

      <div className="side-foot">
        <div className="side-status"><span className="dot" /> Datos en vivo</div>
        <div className="side-row">
          <span>Tema</span>
          <div className="theme-toggle" role="group" aria-label="Tema">
            <button className={theme === 'light' ? 'on' : ''} onClick={() => onSetTheme('light')}>Claro</button>
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => onSetTheme('dark')}>Oscuro</button>
          </div>
        </div>
        <div className="side-row" title="Muestra todos los mercados del predictor sin bloqueos">
          <span>Vista completa</span>
          <button className={`switch${isFull ? ' on' : ''}`} onClick={() => onToggleFull(!isFull)} role="switch" aria-checked={isFull} aria-label="Vista completa" />
        </div>
      </div>
    </aside>
  );
}
