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
