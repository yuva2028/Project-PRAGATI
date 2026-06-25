import { useState, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Home() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    axios.get(`${API}/api/advisory/summary`)
      .then(r => { setSummary(r.data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const kpis = summary ? [
    {
      label: 'Total Fields',
      value: summary.total_fields,
      sub: 'Monitored by satellite',
      icon: '🌾',
      gradient: 'linear-gradient(135deg,#22c55e,#14b8a6)',
      color: '#22c55e',
    },
    {
      label: 'Critical Alerts',
      value: summary.critical_alerts,
      sub: 'Immediate irrigation needed',
      icon: '🚨',
      gradient: 'linear-gradient(135deg,#ef4444,#f97316)',
      color: '#ef4444',
    },
    {
      label: 'High Alerts',
      value: summary.high_alerts,
      sub: 'Irrigate within 2 days',
      icon: '⚠️',
      gradient: 'linear-gradient(135deg,#f97316,#eab308)',
      color: '#f97316',
    },
    {
      label: 'Healthy Fields',
      value: summary.healthy_fields,
      sub: 'No irrigation needed',
      icon: '✅',
      gradient: 'linear-gradient(135deg,#22c55e,#84cc16)',
      color: '#22c55e',
    },
    {
      label: 'Water Required',
      value: summary.total_water_required_mm + ' mm',
      sub: '8-day aggregate',
      icon: '💧',
      gradient: 'linear-gradient(135deg,#3b82f6,#14b8a6)',
      color: '#3b82f6',
    },
    {
      label: 'Avg. VCI',
      value: summary.average_vci,
      sub: 'Vegetation Condition Index',
      icon: '📊',
      gradient: 'linear-gradient(135deg,#a855f7,#3b82f6)',
      color: '#a855f7',
    },
  ] : []

  return (
    <div>
      <div className="page-header">
        <div className="header-badge">
          <span className="live-dot" />
          Real-time optical and microwave data across India
        </div>
        <h2>🛰️ Project PRAGATI Dashboard</h2>
        <p>AI-Driven Crop Intelligence using Sentinel-1 & Sentinel-2 via Google Earth Engine</p>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <p className="loading-text">Fetching live satellite data from GEE...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '0 32px' }}>
          <div className="error-card">
            <strong>Backend connection error.</strong> Make sure FastAPI is running on port 8000.
            <br /><code style={{ fontSize:'11px',opacity:0.7 }}>{error}</code>
          </div>
        </div>
      )}

      {!loading && summary && (
        <>
          <div className="kpi-grid">
            {kpis.map((k, i) => (
              <div
                key={k.label}
                className="kpi-card fade-in-up"
                style={{
                  '--accent-gradient': k.gradient,
                  animationDelay: `${i * 0.07}s`
                }}
              >
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
                <div className="kpi-icon" style={{ background: k.gradient + '22' }}>
                  {k.icon}
                </div>
              </div>
            ))}
          </div>

          {/* Feature Cards */}
          <div className="section-grid cols-3" style={{ padding: '0 32px 32px' }}>
            {[
              {
                icon: '🌾', title: 'Crop Classification',
                desc: 'Random Forest model trained on Sentinel-1/2 features to classify Rice, Maize, Sugarcane and other crops with >85% target accuracy.',
                accent: '#22c55e', href: '/crop-map'
              },
              {
                icon: '💧', title: 'Moisture Stress',
                desc: 'VCI computed from NDVI anomalies over the 6-month Sentinel-2 archive. Phenology-aware stress classification (Severe → Healthy).',
                accent: '#3b82f6', href: '/stress'
              },
              {
                icon: '🗺️', title: 'Irrigation Advisory',
                desc: 'FAO-56 crop water balance + rule-based system. Field-level advisories sorted by urgency for canal command area planning.',
                accent: '#f97316', href: '/advisory'
              },
            ].map(f => (
              <div key={f.title} className="card fade-in-up" style={{ cursor: 'pointer' }}
                onClick={() => window.location.href = f.href}>
                <div className="card-body">
                  <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
                  <h3 style={{ color: f.accent, fontSize: 16, marginBottom: 8, fontWeight: 600 }}>{f.title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7 }}>{f.desc}</p>
                  <div style={{ marginTop: 16, fontSize: 12, color: f.accent, fontWeight: 500 }}>
                    View Dashboard →
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Data Sources */}
          <div style={{ padding: '0 32px 32px' }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Data Sources</span>
                <span className="badge badge-none">✓ Live</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  {[
                    { src: 'Sentinel-2', type: 'Optical', bands: 'NDVI, NDWI, EVI', freq: '5-day revisit' },
                    { src: 'Sentinel-1', type: 'SAR Microwave', bands: 'VV, VH, VH/VV', freq: '6-day revisit' },
                    { src: 'CHIRPS',     type: 'Rainfall',  bands: 'Precipitation', freq: 'Daily' },
                    { src: 'ERA5',       type: 'Weather',   bands: 'Temp, ET₀',     freq: 'Hourly' },
                  ].map(d => (
                    <div key={d.src} style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 14,
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--green-400)', marginBottom: 4 }}>{d.src}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.type}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '6px 0' }}>{d.bands}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {d.freq}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
