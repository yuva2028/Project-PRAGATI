
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
    setLoading(true)
    const params = userCoords ? `?lat=${userCoords.lat}&lng=${userCoords.lng}` : ''
    axios.get(`${API}/api/advisory/summary${params}`)
      .then(r => { setSummary(r.data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [userCoords])



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

