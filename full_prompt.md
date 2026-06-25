<USER_REQUEST>
# PRAGATI Frontend — Complete Redesign Prompt for Codex

## OBJECTIVE

Redesign the entire Project PRAGATI frontend. Replace Leaflet with Google Maps JavaScript API. Replace the all-green hacker aesthetic with a professional dark navy/slate intelligence platform look. Add real user location detection. Make every page feel like a real government-grade agricultural monitoring tool, not a hackathon demo.

READ EVERY FILE before editing. Never delete working API logic or data-fetching code. Only change the UI layer.

---

## STEP 0 — ENVIRONMENT SETUP

### 0a. Update `project/frontend/package.json`

Remove `leaflet` and `react-leaflet`. Add `@vis.gl/react-google-maps`:

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1",
    "@vis.gl/react-google-maps": "^1.1.2",
    "chart.js": "^4.4.3",
    "react-chartjs-2": "^5.2.0",
    "axios": "^1.7.2",
    "lucide-react": "^0.395.0"
  }
}
```

### 0b. Update `project/frontend/index.html`

Add Google Maps script tag in `<head>`. Replace `YOUR_GOOGLE_MAPS_API_KEY` with the env variable placeholder — the actual key goes in `.env`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PRAGATI — Satellite Agricultural Intelligence</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 0c. Create `project/frontend/.env.example`

```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

---

## STEP 1 — COMPLETE CSS REDESIGN

### Replace `project/frontend/src/index.css` entirely

