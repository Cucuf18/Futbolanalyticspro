import fetch from 'node-fetch';

async function testApi() {
  const res = await fetch('https://api.football-data.org/v4/teams/86/matches?status=FINISHED&limit=10', {
    headers: { 'X-Auth-Token': '95a1d0bcff25476a8d59b718a5aff608' }
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data:', JSON.stringify(data).substring(0, 200));
}

testApi();
