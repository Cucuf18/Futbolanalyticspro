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
