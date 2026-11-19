# Backtest contra el mercado (cuotas reales)

**Fecha:** 17/11/2026 · **Datos:** football-data.co.uk (temporadas 2023/24, 2024/25 y 2025/26)
**Ligas:** Premier League, Championship, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga
**Método:** walk-forward (cada partido se predice solo con lo ocurrido antes). 7.345 partidos predichos; 5.893 con cuota de cierre de Pinnacle.
**Script:** `node scripts/backtest-market.mjs <carpeta-temp-1> <carpeta-temp-2> <carpeta-temp-3>`

## Veredicto

**El modelo no tiene ventaja sobre el mercado.** Predice peor que Pinnacle y las apuestas que "ve" con valor pierden más dinero que apostar a ciegas.

## Quién predice mejor (menor = mejor)

| Mercado | Modelo | Pinnacle (cierre) | Diferencia | Conclusión |
|---|---|---|---|---|
| 1X2 · logloss | 1.0033 | 0.9654 | +0.038 (IC95 0.032–0.043) | Mercado mejor, significativo |
| 1X2 · RPS | 0.2044 | 0.1929 | +0.012 | Mercado mejor, significativo |
| Más/Menos 2.5 · logloss | 0.6849 | 0.6675 | +0.017 | Mercado mejor, significativo |

Referencia ingenua (frecuencias globales H/D/A): 1.0752. El modelo recorre ~66% del camino entre "ingenuo" y "mercado".
El mercado es mejor en las 8 ligas y en las 3 temporadas. Mezclar modelo y mercado nunca mejora al mercado solo (el mejor peso para el modelo es 0).

## Apuestas simuladas (1 unidad, edge = prob_modelo × cuota − 1)

| Cuota usada | Umbral edge | Apuestas | ROI | IC95 |
|---|---|---|---|---|
| Apertura Bet365 | > 0% | 5.669 | −13.7% | −18.0% / −9.4% |
| Apertura Bet365 | > 5% | 5.116 | −14.0% | −18.4% / −9.3% |
| Cierre Pinnacle | > 5% | 5.521 | −12.1% | −16.6% / −7.4% |
| Mejor cuota entre casas | > 5% | 5.540 | −11.0% | −15.7% / −6.1% |
| **Control: apostar a todo** (Bet365 apertura) | — | — | **−7.4%** | (margen de la casa) |

El CLV medio es negativo en todos los casos (−1.7% a −7.6%): las cuotas que el modelo "encuentra" son peores que la probabilidad justa al cierre. A más edge declarado, peor ROI: señal de que las discrepancias con el mercado son ruido del modelo, no información.

## Calibración (1X2, todas las opciones)

El modelo comprime las probabilidades hacia el centro: **subestima a los favoritos** (dice 71.5% cuando ocurre 80.4%) y **sobrestima a los no favoritos** (dice 11.3% cuando ocurre 7.0%). Por eso sus "ventajas" se concentran en visitantes y "más de 2.5" (2.284 visitante, 1.404 over, 1.180 local, 144 empate, 104 under entre las apuestas con edge > 5%).

Un reajuste simple por temperatura, ajustado con 2023/24–2024/25 y evaluado solo en 2025/26, apenas mejora el logloss (1.0149 → 1.0132) y **no mejora el ROI** (−18.5% con edge > 5%). El problema no es solo de calibración.

## Límites de este análisis

- Cuotas de Bet365/Pinnacle (Europa), no de Betano Perú; Betano suele cobrar más margen, así que el resultado real sería algo peor.
- Las probabilidades del modelo se usan como las muestra la página (porcentajes enteros).
- Pinnacle al cierre no está disponible para todos los partidos de 2025/26.
- Solo se prueban 1X2 y Más/Menos 2.5. Córners, tarjetas y tiros no tienen cuota en estos archivos, así que no se puede decir si ahí hay ventaja.
- Es una versión del modelo en un periodo concreto; cualquier mejora debe volver a pasar esta misma prueba.
