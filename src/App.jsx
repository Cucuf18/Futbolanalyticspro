import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import LeagueSelector from './components/LeagueSelector';
import MetricsTable from './components/MetricsTable';
import H2HViewer from './components/H2HViewer';
import PredictionPanel from './components/PredictionPanel';
import AdBanner from './components/AdBanner';
import PremiumModal from './components/PremiumModal';
import { BetSlipProvider } from './context/BetSlipContext';
import BetSlip from './components/BetSlip';
import HistoryTracker from './components/HistoryTracker';

const LEAGUES = [
  { id: 'PL', name: 'Premier League', country: 'Inglaterra', code: 'ENG' },
  { id: 'PD', name: 'La Liga', country: 'España', code: 'ESP' },
  { id: 'SA', name: 'Serie A', country: 'Italia', code: 'ITA' },
  { id: 'BL1', name: 'Bundesliga', country: 'Alemania', code: 'GER' },
  { id: 'CL', name: 'Champions League', country: 'Europa', code: 'UCL' },
];

function PredictorView({ isPremium, onOpenPremiumModal }) {
  const { routeLeagueId, homeId, awayId } = useParams();
  const selectedLeague = routeLeagueId || 'PL';
  
  const [h2hData, setH2hData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!homeId || !awayId || homeId === awayId) return;

    async function loadMatchDetails() {
      setLoading(true);
      setH2hData(null);
      setPredictionData(null);
      try {
        const [h2hRes, predRes] = await Promise.all([
          fetch(`/api/h2h/${homeId}/${awayId}?leagueId=${selectedLeague}`),
          fetch(`/api/predict/${homeId}/${awayId}?leagueId=${selectedLeague}`),
        ]);
        const h2hJson = await h2hRes.json();
        const predJson = await predRes.json();
        if (h2hJson.success) setH2hData(h2hJson.data);
        if (predJson.success) setPredictionData(predJson.data);
      } catch (err) {
        console.error('Error loading match data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatchDetails();
  }, [homeId, awayId, selectedLeague]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            Cargando historial...
          </div>
        ) : (
          <H2HViewer h2hData={h2hData} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            Ejecutando Simulaciones Monte Carlo...
          </div>
        ) : (
          <PredictionPanel
            predictionData={predictionData}
            isPremium={isPremium}
            onOpenPremiumModal={onOpenPremiumModal}
          />
        )}
      </div>
    </div>
  );
}

