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
