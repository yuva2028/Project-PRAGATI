import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const KARNATAKA = [15.3, 75.7]

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
  const [showStats, setShowStats] = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [cropPoints, setCropPoints] = useState([])

  const [liveData,    setLiveData]    = useState(null)
  const [liveMetrics, setLiveMetrics] = useState(null)
  const [selectedModel, setSelectedModel] = useState('rf')

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/crop-stats`),
      axios.get(`${API}/api/crop-tile?band=${activeBand}`),
      axios.get(`${API}/api/crop-map`).catch(() => null),  // non-blocking
      axios.get(`${API}/api/crop-geojson`).catch(() => null),
    ])
    .then(([statsRes, tileRes, cropMapRes, geoRes]) => {
      setCropData(statsRes.data)
      setTileUrl(tileRes.data.tile_url)
      if (cropMapRes?.data) {
        setLiveData(cropMapRes.data)
        setLiveMetrics(cropMapRes.data.metrics || null)
      }
      if (geoRes?.data?.features) setCropPoints(geoRes.data.features)
      setLoading(false)
    })
    .catch(e => { setError(e.message); setLoading(false) })
  }, [activeBand])

  const getDisplayCrops = () => {
    if (liveData) {
      const stats = selectedModel === 'xgb' ? liveData.area_statistics_xgb : liveData.area_statistics_rf;
      if (stats) {
        const totalPixels = Object.values(stats).reduce((sum, v) => sum + v.pixel_count, 0);
        return Object.entries(stats).map(([name, val]) => ({
          name,
          area_ha: val.area_ha,
          percentage: totalPixels > 0 ? parseFloat((val.pixel_count / totalPixels * 100).toFixed(1)) : 0,
          color: val.color
        }));
      }
    }
    return cropData ? cropData.crops : [];
  }

  const currentMetrics = liveMetrics ? (selectedModel === 'xgb' ? liveMetrics.xgb : liveMetrics.rf) : null;
  const displayCrops = getDisplayCrops();
  const bands = ['NDVI', 'NDWI', 'EVI']

  return (
    <div>
      <div className="page-header">
        <div className="header-badge"><span className="live-dot" /> Sentinel-2 Optical</div>
        <h2>🌾 Crop Type Classification</h2>
        <p>Random Forest model · Real Sentinel-1/2 features · Karnataka</p>
      </div>

      {loading && <div className="loading-container"><div className="spinner" /><p className="loading-text">Running Random Forest on GEE pixel samples...</p></div>}
      {error   && <div style={{padding:'0 32px'}}><div className="error-card">API Error: {error}</div></div>}

      {!loading && cropData && (
        <>
          {/* KPIs */}
          <div className="kpi-grid">
            {displayCrops.map((c, i) => (
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
                      onClick={() => setActiveBand(b)}
                      aria-label={`View ${b} spectral layer`}
                      aria-pressed={activeBand === b}>{b}</button>
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
                  <div role="region" aria-label="Karnataka crop classification satellite map">
                    <MapContainer center={KARNATAKA} zoom={7} style={{ height: '100%', width: '100%' }}>
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
                      {cropPoints.map((f, i) => (
                        <CircleMarker
                          key={i}
                          center={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
                          radius={8}
                          pathOptions={{
                            color: f.properties.color,
                            fillColor: f.properties.color,
                            fillOpacity: 0.85,
                            weight: 1.5
                          }}
                        >
                          <Popup>
                            <div>
                              <strong>{f.properties.crop_name}</strong>
                              <div>Field: {f.properties.field_id}</div>
                              <div>Confidence: {f.properties.confidence}%</div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MapContainer>
                  </div>
                </div>
                <div className="map-point-legend">
                  {Object.entries(CROP_COLORS).map(([name, color]) => (
                    <span key={name}>
                      <span className="legend-swatch" style={{ background: color }} />
                      {name}
                    </span>
                  ))}
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
                    {displayCrops.map(c => (
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
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Karnataka, India</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span className="card-title">Model Comparison</span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className={`map-btn ${selectedModel === 'rf' ? 'active':''}`} onClick={() => setSelectedModel('rf')} style={{ padding:'2px 8px', fontSize:11 }}>Random Forest</button>
                    <button className={`map-btn ${selectedModel === 'xgb' ? 'active':''}`} onClick={() => setSelectedModel('xgb')} style={{ padding:'2px 8px', fontSize:11 }}>XGBoost</button>
                  </div>
                </div>
                <div className="card-body">
                  {[
                    { label:'Model Type',      value: selectedModel === 'xgb' ? 'XGBoost Classifier' : 'Random Forest (n=200)' },
                    { label:'Features',        value:'NDVI, NDWI, EVI, VV, VH + GLCM' },
                    { label:'Temporal Stack',  value:'T1 (Early) + T2 (Late Season)' },
                    { label:'Data Source',     value:'Sentinel-1 + Sentinel-2' },
                    { label:'Processing',      value:'Google Earth Engine' },
                    { label:'CV Accuracy',     value: currentMetrics ? `${currentMetrics.accuracy}%` : '>85% (target)' },
                    { label:'Cohen\'s Kappa',  value: currentMetrics?.kappa_coefficient != null ? currentMetrics.kappa_coefficient.toFixed(4) : '—' },
                    { label:'F1 Score',        value: currentMetrics ? `${currentMetrics.f1_score}%` : '—' },
                  ].map(r => (
                    <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ color:'var(--text-muted)', fontSize:12 }}>{r.label}</span>
                      <span style={{ color:'var(--green-400)', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:500 }}>{r.value}</span>
                    </div>
                  ))}

                  {(currentMetrics?.feature_importances) && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>XAI: FEATURE IMPORTANCE (TOP 5)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(currentMetrics.feature_importances).slice(0, 5).map(([feat, imp]) => (
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

              {currentMetrics?.confusion_matrix && (() => {
                const CLASS_NAMES = ['Rice', 'Maize', 'Sugarcane', 'Others']
                const cm = currentMetrics.confusion_matrix
                // Row totals for per-class recall
                const rowTotals = cm.map(row => row.reduce((a, b) => a + b, 0))
                return (
                  <div className="card" style={{ marginTop: 24 }}>
                    <div className="card-header">
                      <span className="card-title">
                        📊 Confusion Matrix — {selectedModel.toUpperCase()} Model
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--green-600)' }}>
                        Diagonal = correctly classified · Off-diagonal = misclassified
                      </span>
                    </div>
                    <div className="card-body" style={{ overflowX: 'auto', padding: '16px 0' }}>
                      <table
                        className="data-table"
                        role="grid"
                        aria-label={`Crop classification confusion matrix for ${selectedModel.toUpperCase()} model`}
                        style={{ minWidth: 420, margin: '0 auto' }}
                      >
                        <caption className="sr-only">
                          Rows represent true crop labels. Columns represent predicted crop labels.
                          Diagonal cells show correct classifications highlighted in green.
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col" style={{ color: 'var(--green-400)', minWidth: 110 }}>
                              True \ Predicted
                            </th>
                            {CLASS_NAMES.map(c => (
                              <th scope="col" key={c} style={{ textAlign: 'center', minWidth: 80 }}>
                                {c}
                              </th>
                            ))}
                            <th scope="col" style={{ textAlign: 'center', color: 'var(--green-600)' }}>
                              Recall %
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cm.map((row, i) => {
                            const total = rowTotals[i] || 1
                            const recall = ((row[i] / total) * 100).toFixed(1)
                            return (
                              <tr key={i}>
                                <th scope="row" style={{ color: 'var(--green-400)', fontWeight: 600 }}>
                                  {CLASS_NAMES[i]}
                                </th>
                                {row.map((val, j) => (
                                  <td
                                    key={j}
                                    style={{
                                      textAlign: 'center',
                                      fontWeight: i === j ? 700 : 400,
                                      background: i === j
                                        ? 'rgba(34,197,94,0.18)'
                                        : val > 0
                                          ? 'rgba(249,115,22,0.10)'
                                          : 'transparent',
                                      color: i === j ? '#22c55e' : val > 0 ? '#f97316' : 'var(--text-muted)',
                                      borderRadius: 4,
                                      padding: '8px 12px',
                                    }}
                                  >
                                    {val}
                                  </td>
                                ))}
                                <td style={{ textAlign: 'center', color: '#86efac', fontWeight: 600 }}>
                                  {recall}%
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--green-700)', marginTop: 10 }}>
                        Reference: Haralick (1973) · Kussul et al. (2017) · NRSC India SAR Texture Atlas
                      </p>
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