```css
/* ═══════════════════════════════════════════════════════
   Project PRAGATI — Professional Intelligence Platform
   Design system: Navy-slate, not green-hacker
═══════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

:root {
  /* Core palette — deep navy intelligence platform */
  --navy-950:   #030712;
  --navy-900:   #0a0f1e;
  --navy-800:   #0f172a;
  --navy-750:   #131e35;
  --navy-700:   #1e293b;
  --navy-600:   #263348;
  --navy-500:   #334155;
  --navy-400:   #475569;
  --navy-300:   #64748b;
  --navy-200:   #94a3b8;
  --navy-100:   #cbd5e1;
  --navy-50:    #f1f5f9;

  /* Accent — electric blue for data/action */
  --blue-600:   #2563eb;
  --blue-500:   #3b82f6;
  --blue-400:   #60a5fa;
  --blue-300:   #93c5fd;
  --blue-glow:  rgba(59,130,246,0.18);

  /* Status colours — used only for data states */
  --red-500:    #ef4444;
  --red-400:    #f87171;
  --orange-500: #f97316;
  --orange-400: #fb923c;
  --amber-500:  #f59e0b;
  --amber-400:  #fbbf24;
  --lime-500:   #84cc16;
  --emerald-500:#10b981;
  --emerald-400:#34d399;

  /* Typography */
  --font-sans:  'DM Sans', system-ui, sans-serif;
  --font-mono:  'DM Mono', monospace;

  /* Radii */
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 14px;
  --r-xl: 20px;

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
  --shadow-lg:   0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  --shadow-blue: 0 0 0 1px var(--blue-600), 0 4px 20px rgba(37,99,235,0.25);

  /* Transitions */
  --ease: cubic-bezier(0.4,0,0.2,1);
  --t-fast: 150ms var(--ease);
  --t-med:  250ms var(--ease);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; font-size: 14px; }

body {
  background: var(--navy-900);
  color: var(--navy-100);
  font-family: var(--font-sans);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* ── Scrollbar ─────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--navy-900); }
::-webkit-scrollbar-thumb { background: var(--navy-600); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--navy-500); }

/* ── Skip link ─────────────── */
.skip-link {
  position: absolute; top: -100px; left: 16px;
  background: var(--blue-500); color: #fff;
  padding: 8px 16px; border-radius: var(--r-sm);
  font-size: 13px; font-weight: 600; z-index: 9999;
  transition: top var(--t-fast);
  text-decoration: none;
}
.skip-link:focus { top: 16px; }

/* ── Layout ────────────────── */
.app-layout {
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ───────────────── */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--navy-950);
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  z-index: 200;
}

.sidebar-header {
  padding: 20px 16px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.brand-mark {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  width: 32px; height: 32px;
  background: var(--blue-600);
  border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
}

.brand-sub {
  font-size: 10px;
  color: var(--navy-400);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 1px;
}

.sidebar-nav {
  padding: 12px 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-section {
  font-size: 10px;
  font-weight: 600;
  color: var(--navy-500);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 8px 8px 4px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--navy-300);
  text-decoration: none;
  transition: background var(--t-fast), color var(--t-fast);
  position: relative;
}

.nav-link:hover {
  background: rgba(255,255,255,0.05);
  color: var(--navy-100);
}

.nav-link.active {
  background: rgba(37,99,235,0.15);
  color: var(--blue-400);
}

.nav-link.active::before {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  transform: translateY(-50%);
  width: 2px; height: 16px;
  background: var(--blue-500);
  border-radius: 2px;
}

.nav-icon {
  font-size: 14px;
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.location-pill {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  font-size: 11px;
}

.location-pill-label {
  color: var(--navy-400);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 3px;
}

.location-pill-value {
  color: var(--navy-200);
  font-weight: 500;
  font-size: 12px;
}

.location-pill-coords {
  color: var(--navy-500);
  font-family: var(--font-mono);
  font-size: 10px;
  margin-top: 2px;
}

/* ── Main content ─────────── */
.main-content {
  margin-left: 220px;
  flex: 1;
  min-height: 100vh;
  background: var(--navy-900);
}

/* ── Page header ──────────── */
.page-header {
  padding: 24px 28px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: var(--navy-950);
}

.page-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--blue-400);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.live-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--emerald-500);
  animation: pulse-dot 2s ease-in-out infinite;
  display: inline-block;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 13px;
  color: var(--navy-400);
  font-weight: 400;
}

/* ── Cards ─────────────────── */
.card {
  background: var(--navy-800);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--navy-200);
  letter-spacing: 0.01em;
}

.card-body {
  padding: 16px 18px;
}

/* ── KPI grid ──────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1px;
  background: rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.kpi-card {
  background: var(--navy-950);
  padding: 20px 20px 18px;
  position: relative;
  transition: background var(--t-fast);
}

.kpi-card:hover {
  background: var(--navy-900);
}

.kpi-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--navy-400);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.kpi-sub {
  font-size: 11px;
  color: var(--navy-500);
}

.kpi-accent-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
}

/* ── Section grid ──────────── */
.section-grid {
  display: grid;
  gap: 16px;
  padding: 20px 24px;
}

.cols-2 { grid-template-columns: 1fr 1fr; }
.cols-3 { grid-template-columns: repeat(3, 1fr); }

@media (max-width: 1100px) {
  .cols-3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .cols-2, .cols-3 { grid-template-columns: 1fr; }
  .sidebar { width: 56px; }
  .brand-name, .brand-sub, .nav-link span:not(.nav-icon) { display: none; }
  .main-content { margin-left: 56px; }
}

/* ── Google Map container ──── */
.gmap-container {
  width: 100%;
  border-radius: var(--r-md);
  overflow: hidden;
  position: relative;
}

/* ── Buttons ───────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--r-sm);
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background var(--t-fast), box-shadow var(--t-fast);
  font-family: var(--font-sans);
  text-decoration: none;
}

.btn-primary {
  background: var(--blue-600);
  color: #fff;
}
.btn-primary:hover { background: var(--blue-500); box-shadow: var(--shadow-blue); }

.btn-ghost {
  background: rgba(255,255,255,0.06);
  color: var(--navy-200);
  border: 1px solid rgba(255,255,255,0.08);
}
.btn-ghost:hover { background: rgba(255,255,255,0.1); color: #fff; }

.btn-ghost.active {
  background: rgba(37,99,235,0.15);
  color: var(--blue-400);
  border-color: rgba(37,99,235,0.3);
}

/* ── Badges / pills ─────────── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.badge-critical { background: rgba(239,68,68,0.15);  color: #f87171; }
.badge-high     { background: rgba(249,115,22,0.15); color: #fb923c; }
.badge-medium   { background: rgba(245,158,11,0.15); color: #fbbf24; }
.badge-low      { background: rgba(132,204,22,0.15); color: #a3e635; }
.badge-ok       { background: rgba(16,185,129,0.15); color: #34d399; }
.badge-blue     { background: rgba(59,130,246,0.15); color: #93c5fd; }

/* ── Table ─────────────────── */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th {
  text-align: left;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  color: var(--navy-400);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  white-space: nowrap;
}

.data-table td {
  padding: 10px 14px;
  color: var(--navy-200);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
}

.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: rgba(255,255,255,0.02); }

/* ── Loading ───────────────── */
.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  gap: 16px;
}

.spinner {
  width: 28px; height: 28px;
  border: 2px solid rgba(255,255,255,0.08);
  border-top-color: var(--blue-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text {
  font-size: 13px;
  color: var(--navy-400);
}

/* ── Error card ────────────── */
.error-card {
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: var(--r-md);
  padding: 14px 18px;
  color: var(--red-400);
  font-size: 13px;
  margin: 20px 24px;
}

/* ── Progress bar ──────────── */
.progress-track {
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s var(--ease);
}

/* ── Stat row ──────────────── */
.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.stat-row:last-child { border-bottom: none; }
.stat-label { font-size: 12px; color: var(--navy-400); }
.stat-value { font-size: 13px; font-weight: 600; color: var(--navy-100); font-variant-numeric: tabular-nums; }

/* ── Fade animations ────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.fade-up {
  animation: fadeUp 0.35s var(--ease) both;
}

/* ── Map info window (Google Maps custom) ── */
.gmap-info {
  background: var(--navy-800);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--r-md);
  padding: 12px 14px;
  min-width: 180px;
  font-family: var(--font-sans);
  box-shadow: var(--shadow-lg);
}

.gmap-info-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
}

.gmap-info-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--navy-400);
  margin-bottom: 3px;
}

.gmap-info-row span:last-child {
  color: var(--navy-200);
  font-weight: 500;
}

/* ── Location banner ─────────── */
.location-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(37,99,235,0.08);
  border: 1px solid rgba(37,99,235,0.2);
  border-radius: var(--r-md);
  padding: 10px 16px;
  font-size: 12px;
  color: var(--blue-300);
  margin: 16px 24px 0;
}

/* ── Confusion matrix ─────────── */
.cm-cell-correct {
  background: rgba(16,185,129,0.12);
  color: #34d399;
  font-weight: 700;
}
.cm-cell-error {
  background: rgba(249,115,22,0.08);
  color: #fb923c;
}

/* ── Accessibility ─────────────── */
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

:focus-visible {
  outline: 2px solid var(--blue-500);
  outline-offset: 2px;
}
```

