# Laboratorio de mejoras del modelo (26/11/2026)

**Método:** walk-forward (cada partido se predice solo con lo ocurrido antes). Los parámetros se ajustan en la temporada 2024/25 y la prueba final es la 2025/26, que no se toca al ajustar. 8 ligas, 3 temporadas, cuotas de football-data.co.uk. Referencia: promedio del mercado al cierre, en los mismos partidos.
**Código:** `ml/lab.py` y `ml/lab2.py` (Python: numpy, pandas, scikit-learn). Los CSV se leen de las carpetas indicadas al inicio de `lab.py`.

## Resultado principal (1X2, temporada 2025/26; error logloss, menor = mejor)

| Modelo | Diferencia con el mercado |
|---|---|
| Motor actual de la página | +0.0297 |
| Solo goles, ajustado (vida media 240 días, prior 4) | +0.0182 |
| Goles + tiros (xG estimado), ajustado | **+0.0142** (IC95 +0.0087 / +0.0197) |

La distancia con el mercado se reduce a la mitad con tiros y casi 40% solo con goles. **Sigue siendo peor que el mercado, de forma significativa.**
Del cambio total (en la temporada de ajuste): ~70% viene de la estructura (vida media larga, prior pequeño) y ~30% de mezclar tiros y de la intensidad de diferencias.

## Más/menos 2.5 goles
Modelo nuevo 0.6858 vs mercado 0.6739 (+0.0119). Solo goles: 0.6872 (+0.0134).

## Lo que NO ayudó
- **Gradient boosting** sobre las mismas estadísticas: 1.0052 (peor que el modelo de goles, 0.9946).
- **Regresión logística**: 0.9967 (igual).
- **Calibración que se reajusta sola**: sin cambios (la temperatura óptima fue 1.0 todo el tiempo: el modelo ya está calibrado).
- **Mezclar con el mercado de apertura**: el mejor peso para el modelo es 0; cualquier mezcla empeora.

## Apuestas simuladas (2025/26, cuota de apertura Bet365)
| Estrategia | Apuestas | ROI | IC95 | CLV |
|---|---|---|---|---|
| Control: apostar a todo | — | −7.6% | — | — |
| Modelo nuevo, ventaja > 5% | 1.378 | −12.6% | −21.4% / −3.7% | −4.3% |
| Gradient boosting, ventaja > 5% | 2.178 | −12.3% | −19.0% / −5.4% | −4.8% |
| Modelo nuevo, ventaja > 8% | 1.064 | −15.8% | — | −4.1% |
| Modelo nuevo, ventaja > 12% | 741 | −14.6% | — | −3.8% |

## Por liga (modelo con tiros, diferencia con el mercado)
PL +0.007 · Championship +0.022 · La Liga +0.017 · Serie A +0.015 · Bundesliga +0.017 · Ligue 1 +0.020 · Eredivisie −0.004 · Primeira +0.015.
La Eredivisie sale ligeramente mejor que el mercado con ~300 partidos: con 8 ligas probadas es esperable que alguna salga así por azar; no es un hallazgo.

## Límites
Un solo año de ajuste y uno de prueba; ocho ligas; xG estimado a partir de tiros (el xG real no está en estos archivos); la fuente en vivo (football-data.org) no trae tiros, así que la parte de tiros no se puede usar tal cual en la web.

---

## Aplicado en producción: modelo de goles v2 (27/11/2026)

Se llevó la versión **solo con goles** al motor (`server/services/goalsModelV2.js`). Sustituye al esquema anterior de goles esperados (Elo + racha + fatiga + H2H + encogimiento manual de 0.31). Si no hay historial suficiente (menos de 8 partidos de alguno de los equipos) el motor usa su camino anterior.
**Para volver al modelo anterior sin tocar código:** variable de entorno `GOALS_MODEL=v1` en Render.

Medido con el motor real y los mismos 7.345 partidos (`scripts/backtest-market.mjs`), diferencia de error con el mercado en 1X2:

| Temporada | Motor anterior | Motor v2 |
|---|---|---|
| 2023/24 | +0.0473 | +0.0328 |
| 2024/25 | +0.0280 | +0.0194 |
| 2025/26 | +0.0297 | **+0.0169** (IC95 +0.0104 / +0.0229) |

- Mejora en las 3 temporadas. **Sigue siendo peor que el mercado.**
- **Más/menos 2.5 empeora un poco:** +0.0143 → +0.0164. Ese mercado prefería el encogimiento fuerte que se quitó.
- Calibración de los picks verificables (desvío entre lo que dice y lo que acierta): total +0.4 → +0.1; goles +1.1 → +0.2; handicap −2.2 → −0.8; resultado −8.2 → −4.3. No hay señal de que reaparezca la sobreconfianza en el handicap.
- El motor registra con qué modelo se hizo cada predicción (`model: v1 | v2`) y el informe de rendimiento las separa, para comparar con partidos reales.
- El historial por equipo en vivo ahora mira ~2 temporadas (760 días, hasta 100 partidos) en lugar de 420 días y 60 partidos.

**No cambia:** el modelo sigue sin dar ventaja apostando (ver BACKTEST_MERCADO.md).

---

## Experimento: aprender de las cuotas pasadas para parecerse al mercado (27/11/2026)

**Idea:** cada equipo recibe un rating que se ajusta para reproducir las probabilidades que el mercado dio en sus partidos anteriores (sin usar resultados). Luego se predice el siguiente partido con esos ratings, sin mirar sus cuotas. Código: `ml/market_ratings.py`.
**Método:** ritmo de aprendizaje y constante de empate elegidos con 2024/25; prueba final en 2025/26 (n=2.916 partidos, 1X2, mercado de cierre como referencia).

| Modelo | Diferencia de error con el mercado | Distancia media al mercado |
|---|---|---|
| Motor anterior (v1) | +0.0297 | 5.00 puntos |
| Motor v2 (goles) | +0.0169 | 4.05 puntos |
| **Ratings aprendidos de las cuotas** | **+0.0067** (IC95 +0.0027 / +0.0108) | **2.93 puntos** |
| Mezcla 85% cuotas / 15% goles | +0.0065 | 2.71 puntos |

- Se acerca mucho más al mercado, pero **sigue siendo peor de forma significativa**.
- Una vez que se aprende de las cuotas, el modelo basado en resultados casi no aporta (la mezcla mejora apenas 0.0002).
- Apuestas simuladas (1X2, ventaja > 5%, apertura Bet365): ROI −5.3% (IC95 −16.2% / +5.7%) frente a −7.6% de apostar a todo; CLV −3.0%. No hay evidencia de ventaja: el intervalo es muy ancho y el CLV es negativo.
- **Requisito:** necesita el historial de cuotas de los partidos ya jugados (los CSV gratuitos de football-data.co.uk, que se actualizan cada semana). No sirve para ligas sin esos archivos.
