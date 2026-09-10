import React, { useState, useEffect } from 'react';

/**
 * Informe de rendimiento real del motor, dentro de la web.
 *
 * Antes esto solo se podia ver corriendo un script en la terminal. Aqui
 * se muestra el mismo dato que mide el backtest automatico: cada
 * prediccion que genera la pagina se guarda y se resuelve sola contra el
 * resultado del partido.
 *
 * Lo importante no es el acierto global sino la CURVA DE CALIBRACION:
 * cuando el modelo dice 75%, ¿acierta el 75%?
 */

const card = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--glass-border)',
  borderRadius: '12px',
  padding: '16px',
};

function Stat({ label, value, color, hint }) {
  return (
    <div style={card}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 900, color: color || 'var(--text-primary)', marginTop: '4px' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>}
    </div>
  );
}

function Table({ title, rows, keyLabel, note }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '4px' }}>{title}</h3>
      {note && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>{note}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '460px' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', fontWeight: 700 }}>{keyLabel}</th>
              <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Picks</th>
              <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Acierta</th>
              <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Decia</th>
              <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Desvio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const gap = r.avgPredicted !== null && r.hitRate !== null ? r.avgPredicted - r.hitRate : null;
              const gapColor = gap === null ? 'var(--text-muted)'
                : Math.abs(gap) <= 3 ? 'var(--accent-green)'
                : Math.abs(gap) <= 7 ? 'var(--accent-gold)' : 'var(--accent-red)';
              return (
                <tr key={r.key || r.bucket} style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '8px', fontWeight: 700 }}>{r.key || r.bucket}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.total}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800 }}>
                    {r.hitRate === null ? '—' : `${r.hitRate}%`}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {r.avgPredicted === null ? '—' : `${r.avgPredicted}%`}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: gapColor }}>
                    {gap === null ? '—' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BacktestReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  const load = () => {
    fetch('/api/backtest/report')
      .then((r) => r.json())
      .then((d) => { if (d.success) setReport(d.report); })
      .catch((e) => console.error('Error cargando el informe:', e))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const settleNow = () => {
    setSettling(true);
    fetch('/api/backtest/settle', { method: 'POST' })
      .then((r) => r.json())
      .then(() => load())
      .catch((e) => console.error('Error resolviendo:', e))
      .finally(() => setSettling(false));
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Cargando informe del motor...</div>;
  }
  if (!report) return null;

  const r = report.resumen;
  const gap = r.avgPredicted !== null && r.hitRate !== null ? r.avgPredicted - r.hitRate : null;
  const calibrado = gap === null ? '' : Math.abs(gap) <= 3 ? 'bien calibrado' : gap > 0 ? 'sobreconfiado' : 'demasiado prudente';

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '6px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Rendimiento real del motor</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Cada prediccion que genera la web se guarda sola y se resuelve contra el resultado del
            partido. Esto no depende de lo que marques a mano en el boleto.
          </p>
        </div>
        <button
          onClick={settleNow}
          disabled={settling}
          style={{
            background: 'rgba(0,242,254,0.1)', border: '1px solid var(--accent-cyan)',
            color: 'var(--accent-cyan)', padding: '8px 14px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 700, cursor: settling ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {settling ? 'Comprobando...' : 'Comprobar ahora'}
        </button>
      </div>

      {r.partidosResueltos === 0 ? (
        <div style={{
          marginTop: '16px', padding: '16px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--glass-border)',
          fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          Todavia no hay partidos resueltos. Hay <strong>{r.prediccionesGuardadas}</strong> predicciones
          guardadas esperando a que se jueguen los partidos. El servidor las comprueba solo cada 6 horas,
          asi que esta tabla se ira llenando sin que tengas que hacer nada.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '18px' }}>
            <Stat label="Acierto real" value={`${r.hitRate ?? '—'}%`} color="var(--accent-green)" hint={`${r.won} de ${r.total} picks`} />
            <Stat label="El modelo decia" value={`${r.avgPredicted ?? '—'}%`} color="var(--accent-cyan)" />
            <Stat
              label="Desvio"
              value={gap === null ? '—' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)}`}
              color={gap === null ? undefined : Math.abs(gap) <= 3 ? 'var(--accent-green)' : 'var(--accent-red)'}
              hint={calibrado}
            />
            <Stat label="Partidos resueltos" value={r.partidosResueltos} hint={`${r.picksNoEvaluables} picks no evaluables`} />
          </div>

          <Table
            title="Curva de calibracion"
            note="Lo prometido frente a lo cumplido. Un desvio pequeno significa que puedes fiarte del porcentaje."
            rows={report.calibracion.filter((b) => b.total > 0)}
            keyLabel="Rango"
          />
          <Table title="Por mercado" rows={report.porMercado} keyLabel="Mercado" />
          <Table title="Por nivel de riesgo" rows={report.porNivelDeRiesgo} keyLabel="Nivel" />
          <Table title="Por liga" rows={report.porLiga} keyLabel="Liga" />
          <Table
            title="Por calidad de datos"
            note="Si el motor no acierta menos con datos pobres, esa metrica no esta midiendo nada."
            rows={report.porCalidadDeDatos}
            keyLabel="Calidad"
          />
        </>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '18px', lineHeight: 1.5 }}>
        {report.nota}
      </div>
    </div>
  );
}