---

## STEP 2 — SHARED GOOGLE MAPS HOOK

### Create `project/frontend/src/hooks/useGoogleMap.js` (NEW FILE)

```javascript
/**
 * Shared hook: initialises a Google Map on a given container ref.
 * Returns { map, mapsApi } once loaded, null while loading.
 *
 * Usage:
 *   const mapRef = useRef(null)
 *   const { map } = useGoogleMap(mapRef, { center, zoom, mapId })
 */
import { useEffect, useRef, useState } from 'react'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

let _loaderPromise = null

function loadGoogleMapsScript() {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (_loaderPromise) return _loaderPromise
  _loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=marker,visualization&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(script)
  })
  return _loaderPromise
}

export function useGoogleMap(containerRef, options = {}) {
  const [map, setMap] = useState(null)
  const [mapsApi, setMapsApi] = useState(null)
  const mapInstanceRef = useRef(null)

  const {
    center = { lat: 15.3, lng: 75.7 },
    zoom = 7,
    mapId = 'PRAGATI_DARK',
  } = options

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    loadGoogleMapsScript().then((maps) => {
      if (cancelled || mapInstanceRef.current) return

      const mapInstance = new maps.Map(containerRef.current, {
        center,
        zoom,
        mapId,
        // Professional dark style — matches the navy UI
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0a0f1e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0f1e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
          { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#263348' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
          { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1e293b' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0d1526' }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })

      mapInstanceRef.current = mapInstance
      setMap(mapInstance)
      setMapsApi(maps)
    }).catch(console.error)

    return () => { cancelled = true }
  }, [])  // only run once on mount

  return { map, mapsApi }
}
```

---

## STEP 3 — SHARED USER LOCATION HOOK

### Create `project/frontend/src/hooks/useUserLocation.js` (NEW FILE)

