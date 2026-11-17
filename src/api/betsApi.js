// Cliente de "Mis apuestas reales". La clave se guarda solo en este
// navegador (localStorage) y viaja en la cabecera x-bets-token.
const KEY = 'bets_token';

export function getToken() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* almacenamiento bloqueado */ }
}

async function call(path, options = {}) {
  const res = await fetch(`/api/bets${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-bets-token': getToken(), ...(options.headers || {}) },
  });
  let data = {};
  try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function probeApiFootball() {
  const res = await fetch('/api/diag/api-football', { headers: { 'x-bets-token': getToken() } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const betsApi = {
  list: () => call(''),
  add: (bet) => call('', { method: 'POST', body: JSON.stringify(bet) }),
  resolve: (id, status, payout) =>
    call(`/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status, ...(payout != null ? { payout } : {}) }) }),
  remove: (id) => call(`/${id}`, { method: 'DELETE' }),
  setBankroll: (initialBankroll) => call('/settings', { method: 'PUT', body: JSON.stringify({ initialBankroll }) }),
  settleNow: () => call('/settle', { method: 'POST' }),
};
