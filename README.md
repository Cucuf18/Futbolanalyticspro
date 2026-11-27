# ⚽ FutbolAnalytics Pro - Dashboard de Estadísticas & Modelado Predictivo AI (MVP)

Un dashboard web moderno, responsivo y listo para monetizar que procesa estadísticas de fútbol de distintas ligas europeas, genera probabilidades predictivas mediante la **Distribución de Poisson** y **Expected Goals (xG)**, e integra slots de publicidad modular y paywall condicional para usuarios Premium.

---

## 📁 Estructura del Proyecto (Árbol de Directorios Exacto)

```text
intento-de-ganar-dinero/
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Filtro robusto de git (node_modules, .env, dist, etc.)
├── index.html                  # Plantilla HTML con tipografía Google Fonts (Outfit / Inter)
├── package.json                # Manifiesto de dependencias y scripts concurrentes
├── README.md                   # Documentación técnica y guía de ejecución
├── vite.config.js              # Configuración de Vite con Proxy para Express API
│
├── server/                     # Backend API Node.js & Lógica de Datos
│   ├── config.js               # Variables de entorno y ligas soportadas
│   ├── index.js                # Servidor Express API (Endpoints /api/...)
│   └── services/
│       ├── predictorEngine.js  # Motor matemático (Poisson, xG, Dixon-Coles, Form decay)
│       └── sportsApi.js        # Consumo de API de fútbol con fallback a simulador real-time
│
└── src/                        # Frontend UI (React + Glassmorphic Dark Design)
    ├── main.jsx                # Punto de entrada de React
    ├── App.jsx                 # Estado global de la aplicación y layout principal
    ├── index.css               # Sistema de diseño CSS Vanilla (Glassmorphism, tokens HSL)
    └── components/
        ├── AdBanner.jsx        # Componente modular aislado para banners AdSense / Afiliados
        ├── H2HViewer.jsx       # Histórico cara a cara (H2H) con barras de distribución
        ├── LeagueSelector.jsx  # Selector interactivo de competencias (EPL, La Liga, Serie A, etc.)
        ├── MetricsTable.jsx    # Tabla de posiciones, xG, racha reciente y selector de partido
        ├── Navbar.jsx          # Encabezado con estado API y Switch interactivo de usuario Premium
        ├── PredictionPanel.jsx # Panel de predicción IA con Gated Paywall para usuarios gratis
        └── PremiumModal.jsx    # Modal de actualización a membresía Premium
```

---

## ⚡ Comandos de Terminal para Inicializar y Probar Localmente

### 1. Instalación de Dependencias
Abre una terminal en la raíz del proyecto y ejecuta:

```bash
npm install
```

### 2. (Opcional) Configuración de Variables de Entorno
Puedes duplicar `.env.example` para crear tu archivo `.env`:

```bash
cp .env.example .env
```

### 3. Ejecución del Entorno de Desarrollo (Concurrentemente)
Ejecuta tanto el Servidor Express (puerto `3001`) como el cliente React con Vite (puerto `5173`) con un solo comando:

```bash
npm run dev
```