```javascript
/**
 * Detects the user's GPS position via browser Geolocation API.
 * Returns { coords, address, loading, error, permission }
 * Reverse geocodes via Google Maps Geocoder if Maps API is loaded.
 */
import { useState, useEffect } from 'react'

export function useUserLocation() {
  const [coords, setCoords]       = useState(null)   // { lat, lng }
  const [address, setAddress]     = useState(null)   // human-readable string
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [permission, setPermission] = useState('prompt')  // prompt | granted | denied

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5))
        const lng = parseFloat(pos.coords.longitude.toFixed(5))
        setCoords({ lat, lng })
        setPermission('granted')
        setLoading(false)

        // Reverse geocode using Google Maps Geocoder if available
        try {
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder()
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === 'OK' && results[0]) {
                // Extract district/city level
                const component = results.find(r =>
                  r.types.includes('locality') ||
                  r.types.includes('administrative_area_level_2')
                ) || results[0]
                setAddress(component.formatted_address)
              }
            })
          }
        } catch (_) {
          // Geocoding is best-effort; failure is silent
        }
      },
      (err) => {
        setError(err.message)
        setPermission('denied')
        setLoading(false)
        // Fall back to Karnataka centroid
        setCoords({ lat: 15.3, lng: 75.7 })
      },
      { timeout: 8000, enableHighAccuracy: false }
    )
  }, [])

  return { coords, address, loading, error, permission }
}
```

---

## STEP 4 — REDESIGNED `App.jsx`

### Replace `project/frontend/src/App.jsx` entirely

```jsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useUserLocation } from './hooks/useUserLocation.js'
import Home from './pages/Home.jsx'
import CropMap from './pages/CropMap.jsx'
import MoistureStress from './pages/MoistureStress.jsx'
import IrrigationAdvisory from './pages/IrrigationAdvisory.jsx'
import Analytics from './pages/Analytics.jsx'

const NAV = [
  { path: '/',          label: 'Overview',           icon: '⊞' },
  { path: '/crop-map',  label: 'Crop Classification', icon: '◈' },
  { path: '/stress',    label: 'Moisture Stress',     icon: '◉' },
  { path: '/advisory',  label: 'Irrigation Advisory', icon: '◆' },
  { path: '/analytics', label: 'Analytics',           icon: '▦' },
]

export default function App() {
  const { coords, address, permission } = useUserLocation()

  return (
    <BrowserRouter>
      <div className="app-layout">
        <a href="#main-content" className="skip-link">Skip to main content</a>

        <aside className="sidebar" role="complementary" aria-label="Application sidebar">
          <div className="sidebar-header">
            <div className="brand-mark">
              <div className="brand-icon" aria-hidden="true">🛰</div>
              <div>
                <div className="brand-name">PRAGATI</div>
                <div className="brand-sub">ISRO · 2025</div>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            <div className="nav-section">Platform</div>
            {NAV.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="location-pill" aria-label="Your detected location">
              <div className="location-pill-label">
                📍 {permission === 'granted' ? 'Your Location' : 'Pilot Area'}
              </div>
              <div className="location-pill-value">
                {address
                  ? address.split(',').slice(0, 2).join(',')
                  : 'Karnataka, India'}
              </div>
              {coords && (
                <div className="location-pill-coords">
                  {coords.lat}°N {coords.lng}°E
                </div>
              )}
            </div>
          </div>
        </aside>

        <main id="main-content" className="main-content">
          <Routes>
            <Route path="/"          element={<Home userCoords={coords} />} />
            <Route path="/crop-map"  element={<CropMap userCoords={coords} />} />
            <Route path="/stress"    element={<MoistureStress userCoords={coords} />} />
            <Route path="/advisory"  element={<IrrigationAdvisory userCoords={coords} />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
```

---

## STEP 5 — REDESIGNED `Home.jsx`

### Replace `project/frontend/src/pages/Home.jsx` entirely

Keep all existing `axios.get` calls unchanged. Only change the JSX structure and styling. Add user location awareness.

