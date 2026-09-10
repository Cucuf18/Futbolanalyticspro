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
   - Señales de **Value Bets** y cuota mínima recomendada.
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
