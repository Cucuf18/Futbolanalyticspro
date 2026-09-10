import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  env: process.env.NODE_ENV || 'development',
  footballApiKey: process.env.FOOTBALL_API_KEY || '',
  footballApiBaseUrl: process.env.FOOTBALL_API_BASE_URL || 'https://api.football-data.org/v4',
  apiFootballKey: process.env.API_FOOTBALL_KEY || '',
  apiFootballBaseUrl: process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io',
  // Las 10 competiciones de club que cubre el plan gratuito de
  // football-data.org. Cuantas mas ligas domesticas, mas equipos de
  // Champions tienen historial real en lugar de tratarse como promedio.
  supportedLeagues: [
    { id: 'PL', name: 'Premier League', country: 'Inglaterra', code: 'ENG' },
    { id: 'PD', name: 'La Liga', country: 'España', code: 'ESP' },
    { id: 'SA', name: 'Serie A', country: 'Italia', code: 'ITA' },
    { id: 'BL1', name: 'Bundesliga', country: 'Alemania', code: 'GER' },
    { id: 'FL1', name: 'Ligue 1', country: 'Francia', code: 'FRA' },
    { id: 'DED', name: 'Eredivisie', country: 'Paises Bajos', code: 'NED' },
    { id: 'PPL', name: 'Primeira Liga', country: 'Portugal', code: 'POR' },
    { id: 'ELC', name: 'Championship', country: 'Inglaterra', code: 'EFL' },
    { id: 'BSA', name: 'Brasileirao', country: 'Brasil', code: 'BRA' },
    { id: 'CL', name: 'Champions League', country: 'Europa', code: 'UCL' },
  ],
};
