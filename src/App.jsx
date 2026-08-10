import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LeagueSelector from './components/LeagueSelector';
import MetricsTable from './components/MetricsTable';
import H2HViewer from './components/H2HViewer';
import PredictionPanel from './components/PredictionPanel';
import AdBanner from './components/AdBanner';
import PremiumModal from './components/PremiumModal';

export default function App() {
  const [leagues, setLeagues] = useState([
    { id: 'PL', name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra' },
    { id: 'PD', name: 'La Liga', country: '🇪🇸 España' },
    { id: 'SA', name: 'Serie A', country: '🇮🇹 Italia' },
    { id: 'BL1', name: 'Bundesliga', country: '🇩🇪 Alemania' },
    { id: 'CL', name: 'Champions League', country: '🇪🇺 Europa' },
  ]);

  const [selectedLeague, setSelectedLeague] = useState('PL');
  const [standingsData, setStandingsData] = useState(null);
  
  const [homeTeamId, setHomeTeamId] = useState(null);
  const [awayTeamId, setAwayTeamId] = useState(null);

  const [h2hData, setH2hData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);

  const [isPremium, setIsPremium] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch Standings when League Changes
  useEffect(() => {
    async function loadStandings() {
      setLoading(true);
      try {
        const res = await fetch(`/api/standings/${selectedLeague}`);
        const result = await res.json();
        if (result.success) {
          setStandingsData(result.data);
          const teams = result.data.teams || [];
          if (teams.length >= 2) {
            setHomeTeamId(teams[0].id);
            setAwayTeamId(teams[1].id);
          }
        }
      } catch (err) {
        console.error('Failed to load standings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStandings();
  }, [selectedLeague]);

  // Fetch H2H & Prediction when selected teams change
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
        console.error('Failed to load match details:', err);
      }
    }

    loadMatchDetails();
  }, [homeTeamId, awayTeamId, selectedLeague]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Navbar */}
      <Navbar
        isPremium={isPremium}
        onTogglePremium={(status) => setIsPremium(status)}
        onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
      />

      {/* Main App Workspace Container */}
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '24px 16px', flex: 1 }}>
        
        {/* League Filtering Bar */}
        <div style={{ marginBottom: '20px' }}>
          <LeagueSelector
            leagues={leagues}
            selectedLeague={selectedLeague}
            onSelectLeague={(id) => setSelectedLeague(id)}
          />
        </div>

        {/* Modular Monetization Ad Banner (Top Header Slot) */}
        {!isPremium && <AdBanner slotId="top-header-ad" />}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '36px' }} className="pulse-glow">⚽</div>
            <p style={{ marginTop: '12px', fontWeight: 600 }}>Cargando métricas y modelo estadístico...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            
            {/* Standings & Team Metrics Table */}
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

            {/* Split Grid for H2H and Prediction Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
              <H2HViewer h2hData={h2hData} />
              
              <PredictionPanel
                predictionData={predictionData}
                isPremium={isPremium}
                onOpenPremiumModal={() => setIsPremiumModalOpen(true)}
              />
            </div>

            {/* Modular Monetization Ad Banner (Bottom Slot) */}
            {!isPremium && <AdBanner slotId="bottom-content-ad" label="Patrocinador Oficial" />}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
        <p>© 2026 FutbolAnalytics Pro MVP — Diseñado con Arquitectura Escalable de Inteligencia Artificial & Monetización Modular.</p>
      </footer>

      {/* Subscription Upgrade Modal */}
      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        onActivatePremium={() => setIsPremium(true)}
      />

    </div>
  );
}
