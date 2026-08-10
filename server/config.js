import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  env: process.env.NODE_ENV || 'development',
  footballApiKey: process.env.FOOTBALL_API_KEY || '',
  footballApiBaseUrl: process.env.FOOTBALL_API_BASE_URL || 'https://api.football-data.org/v4',
  supportedLeagues: [
    { id: 'PL', name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra', code: 'EPL' },
    { id: 'PD', name: 'La Liga', country: '🇪🇸 España', code: 'ESP' },
    { id: 'SA', name: 'Serie A', country: '🇮🇹 Italia', code: 'ITA' },
    { id: 'BL1', name: 'Bundesliga', country: '🇩🇪 Alemania', code: 'GER' },
    { id: 'CL', name: 'Champions League', country: '🇪🇺 Europa', code: 'UCL' },
  ],
};
