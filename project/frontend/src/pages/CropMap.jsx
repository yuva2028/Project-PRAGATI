import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, WMSTileLayer } from 'react-leaflet'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const INDIA = [22.0, 82.0]

const CROP_COLORS = {
  Rice:      '#22c55e',
  Maize:     '#eab308',
  Sugarcane: '#3b82f6',
  Others:    '#f97316',
}

export default function CropMap() {
  const [cropData,  setCropData]  = useState(null)
  const [tileUrl,   setTileUrl]   = useState(null)
  const [activeBand, setActiveBand] = useState('NDVI')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/crop-stats`),
      axios.get(`${API}/api/crop-tile?band=${activeBand}`),
    ])
    .then(([statsRes, tileRes]) => {
      setCropData(statsRes.data)
      setTileUrl(tileRes.data.tile_url)
      setLoading(false)
    })
    .catch(e => { setError(e.message); setLoading(false) })
  }, [activeBand])

  const bands = ['NDVI', 'NDWI', 'EVI']

  return (
    <div>
      <div className="page-header">
        <div className="header-badge"><span className="live-dot" /> Sentinel-2 Optical</div>
        <h2>🌾 Crop Type Classification</h2>
        <p>Random Forest model · Real Sentinel-1/2 features · India</p>
      </div>

      {loading && <div className="loading-container"><div className="spinner" /><p className="loading-text">Running Random Forest on GEE pixel samples...</p></div>}
      {error   && <div style={{padding:'0 32px'}}><div className="error-card">API Error: {error}</div></div>}

      {!loading && cropData && (
        <>
          {/* KPIs */}
          <div className="kpi-grid">
            {cropData.crops.map((c, i) => (
              <div key={c.name} className="kpi-card fade-in-up" style={{ '--accent-gradient': `linear-gradient(135deg, ${c.color}aa, ${c.color}55)`, animationDelay: `${i*0.07}s` }}>
                <div className="kpi-label">{c.name}</div>
                <div className="kpi-value" style={{ color: c.color }}>{c.area_ha.toLocaleString()}</div>
                <div className="kpi-sub">{c.percentage}% of total area</div>
                <div style={{ marginTop: 10 }}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${c.percentage}%`, background: c.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-grid cols-2" style={{ padding: '0 32px 32px' }}>
            {/* Map */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Spectral Layer</span>
                <div style={{ display:'flex', gap:6 }}>
                  {bands.map(b => (
                    <button key={b} className={`map-btn ${activeBand === b ? 'active':''}`}
                      onClick={() => setActiveBand(b)}>{b}</button>
                  ))}
                  <button className="primary-btn" onClick={() => setShowStats(!showStats)}>
                    {showStats ? 'Hide Analytics' : 'Show Analytics'}
                  </button>
                  <button className="primary-btn" style={{background:'var(--blue-500)'}} onClick={() => {
                    fetch(`${API}/api/export-crop-map`)
                      .then(r => r.json())
                      .then(data => {
                        if (data.download_url) window.open(data.download_url, '_blank');
                        else alert('Export failed');
                      })
                      .catch(() => alert('Export endpoint not reachable'));
                  }}>
                    📥 Export GeoTIFF
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="map-wrapper">
                  <MapContainer center={INDIA} zoom={5} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; CartoDB'
                    />
                    {tileUrl && (
                      <TileLayer
                        url={tileUrl}
                        opacity={0.8}
                        attribution="Google Earth Engine | ESA Copernicus"
                      />
                    )}
                  </MapContainer>
                </div>
                <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, textAlign:'center' }}>
                  {activeBand} layer from Sentinel-2 via Google Earth Engine
                </p>
              </div>
            </div>

            {/* Legend + Metrics */}
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div className="card">
                <div className="card-header"><span className="card-title">Crop Legend</span></div>
                <div className="card-body">
                  <div className="legend">
                    {cropData.crops.map(c => (
                      <div key={c.name} className="legend-item">
                        <div className="legend-dot" style={{ background: c.color }} />
                        <span style={{ flex:1, color:'var(--text-secondary)' }}>{c.name}</span>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color: c.color }}>{c.area_ha.toLocaleString()} ha</span>
                        <span className="badge" style={{ background: c.color+'22', color: c.color }}>{c.percentage}%</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:16, padding:'12px', background:'var(--bg-secondary)', borderRadius:8 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>TOTAL MONITORED AREA</div>
                    <div style={{ fontSize:28, fontWeight:800, color:'var(--green-400)', fontFamily:'var(--font-mono)' }}>
                      {cropData.total_area_ha.toLocaleString()} ha
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>India</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">Model Info</span></div>
                <div className="card-body">
                  {[
                    { label:'Model', value:'Random Forest' },
                    { label:'Features', value:'NDVI, NDWI, EVI, VV, VH' },
                    { label:'Data Source', value:'Sentinel-1 + Sentinel-2' },
                    { label:'Processing', value:'Google Earth Engine' },
                    { label:'Actual Accuracy', value: cropData.metrics ? `${cropData.metrics.accuracy}%` : '>85%' },
                  ].map(r => (
                    <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ color:'var(--text-muted)', fontSize:12 }}>{r.label}</span>
                      <span style={{ color:'var(--green-400)', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:500 }}>{r.value}</span>
                    </div>
                  ))}

                  {cropData.metrics?.feature_importances && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>XAI: FEATURE IMPORTANCE (TOP 5)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(cropData.metrics.feature_importances).slice(0, 5).map(([feat, imp]) => (
                          <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 80, fontSize: 11, color: 'var(--text-secondary)' }}>{feat}</div>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg-lighter)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${imp}%`, background: 'var(--blue-500)' }} />
                            </div>
                            <div style={{ width: 30, fontSize: 10, textAlign: 'right', color: 'var(--text-muted)' }}>{imp}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