```jsx
import { useState, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const MODULES = [
  {
    href: '/crop-map',
    icon: '◈',
    title: 'Crop Classification',
    desc: 'Random Forest + XGBoost on 22-dimensional Sentinel-1/2 multi-temporal stack. GLCM texture features. >85% accuracy.',
    accent: '#3b82f6',
    tag: 'RF + XGBoost',
  },
  {
    href: '/stress',
    icon: '◉',
    title: 'Moisture Stress',
    desc: 'LSTM-based VCI prediction from NDVI/NDWI time series. Phenology-aware stage adjustment. SMI from Sentinel-1 VH.',
    accent: '#f59e0b',
    tag: 'LSTM + VCI',
  },
  {
    href: '/advisory',
    icon: '◆',
    title: 'Irrigation Advisory',
    desc: 'FAO-56 ETc = ET₀ × Kc water balance. Canal command area gate-discharge recommendations. PMKSY planning support.',
    accent: '#10b981',
    tag: 'FAO-56',
  },
]

const SOURCES = [
  { name: 'Sentinel-2', type: 'Optical (10 m)', cadence: '5-day', bands: 'NDVI · NDWI · EVI · B4 · B8' },
  { name: 'Sentinel-1', type: 'SAR Microwave', cadence: '6-day', bands: 'VV · VH · GLCM Texture' },
  { name: 'CHIRPS',     type: 'Precipitation', cadence: 'Daily',  bands: 'Rainfall (mm)' },
  { name: 'MODIS ET',   type: 'Evapotranspiration', cadence: '8-day', bands: 'MOD16A2 ET₀' },
]

export default function Home({ userCoords }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    axios.get(`${API}/api/advisory/summary`)
      .then(r => { setSummary(r.data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const kpis = summary ? [
    { label: 'Fields Monitored', value: summary.total_fields, sub: 'Active satellite watch', color: '#3b82f6' },
    { label: 'Critical Alerts',  value: summary.critical_alerts, sub: 'Irrigate within 24 h', color: '#ef4444' },
    { label: 'High Alerts',      value: summary.high_alerts, sub: 'Irrigate within 48 h', color: '#f97316' },
    { label: 'Healthy Fields',   value: summary.healthy_fields, sub: 'No action needed', color: '#10b981' },
    { label: 'Water Demand',     value: `${summary.total_water_required_mm} mm`, sub: '8-day aggregate', color: '#60a5fa' },
    { label: 'Mean VCI',         value: summary.average_vci, sub: 'Vegetation condition', color: '#a78bfa' },
  ] : []

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <span className="live-dot" aria-hidden="true" />
          Live · Sentinel-1/2 via Google Earth Engine
        </div>
        <h1 className="page-title">Agricultural Intelligence Dashboard</h1>
        <p className="page-subtitle">
          Satellite-driven crop monitoring for Karnataka pilot area
          {userCoords ? ` · Your position: ${userCoords.lat}°N ${userCoords.lng}°E` : ''}
        </p>
      </div>

      {userCoords && (
        <div className="location-banner" role="status">
          📍 Location detected — showing nearest field data to your coordinates ({userCoords.lat}, {userCoords.lng})
        </div>
      )}

      {loading && (
        <div className="loading-wrap">
          <div className="spinner" role="status" aria-label="Loading dashboard data" />
          <p className="loading-text">Fetching satellite data from GEE…</p>
        </div>
      )}

      {error && (
        <div className="error-card" role="alert">
          <strong>Backend unreachable.</strong> Ensure FastAPI is running on port 8000.
          <br /><code style={{ fontSize: 11, opacity: 0.7 }}>{error}</code>
        </div>
      )}

      {!loading && summary && (
        <>
          {/* KPI strip */}
          <div className="kpi-grid" role="region" aria-label="Summary statistics">
            {kpis.map((k, i) => (
              <div key={k.label} className="kpi-card fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
                <div className="kpi-accent-bar" style={{ background: k.color + '40' }} />
              </div>
            ))}
          </div>

          {/* Module cards */}
          <div className="section-grid cols-3">
            {MODULES.map((m, i) => (
              <a
                key={m.title}
                href={m.href}
                className="card fade-up"
                style={{ textDecoration: 'none', display: 'block', animationDelay: `${0.1 + i * 0.07}s` }}
                aria-label={`Open ${m.title} dashboard`}
              >
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 22, color: m.accent }}>{m.icon}</span>
                    <span className="badge badge-blue">{m.tag}</span>
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{m.title}</h2>
                  <p style={{ fontSize: 12, color: 'var(--navy-400)', lineHeight: 1.7 }}>{m.desc}</p>
                  <div style={{ marginTop: 14, fontSize: 12, color: m.accent, fontWeight: 600 }}>
                    Open dashboard →
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Data sources */}
          <div style={{ padding: '0 24px 28px' }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Data Sources</span>
                <span className="badge badge-ok">✓ Active</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.04)' }}>
                {SOURCES.map(s => (
                  <div key={s.name} style={{ background: 'var(--navy-800)', padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 13, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--navy-500)', marginBottom: 6 }}>{s.type} · {s.cadence}</div>
                    <div style={{ fontSize: 11, color: 'var(--navy-300)', fontFamily: 'var(--font-mono)' }}>{s.bands}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

---

## STEP 6 — REDESIGNED `CropMap.jsx` WITH GOOGLE MAPS

### Replace `project/frontend/src/pages/CropMap.jsx` entirely

Keep ALL existing API calls (`/api/crop-stats`, `/api/crop-tile`, `/api/crop-map`, `/api/crop-geojson`) and all state variables. Only replace Leaflet map with Google Maps and redesign the UI.

```jsx
import { useState, useEffect, useRef } from 'react'
import { useGoogleMap } from '../hooks/useGoogleMap.js'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CROP_COLORS = {
  Rice:      '#3b82f6',
  Maize:     '#f59e0b',
  Sugarcane: '#10b981',
  Others:    '#8b5cf6',
}

