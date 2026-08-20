import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import LeagueSelector from './components/LeagueSelector';
import MetricsTable from './components/MetricsTable';
import H2HViewer from './components/H2HViewer';
import PredictionPanel from './components/PredictionPanel';
import AdBanner from './components/AdBanner';
import PremiumModal from './components/PremiumModal';
import { BetSlipProvider } from './context/BetSlipContext';
import BetSlip from './components/BetSlip';

const LEAGUES = [
  { id: 'PL', name: 'Premier League', country: 'Inglaterra', code: 'ENG' },
  { id: 'PD', name: 'La Liga', country: 'España', code: 'ESP' },
  { id: 'SA', name: 'Serie A', country: 'Italia', code: 'ITA' },
  { id: 'BL1', name: 'Bundesliga', country: 'Alemania', code: 'GER' },
  { id: 'CL', name: 'Champions League', country: 'Europa', code: 'UCL' },
];

function DashboardContent() {
  const { routeLeagueId, homeId, awayId } = useParams();
  const navigate = useNavigate();
  
  const selectedLeague = routeLeagueId || 'PL';
  
  const [standingsData, setStandingsData] = useState(null);
  const [h2hData, setH2hData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('simulated');

  // Fetch standings when league changes
  useEffect(() => {
    async function loadStandings() {
      setLoading(true);
      try {
        const res = await fetch(`/api/standings/${selectedLeague}`);
        const result = await res.json();
        if (result.success) {
          setStandingsData(result.data);
          setDataSource(result.data.dataSource || 'simulated');
          const teams = result.data.teams || [];
          
          // Si no hay ids en la URL, auto-seleccionar los dos primeros y navegar
          if (!homeId || !awayId) {
            if (teams.length >= 2) {
              navigate(`/predict/${selectedLeague}/${teams[0].id}/${teams[1].id}`, { replace: true });
            }
          }
        }
      } catch (err) {
        console.error('Error loading standings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStandings();
  }, [selectedLeague, homeId, awayId, navigate]);

  // Fetch H2H & prediction when teams change (basado en la URL)
  useEffect(() => {
    if (!homeId || !awayId || homeId === awayId) return;

    async function loadMatchDetails() {
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
      }
    }
    loadMatchDetails();
  }, [homeId, awayId, selectedLeague]);

  const handleSelectLeague = (id) => {
    navigate(`/predict/${id}`);
  };

  const handleSelectHomeTeam = (id) => {
    let newAway = awayId;
    if (id === awayId) newAway = homeId;
    navigate(`/predict/${selectedLeague}/${id}/${newAway}`);
  };

  const handleSelectAwayTeam = (id) => {
    let newHome = homeId;
    if (id === homeId) newHome = awayId;
    navigate(`/predict/${selectedLeague}/${newHome}/${id}`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        isPremium={isPremium}
        onTogglePremium={(status) => setIsPremium(status)}
        onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
        dataSource={dataSource}
      />

      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '24px 16px', flex: 1 }}>
        <div style={{ marginBottom: '20px' }}>
          <LeagueSelector
            leagues={LEAGUES}
            selectedLeague={selectedLeague}
            onSelectLeague={handleSelectLeague}
          />
        </div>

        {!isPremium && <AdBanner slotId="top-header-ad" />}

        {loading && (!standingsData) ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              border: '3px solid var(--glass-border)',
              borderTopColor: 'var(--accent-cyan)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ fontWeight: 600 }}>Cargando datos y modelo estadistico...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            <MetricsTable
              standings={standingsData}
              homeTeamId={Number(homeId)}
              awayTeamId={Number(awayId)}
              onSelectHomeTeam={handleSelectHomeTeam}
              onSelectAwayTeam={handleSelectAwayTeam}
            />

            {(homeId && awayId) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                <H2HViewer h2hData={h2hData} />
                <PredictionPanel
                  predictionData={predictionData}
                  isPremium={isPremium}
                  onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
                />
              </div>
            )}

            {!isPremium && <AdBanner slotId="bottom-content-ad" />}
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
        <p>FutbolAnalytics Pro — Plataforma de Estadisticas y Modelado Predictivo</p>
      </footer>

      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        onActivatePremium={() => setIsPremium(true)}
      />
    </div>
  );
}

import HistoryTracker from './components/HistoryTracker';

export default function App() {
  return (
    <BetSlipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardContent />} />
          <Route path="/predict/:routeLeagueId" element={<DashboardContent />} />
          <Route path="/predict/:routeLeagueId/:homeId/:awayId" element={<DashboardContent />} />
          <Route path="/tracker" element={<HistoryTracker />} />
        </Routes>
        <BetSlip />
      </BrowserRouter>
    </BetSlipProvider>
  );
}