function StandingsView() {
  const { routeLeagueId } = useParams();
  const navigate = useNavigate();
  const selectedLeague = routeLeagueId || 'PL';
  
  const [standingsData, setStandingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [localHomeId, setLocalHomeId] = useState(null);
  const [localAwayId, setLocalAwayId] = useState(null);

  useEffect(() => {
    async function loadStandings() {
      setLoading(true);
      try {
        const res = await fetch(`/api/standings/${selectedLeague}`);
        const result = await res.json();
        if (result.success) {
          setStandingsData(result.data);
          // Reset local selections when league changes
          setLocalHomeId(null);
          setLocalAwayId(null);
        }
      } catch (err) {
        console.error('Error loading standings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStandings();
  }, [selectedLeague]);

  const handleSelectHomeTeam = (id) => {
    if (localAwayId === id) setLocalAwayId(null);
    setLocalHomeId(id);
  };

  const handleSelectAwayTeam = (id) => {
    if (localHomeId === id) setLocalHomeId(null);
    setLocalAwayId(id);
  };
  
  const handlePredict = () => {
    if (localHomeId && localAwayId) {
      navigate(`/predict/${selectedLeague}/${localHomeId}/${localAwayId}`);
    }
  };

  if (loading || !standingsData) {
    return <div style={{ textAlign: 'center', padding: '60px 20px' }}>Cargando posiciones...</div>;
  }

  const getTeamName = (id) => {
    return standingsData.teams.find(t => t.id === id)?.shortName || '';
  };

  return (
    <div style={{ position: 'relative', paddingBottom: (localHomeId && localAwayId) ? '80px' : '0' }}>
      <MetricsTable
        standings={standingsData}
        homeTeamId={localHomeId}
        awayTeamId={localAwayId}
        onSelectHomeTeam={handleSelectHomeTeam}
        onSelectAwayTeam={handleSelectAwayTeam}
      />
      
      {localHomeId && localAwayId && (
        <div style={{ 
          position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', 
          zIndex: 100, animation: 'fade-in 0.3s ease-out' 
        }}>
          <button 
            onClick={handlePredict} 
            style={{ 
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', 
              color: '#080c16', padding: '16px 32px', borderRadius: '30px', 
              fontWeight: 800, fontSize: '16px', boxShadow: '0 10px 30px rgba(0, 242, 254, 0.4)', 
              cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '12px'
            }}
          >
            <span>🚀</span>
            Analizar {getTeamName(localHomeId)} vs {getTeamName(localAwayId)}
          </button>
        </div>
      )}
    </div>
  );
}

function PredictorRedirect() {
  const { routeLeagueId } = useParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch(`/api/standings/${routeLeagueId}`);
        const result = await res.json();
        if (result.success && result.data.teams && result.data.teams.length >= 2) {
          navigate(`/predict/${routeLeagueId}/${result.data.teams[0].id}/${result.data.teams[1].id}`, { replace: true });
        } else {
          navigate(`/standings/${routeLeagueId}`, { replace: true });
        }
      } catch (err) {
        navigate(`/standings/${routeLeagueId}`, { replace: true });
      }
    }
    fetchTeams();
  }, [routeLeagueId, navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
      Cargando liga...
    </div>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { routeLeagueId, homeId, awayId } = useParams();
  
  // Extraer liga actual de la URL
  let currentLeague = 'PL';
  const pathParts = location.pathname.split('/');
  if (pathParts[2] && LEAGUES.some(l => l.id === pathParts[2])) {
    currentLeague = pathParts[2];
  }

  const [isPremium, setIsPremium] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);

  const handleSelectLeague = (id) => {
    if (location.pathname.startsWith('/predict')) {
      navigate(`/predict/${id}`);
    } else {
      navigate(`/standings/${id}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        isPremium={isPremium}
        onTogglePremium={(status) => setIsPremium(status)}
        onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
        dataSource={'live'}
      />

      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '24px 16px', flex: 1 }}>
        <div style={{ marginBottom: '20px' }}>
          <LeagueSelector
            leagues={LEAGUES}
            selectedLeague={currentLeague}
            onSelectLeague={handleSelectLeague}
          />
        </div>

        {!isPremium && <AdBanner slotId="top-header-ad" />}

        <div style={{ marginTop: '24px' }}>
          <Routes>
            <Route path="/" element={<StandingsView />} />
            <Route path="/standings" element={<StandingsView />} />
            <Route path="/standings/:routeLeagueId" element={<StandingsView />} />
            <Route path="/predict/:routeLeagueId" element={<PredictorRedirect />} />
            <Route path="/predict/:routeLeagueId/:homeId/:awayId" element={<PredictorView isPremium={isPremium} onOpenPremiumModal={() => setIsPremiumModalOpen(true)} />} />
            <Route path="/tracker" element={<HistoryTracker />} />
          </Routes>
        </div>

        {!isPremium && <AdBanner slotId="bottom-content-ad" />}
      </main>

      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
        <p>FutbolAnalytics Pro — Plataforma de Estadísticas y Modelado Predictivo</p>
      </footer>

      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        onActivatePremium={() => setIsPremium(true)}
      />
    </div>
  );
}

export default function App() {
  return (
    <BetSlipProvider>
      <BrowserRouter>
        <AppLayout />
        <BetSlip />
      </BrowserRouter>
    </BetSlipProvider>
  );
}
