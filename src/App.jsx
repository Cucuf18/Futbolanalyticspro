import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LeagueSelector from './components/LeagueSelector';
import MetricsTable from './components/MetricsTable';
import H2HViewer from './components/H2HViewer';
import PredictionPanel from './components/PredictionPanel';
import AdBanner from './components/AdBanner';
import PremiumModal from './components/PremiumModal';

const LEAGUES = [
  { id: 'PL', name: 'Premier League', country: 'Inglaterra', code: 'ENG' },
  { id: 'PD', name: 'La Liga', country: 'España', code: 'ESP' },
  { id: 'SA', name: 'Serie A', country: 'Italia', code: 'ITA' },
  { id: 'BL1', name: 'Bundesliga', country: 'Alemania', code: 'GER' },
  { id: 'CL', name: 'Champions League', country: 'Europa', code: 'UCL' },
];

export default function App() {
  const [selectedLeague, setSelectedLeague] = useState('PL');
  const [standingsData, setStandingsData] = useState(null);
  const [homeTeamId, setHomeTeamId] = useState(null);
  const [awayTeamId, setAwayTeamId] = useState(null);
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
      setH2hData(null);
      setPredictionData(null);
      try {
        const res = await fetch(`/api/standings/${selectedLeague}`);
        const result = await res.json();
        if (result.success) {
          setStandingsData(result.data);
          setDataSource(result.data.dataSource || 'simulated');
          const teams = result.data.teams || [];
          if (teams.length >= 2) {
            setHomeTeamId(teams[0].id);
            setAwayTeamId(teams[1].id);
          }
        }
      } catch (err) {
        console.error('Error loading standings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStandings();
  }, [selectedLeague]);

  // Fetch H2H & prediction when teams change
  useEffect(() => {
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return;

    async function loadMatchDetails() {
      try {
        const [h2hRes, predRes] = await Promise.all([
          fetch(`/api/h2h/${homeTeamId}/${awayTeamId}?leagueId=${selectedLeague}`),
          fetch(`/api/predict/${homeTeamId}/${awayTeamId}?leagueId=${selectedLeague}`),
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
  }, [homeTeamId, awayTeamId, selectedLeague]);

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
            onSelectLeague={(id) => setSelectedLeague(id)}
          />
        </div>

        {!isPremium && <AdBanner slotId="top-header-ad" />}

        {loading ? (
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
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
              onSelectHomeTeam={(id) => {
                if (id === awayTeamId) setAwayTeamId(homeTeamId);
                setHomeTeamId(id);
              }}
              onSelectAwayTeam={(id) => {
                if (id === homeTeamId) setHomeTeamId(awayTeamId);
                setAwayTeamId(id);
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
              <H2HViewer h2hData={h2hData} />
              <PredictionPanel
                predictionData={predictionData}
                isPremium={isPremium}
                onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
              />
            </div>

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