Una vez ejecutado:
- **Frontend App**: Abre [http://localhost:5173](http://localhost:5173) en tu navegador.
- **Backend API**: Abre [http://localhost:3001/api/health](http://localhost:3001/api/health) para verificar el estado de la API.

---

## 💡 Características Clave & Monetización
1. **Modelado Estadístico Predictivo**:
   - Probabilidades de Victoria Local, Empate y Victoria Visitante.
   - Marcador más probable y matriz de goles esperados (xG).
   - Cuota mínima recomendada y comprobador de valor: el "valor" solo se declara frente a la **cuota real** de tu casa, nunca frente a una cuota inventada por el propio modelo.
2. **Sistema de Monetización Doble**:
   - **Banners Modulares (`AdBanner.jsx`)**: Espacios de publicidad no intrusivos en cabecera y pie de contenido.
   - **Paywall Condicional (`PredictionPanel.jsx` + `PremiumModal.jsx`)**: Vista de predicciones bloqueada con efecto glass blur. Incluye un switch interactivo en la barra superior ("Plan Gratuito" / "⭐ Premium") para probar la experiencia bloqueada y desbloqueada.

---

## 🎯 Motor de Picks (cómo ajustarlo para acertar más)

El motor vive en tres archivos:

| Archivo | Responsabilidad |
|---|---|
| `server/services/leagueProfiles.js` | Base estadística y "tendencias fijas" de cada liga |
| `server/services/marketEngine.js` | Distribuciones, líneas dinámicas, calibración y cuotas |
| `server/services/predictorEngine.js` | xG, Monte Carlo y construcción de los picks |

### Perfiles de liga
Cada competición tiene su propia media de goles, córners, tarjetas, faltas,
remates y offsides, además de su ventaja de campo. Ahí también se declaran las
**tendencias fijas** (`signatureMarkets`): por ejemplo, córners en Premier
League o tarjetas en La Liga.

Esas tendencias **no inflan la probabilidad mostrada**. Afectan la media
esperada del partido (efecto real) y desempatan el orden de los picks. Si con el
tiempo descubres que una liga se comporta distinto, ajusta sus números ahí: es
el único sitio donde hay que tocar para recalibrar una competición entera.

### Líneas dinámicas
No hay líneas fijas. Para cada mercado se calcula la media esperada del cruce
concreto (rendimiento del equipo × permisividad del rival × base de la liga) y
después se busca la línea Over/Under que maximiza la probabilidad **sin bajar de
la cuota mínima útil** (`MIN_USEFUL_ODDS`, 1.20 por defecto).

### Las dos cuotas
- **Cuota estimada**: lo que pagará la casa. Sale de la probabilidad cruda menos
  el margen del operador (`BOOKMAKER_MARGIN`, 6%). Es la comparable con Betano.
- **Cuota mínima**: `1 / probabilidad calibrada`. Por debajo de ese precio la
  apuesta pierde dinero a largo plazo aunque acierte a menudo.

Hay valor **solo** si la cuota real de tu casa supera la cuota mínima. Por eso
cada pick tiene un campo para introducir la cuota real y comprobarlo.

### Calibración
Las probabilidades crudas de Poisson son estructuralmente optimistas. Se encogen
hacia el 50% según la **calidad de datos** del partido (partidos jugados,
historial directo, datos externos, si la fuente es en vivo). Techo duro del 93%:
el motor nunca afirma que algo es seguro.

### Auto-aprendizaje
`POST /api/learn` es **idempotente**: solo procesa apuestas nuevas, así que
reenviar el historial completo ya no desvía los pesos. Además registra el
acierto por mercado; a partir de 8 resoluciones, los mercados que funcionan
suben en el orden de selección y los que fallan bajan. Consulta el estado en
`GET /api/market-report`.


---

## 📊 Backtest: cuánto acierta de verdad

```bash
node scripts/backtest.mjs
```

Recorre una temporada entera de cada liga **en orden cronológico** y predice
cada partido usando únicamente lo ocurrido **antes** de jugarse (walk-forward,
sin mirar el futuro). Después compara con el resultado real.

Esto es distinto de un backtest ingenuo: si usas la clasificación de hoy para
predecir un partido de hace tres meses, esa tabla ya contiene el resultado y el
acierto sale inflado.

```bash
node scripts/backtest.mjs PL              # una liga
node scripts/backtest.mjs PL PD SA        # varias
node scripts/backtest.mjs --min 8         # exigir 8 partidos previos
```

Lo que importa del informe no es el acierto global sino la **curva de
calibración**: cuando el modelo dice 75%, ¿acierta el 75%? Un modelo que promete
80% y cumple 60% no sirve aunque gane más de la mitad.

### El sesgo del xG (el hallazgo más importante)

La primera tanda de medidas decía que RESULTADO y HANDICAP no servían: prometían
un 64% y acertaban un 46%. Parecía que había que anularlos.

Era un diagnóstico equivocado. `scripts/diagnose-handicap.mjs` comparó el xG
predicho con los goles reales:

| xG predicho al local | goles reales | error |
|---|---|---|
| 0.71 | 1.08 | −0.38 |
| 1.74 | 1.45 | +0.29 |
| 2.75 | 1.80 | +0.95 |
| 3.83 | 2.11 | **+1.72** |

El esquema ataque × defensa multiplica dos ratios, y en cruces desiguales se
disparaba. La pendiente real de la regresión era **0.31**, no 1.0: el modelo
exageraba las diferencias unas tres veces.

No eran mercados malos, era el xG roto. El hándicap solo era el único que lo
dejaba a la vista, porque apostar a "gana por 3+" castiga ese error mucho más
que un Over/Under.

Corregido con `XG_REGRESSION` en `predictorEngine.js`:

| | antes | después |
|---|---|---|
| Error del xG en cruces desiguales | +1.72 | +0.38 |
| Error en diferencia de goles | +1.88 | ±0.36 |
| Hándicap: dice 55-65% | cubría 45.7% | **cubre 57.9%** |
| Hándicap: dice 65%+ | cubría **27.1%** | ese tramo ya no aparece |

### Resultado final (16.742 picks, 9 ligas)

| Mercado | Dice | Acierta | Desvío |
|---|---|---|---|
| GOLES | 74.2% | 74.3% | −0.2 |
| HANDICAP | 55.8% | 55.5% | +0.3 |
| DOBLE | 73.1% | 74.3% | −1.2 |
| RESULTADO | 70.7% | 78.9% | −8.2 (muestra pequeña) |

**Global: acierto real 73.5% frente al 73.0% anunciado.** Todos los tramos de la
curva dentro de 3 puntos. ROI del −13.9% inicial al −4.6%.

Los coeficientes de `MARKET_CALIBRATION` salen de aquí. Fíjate en que el
hándicap se queda en 1.00 mientras goles y doble van a 1.15: por eso el
coeficiente es **por mercado** y no global.

**Vuelve a correr el backtest después de tocar el motor y actualiza la tabla de
coeficientes con lo que salga.** Es el único modo de saber si un cambio mejora
o empeora.

### Backtest automático en producción

Cada predicción que genera la web se guarda sola y se resuelve contra el
resultado real:

- `GET /api/backtest/report` — acierto por mercado, liga, nivel de riesgo y curva de calibración
- `GET /api/backtest/pending` — predicciones aún sin resolver
- `POST /api/backtest/settle` — resuelve las ya jugadas

### Mercados verificados y sin verificar

Solo se pueden comprobar los mercados deducibles del marcador final. Corners,
tarjetas, faltas, tiros y fueras de juego **no**: ninguna API gratuita publica
esas estadísticas por partido. Esos picks salen marcados como `SIN VERIFICAR`
en la interfaz, y el motor reserva siempre un hueco de los tres picks seguros
para un mercado que sí esté comprobado.

---

## 🧠 Ratings y historial

- `GET /api/ratings` — estado de la bolsa Elo (equipos, partidos, top)

El Elo se alimenta de **cualquier** partido que la web llegue a ver, en
cualquier competición o temporada, aprovechando peticiones que ya se hacían
para otra cosa. Es transitivo: si A gana a X y X gana a B, A acaba por encima
de B aunque nunca se hayan enfrentado.

## ⚠️ Límites conocidos

| Falta | Motivo |
|---|---|
| Córners, tiros y faltas reales | Ninguna API gratuita los da por partido; se estiman |
| Lesiones y alineaciones | api-football gratuito solo llega a la temporada 2024 |
| Ligas fuera de las 10 cubiertas | Turquía, Chequia, Noruega, Ucrania... no están en el plan gratuito |

Los tres se arreglan con un plan de pago, no con código. El motor ya está
preparado para usarlos en cuanto haya datos.


---

## 💾 Persistencia del historial (importante en Render)

El historial de predicciones y los pesos aprendidos viven en `server/services/persistence.js`.

- **Sin `DATABASE_URL`**: se guardan en archivos JSON (`server/data/`). En Render gratis el disco es efímero y **se borra en cada redeploy o reinicio**.
- **Con `DATABASE_URL`** (Postgres de Neon o Supabase): se guardan en una tabla `kv` y sobreviven a todo.

`GET /api/health` indica qué modo está activo (`persistence`).

## 🧪 Tests

```bash
npm test
```

Cubren la resolución de picks (`gradePick`), la regla anti-trampa del backtest
(un partido solo cuenta si empezó **después** de generarse la predicción), la curva
de calibración y las matemáticas del motor de mercados.


## 🤖 Registro automático y métricas de fiabilidad

- `server/services/autoRegister.js` registra solo (cada 6 h) la predicción de los partidos de las próximas 72 h de todas las ligas, **antes** de que se jueguen y con su hora de inicio. Es la muestra sin sesgo con la que se juzga al modelo.
- El reporte incluye intervalo de confianza al 95% (Wilson), **Brier** (calidad de las probabilidades, sin depender de cuotas), yield simulado (con cuotas *estimadas*, no reales) y un nivel de **fiabilidad de la medición** según el número de picks resueltos.
- Una predicción de un equipo que no aparece en la tabla ya no se guarda en el historial.

## 💰 Mis apuestas reales (banca y yield)

Libro de apuestas guardado en el servidor (Postgres). Mide si ganas **dinero** con la cuota real de tu casa, que es distinto de que el modelo acierte.

- Desde el boleto escribes el **monto** y la **cuota total** de tu casa y pulsas *Registrar*. Es simple (1 selección) o combinada.
- Las selecciones verificables (1X2, doble oportunidad, handicap, goles, BTTS) se resuelven **solas** contra el resultado real. Corners y tarjetas se marcan a mano.
- Pestaña *Rendimiento → Mis apuestas reales*: banca, ganancia, **yield**, % de aciertos con intervalo de confianza, peor caída, racha y desglose por tipo y mercado, con aviso de cuánta muestra hay.
- **Protegido con clave**: define la variable `BETS_TOKEN` en Render (una contraseña larga que solo tú conoces). Sin ella, las rutas `/api/bets` quedan desactivadas. Hay límite de intentos fallidos.
- No modifica el modelo ni sus pesos: es solo contabilidad.


## 📉 Backtest contra el mercado

`scripts/backtest-market.mjs` prueba el modelo, partido a partido y sin mirar el futuro, contra cuotas reales (CSV gratuitos de football-data.co.uk). Resultado completo y método en [`docs/BACKTEST_MERCADO.md`](docs/BACKTEST_MERCADO.md). Resumen: **el modelo predice peor que Pinnacle y no tiene ventaja apostando**; cualquier mejora debe pasar esta misma prueba antes de usarse con dinero real.


## 🏀 Baloncesto (NBA) — experimental

- Datos de la API pública de ESPN (sin clave; **no es oficial** y puede cambiar sin aviso, por eso si falla la página lo dice en vez de inventar datos).
- Modelo deliberadamente simple (rating de puntos con regresión a la media + ventaja de local). **No conoce lesiones, descanso ni viajes.**
- Muestra la línea del mercado (cuando ESPN la publica) al lado del modelo.
- Registra cada partido antes de que empiece y lo resuelve solo con el marcador final. La sección "Medición contra el mercado" compara Brier del modelo y del mercado **en los mismos partidos**. Hasta tener cientos de partidos no hay base para decir que el modelo aporta algo.

## 📒 Apuestas manuales y CLV

En *Rendimiento → Mis apuestas reales* se puede registrar una apuesta de cualquier deporte (monto, cuota, y opcionalmente la cuota de cierre). El **CLV** (cuota conseguida / cuota de cierre − 1) es la señal más rápida de si se toman buenas decisiones: converge mucho antes que el yield.


## 🆚 Mercado vs modelo (fútbol)

En el predictor, cada partido muestra al lado de las probabilidades del modelo las **cuotas reales del mercado** (Pinnacle como referencia; el promedio si falta), de `fixtures.csv` de football-data.co.uk (gratis, sin clave). Incluye más/menos 2.5 goles y el árbitro cuando lo traen.

- Las cuotas se recogen los viernes por la tarde (fin de semana) y los martes (entre semana): **no son en tiempo real**, y solo hay partidos de la semana.
- La unión con nuestros partidos es por nombre de equipo y es **estricta**: si no hay una coincidencia clara no se muestra nada, antes que mostrar las cuotas de otro partido.
- Cubre PL, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira y Championship. No cubre Brasileirão ni Champions.
- Una discrepancia de más de 5 puntos se marca con cautela: en el backtest (docs/BACKTEST_MERCADO.md) esas diferencias fueron error del modelo.

## 🎨 Diseño

Barra lateral de navegación (ligas agrupadas bajo Fútbol, Baloncesto, Mi banca), tema **claro** por defecto y **oscuro** opcional (se guarda en el navegador). Los colores significan algo: azul = modelo, ámbar = mercado, verde = favorable, rojo = aviso. El toggle "Vista completa" reemplaza al antiguo Gratuito/Premium y los espacios publicitarios vacíos se quitaron.


## 🏆 Copas de Europa (Europa League y Conference League)

football-data.org las deja fuera de su plan gratuito (12 competiciones), así que se leen de la API pública de ESPN (sin clave, **no oficial**; cada parte falla por separado y la página lo dice). Muestran la tabla de la fase de liga con sus zonas (1–8 directos, 9–24 eliminatoria previa, 25+ fuera), próximos partidos, resultados recientes y la probabilidad implícita en las cuotas cuando ESPN las publica.

**No tienen predicción propia**: con 6–8 partidos por equipo no hay base, y en las ligas locales el modelo ya perdió frente al mercado. Tampoco aparecen en el Predictor, que depende de football-data.org.


## 🔬 Laboratorio de mejoras

`ml/lab.py` y `ml/lab2.py` prueban ideas de modelado partido a partido contra el mercado (resultados en [`docs/LABORATORIO_MODELO.md`](docs/LABORATORIO_MODELO.md)). Cualquier cambio al motor debe pasar esta prueba antes de usarse. Última medición: un modelo de goles con vida media larga y tiros reduce a la mitad la distancia con el mercado, pero sigue siendo peor y no da ventaja apostando.