const CLASS_NAMES = ['Rice', 'Maize', 'Sugarcane', 'Others']

export default function CropMap({ userCoords }) {
  const [cropData,   setCropData]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [cropPoints, setCropPoints] = useState([])
  const [liveData,   setLiveData]   = useState(null)
  const [liveMetrics,setLiveMetrics]= useState(null)
  const [selectedModel, setSelectedModel] = useState('rf')
  const [activeBand, setActiveBand] = useState('NDVI')

  const mapRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)

  const center = userCoords || { lat: 15.3, lng: 75.7 }
  const { map, mapsApi } = useGoogleMap(mapRef, { center, zoom: 7 })

  // Fetch data
  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/crop-stats`),
      axios.get(`${API}/api/crop-map`).catch(() => null),
      axios.get(`${API}/api/crop-geojson`).catch(() => null),
    ]).then(([statsRes, cropMapRes, geoRes]) => {
      setCropData(statsRes.data)
      if (cropMapRes?.data) {
        setLiveData(cropMapRes.data)
        setLiveMetrics(cropMapRes.data.metrics || null)
      }
      if (geoRes?.data?.features) setCropPoints(geoRes.data.features)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [activeBand])

  // Place markers on Google Map
  useEffect(() => {
    if (!map || !mapsApi || cropPoints.length === 0) return

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (!infoWindowRef.current) {
      infoWindowRef.current = new mapsApi.InfoWindow()
    }

    cropPoints.forEach(feature => {
      const { coordinates } = feature.geometry
      const { crop_name, confidence, field_id, color } = feature.properties

      const circle = new mapsApi.Circle({
        map,
        center: { lat: coordinates[1], lng: coordinates[0] },
        radius: 4000,
        fillColor: CROP_COLORS[crop_name] || color || '#60a5fa',
        fillOpacity: 0.7,
        strokeColor: '#fff',
        strokeWeight: 1,
        strokeOpacity: 0.3,
        clickable: true,
      })

      circle.addListener('click', () => {
        infoWindowRef.current.setContent(`
          <div class="gmap-info">
            <div class="gmap-info-title">${field_id}</div>
            <div class="gmap-info-row"><span>Crop</span><span>${crop_name}</span></div>
            <div class="gmap-info-row"><span>Confidence</span><span>${confidence}%</span></div>
            <div class="gmap-info-row"><span>Model</span><span>${selectedModel.toUpperCase()}</span></div>
          </div>
        `)
        infoWindowRef.current.setPosition({ lat: coordinates[1], lng: coordinates[0] })
        infoWindowRef.current.open(map)
      })

      markersRef.current.push(circle)
    })

    // If user location exists, add a user marker
    if (userCoords) {
      const userMarker = new mapsApi.Marker({
        map,
        position: userCoords,
        title: 'Your location',
        icon: {
          path: mapsApi.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      })
      markersRef.current.push(userMarker)
    }
  }, [map, mapsApi, cropPoints, userCoords, selectedModel])

  const getDisplayCrops = () => {
    if (liveData) {
      const stats = selectedModel === 'xgb' ? liveData.area_statistics_xgb : liveData.area_statistics_rf
      if (stats) {
        const total = Object.values(stats).reduce((s, v) => s + v.pixel_count, 0)
        return Object.entries(stats).map(([name, val]) => ({
          name, area_ha: val.area_ha, color: val.color,
          percentage: total > 0 ? parseFloat((val.pixel_count / total * 100).toFixed(1)) : 0,
        }))
      }
    }
    return cropData?.crops || []
  }

  const currentMetrics = liveMetrics ? (selectedModel === 'xgb' ? liveMetrics.xgb : liveMetrics.rf) : null
  const displayCrops   = getDisplayCrops()

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <span className="live-dot" aria-hidden="true" />
          Sentinel-2 Optical · Sentinel-1 SAR
        </div>
        <h1 className="page-title">Crop Type Classification</h1>
        <p className="page-subtitle">
          Multi-temporal RF + XGBoost · 22-dimensional feature stack · Karnataka pilot area
        </p>
      </div>

      {loading && <div className="loading-wrap"><div className="spinner" /><p className="loading-text">Running classification model…</p></div>}
      {error   && <div className="error-card" role="alert">API Error: {error}</div>}

      {!loading && cropData && (
        <>
          {/* KPI strip */}
          <div className="kpi-grid">
            {displayCrops.map((c, i) => (
              <div key={c.name} className="kpi-card fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="kpi-label">{c.name}</div>
                <div className="kpi-value" style={{ color: CROP_COLORS[c.name] || c.color }}>
                  {c.area_ha.toLocaleString()}
                </div>
                <div className="kpi-sub">ha · {c.percentage}% of area</div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${c.percentage}%`, background: CROP_COLORS[c.name] || c.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="section-grid cols-2">
            {/* Map */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Crop Distribution Map</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['rf', 'xgb'].map(m => (
                    <button key={m}
                      className={`btn btn-ghost${selectedModel === m ? ' active' : ''}`}
                      onClick={() => setSelectedModel(m)}
                      aria-pressed={selectedModel === m}
                      aria-label={`Show ${m === 'rf' ? 'Random Forest' : 'XGBoost'} predictions`}
                    >{m === 'rf' ? 'Random Forest' : 'XGBoost'}</button>
                  ))}
                </div>
              </div>
              <div className="gmap-container" style={{ height: 420 }} role="region" aria-label="Karnataka crop classification map">
                <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, padding: '12px 18px', flexWrap: 'wrap' }}>
                {Object.entries(CROP_COLORS).map(([name, color]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--navy-300)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} aria-hidden="true" />
                    {name}
                  </div>
                ))}
                {userCoords && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--navy-300)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', border: '2px solid #fff' }} aria-hidden="true" />
                    Your location
                  </div>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {currentMetrics && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Model Performance — {selectedModel.toUpperCase()}</span>
                    <span className="badge badge-ok">{currentMetrics.accuracy?.toFixed ? currentMetrics.accuracy.toFixed(1) : currentMetrics.accuracy}% Accuracy</span>
                  </div>
                  <div className="card-body">
                    {[
                      ['Kappa Coefficient', currentMetrics.kappa_coefficient?.toFixed(3)],
                      ['F1 Score (weighted)', currentMetrics.f1_score?.toFixed ? `${currentMetrics.f1_score.toFixed(1)}%` : currentMetrics.f1_score],
                      ['Precision', currentMetrics.precision?.toFixed ? `${currentMetrics.precision.toFixed(1)}%` : '—'],
                      ['Recall', currentMetrics.recall?.toFixed ? `${currentMetrics.recall.toFixed(1)}%` : '—'],
                    ].map(([label, val]) => (
                      <div className="stat-row" key={label}>
                        <span className="stat-label">{label}</span>
                        <span className="stat-value">{val ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confusion Matrix */}
              {currentMetrics?.confusion_matrix && (() => {
                const cm = currentMetrics.confusion_matrix
                const rowTotals = cm.map(row => row.reduce((a, b) => a + b, 0))
                return (
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Confusion Matrix</span>
                      <span style={{ fontSize: 11, color: 'var(--navy-500)' }}>Rows = true · Cols = predicted</span>
                    </div>
                    <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                      <table className="data-table" aria-label="Crop classification confusion matrix" role="grid">
                        <caption className="sr-only">Rows represent true labels. Columns represent predicted labels. Green diagonal = correct.</caption>
                        <thead>
                          <tr>
                            <th scope="col" style={{ minWidth: 90 }}>True \ Pred</th>
                            {CLASS_NAMES.map(c => <th scope="col" key={c} style={{ textAlign: 'center' }}>{c}</th>)}
                            <th scope="col" style={{ textAlign: 'center' }}>Recall</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cm.map((row, i) => {
                            const total = rowTotals[i] || 1
                            return (
                              <tr key={i}>
                                <th scope="row" style={{ color: 'var(--navy-300)', fontWeight: 600 }}>{CLASS_NAMES[i]}</th>
                                {row.map((val, j) => (
                                  <td key={j} style={{ textAlign: 'center' }}
                                    className={i === j ? 'cm-cell-correct' : val > 0 ? 'cm-cell-error' : ''}>
                                    {val}
                                  </td>
                                ))}
                                <td style={{ textAlign: 'center', color: '#34d399', fontWeight: 600 }}>
                                  {((row[i] / total) * 100).toFixed(0)}%
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

---

## STEP 7 — REDESIGNED `MoistureStress.jsx` WITH GOOGLE MAPS

### Replace `project/frontend/src/pages/MoistureStress.jsx` entirely

Keep ALL existing axios calls. Replace Leaflet with Google Maps. Remove all green styling. Use navy/slate professional palette.

```jsx
import { useState, useEffect, useRef } from 'react'
import { useGoogleMap } from '../hooks/useGoogleMap.js'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import axios from 'axios'
ChartJS.register(ArcElement, Tooltip, Legend)

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STRESS_PALETTE = {
  'Severe Stress':   { color: '#ef4444', badge: 'badge-critical' },
  'High Stress':     { color: '#f97316', badge: 'badge-high' },
  'Moderate Stress': { color: '#f59e0b', badge: 'badge-medium' },
  'Low Stress':      { color: '#84cc16', badge: 'badge-low' },
  'Healthy':         { color: '#10b981', badge: 'badge-ok' },
}

export default function MoistureStress({ userCoords }) {
  const [stressData,   setStressData]   = useState(null)
  const [phenology,    setPhenology]    = useState([])
  const [stressPoints, setStressPoints] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const mapRef    = useRef(null)
  const circlesRef= useRef([])
  const infoRef   = useRef(null)

  const center = userCoords || { lat: 15.3, lng: 75.7 }
  const { map, mapsApi } = useGoogleMap(mapRef, { center, zoom: 7 })

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/stress-map`),
      axios.get(`${API}/api/phenology`),
      axios.get(`${API}/api/stress-geojson`).catch(() => null),
    ]).then(([stressRes, phenoRes, sgRes]) => {
      setStressData(stressRes.data)
      setPhenology(phenoRes.data.data || [])
      if (sgRes?.data?.features) setStressPoints(sgRes.data.features)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // Draw stress points on Google Map
  useEffect(() => {
    if (!map || !mapsApi || stressPoints.length === 0) return
    circlesRef.current.forEach(c => c.setMap(null))
    circlesRef.current = []
    if (!infoRef.current) infoRef.current = new mapsApi.InfoWindow()

    stressPoints.forEach(f => {
      const [lng, lat] = f.geometry.coordinates
      const { vci, smi, stress_label, stress_color, phenology_stage, crop_name, field_id } = f.properties
      const color = STRESS_PALETTE[stress_label]?.color || stress_color || '#60a5fa'

      const circle = new mapsApi.Circle({
        map,
        center: { lat, lng },
        radius: 5000,
        fillColor: color,
        fillOpacity: 0.65,
        strokeColor: '#fff',
        strokeWeight: 1,
        strokeOpacity: 0.25,
        clickable: true,
      })

      circle.addList
<truncated 22806 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.