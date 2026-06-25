import { useState, useEffect } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import axios from 'axios'

ChartJS.register(ArcElement, Tooltip, Legend)

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const INDIA = [22.0, 82.0]

const STRESS_CONFIG = {
  'Severe Stress':   { color: '#dc2626', badge: 'badge-critical' },
  'High Stress':     { color: '#f97316', badge: 'badge-high' },
  'Moderate Stress': { color: '#eab308', badge: 'badge-medium' },
  'Low Stress':      { color: '#84cc16', badge: 'badge-low' },
  'Healthy':         { color: '#22c55e', badge: 'badge-none' },
}

export default function MoistureStress() {
  const [stressData, setStressData] = useState(null)
  const [tileUrl,    setTileUrl]    = useState(null)
  const [phenology,  setPhenology]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/stress-map`),
      axios.get(`${API}/api/tiles/stress`),
      axios.get(`${API}/api/phenology`),
    ])
    .then(([stressRes, tileRes, phenoRes]) => {
      setStressData(stressRes.data)
      setTileUrl(tileRes.data.tile_url)
      setPhenology(phenoRes.data.data || [])
      setLoading(false)
    })
    .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const distribution = stressData?.stress_distribution || {}
  const donutData = {
    labels: Object.keys(distribution),
    datasets: [{
      data: Object.values(distribution).map(v => v.area_ha),
      backgroundColor: Object.keys(distribution).map(k => STRESS_CONFIG[k]?.color || '#666'),
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }
  const donutOptions = {
    plugins: {
      legend: { labels: { color: '#86efac', font: { size: 12 }, padding: 20 } },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.parsed.toFixed(0)} ha (${distribution[ctx.label]?.percentage}%)`
        }
      }
    },
    cutout: '65%',
    responsive: true,
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-badge"><span className="live-dot" /> Sentinel-2 + Sentinel-1</div>
        <h2>💧 Moisture Stress Detection</h2>
        <p>VCI from NDVI anomalies · Phenology-aware classification · India</p>
      </div>

      {loading && <div className="loading-container"><div className="spinner" /><p className="loading-text">Computing VCI from Sentinel-2 time series...</p></div>}
      {error   && <div style={{padding:'0 32px'}}><div className="error-card">API Error: {error}</div></div>}

      {!loading && stressData && (
        <>
          {/* VCI Formula Banner */}
          <div style={{ padding: '0 32px 24px' }}>
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'16px 24px', display:'flex', flexWrap:'wrap', gap:24, alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>DEEP LEARNING MODEL</div>
                <div style={{ fontFamily:'var(--font-mono)', color:'var(--green-400)', fontSize:14, fontWeight:500 }}>
                  LSTM(NDVI<sub style={{fontSize:9}}>t</sub>, NDWI<sub style={{fontSize:9}}>t</sub>, Precip<sub style={{fontSize:9}}>t</sub>) → Stress Score
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>SOIL MOISTURE INDEX (SMI)</div>
                <div style={{ fontFamily:'var(--font-mono)', color:'var(--blue-400)', fontSize:14, fontWeight:500 }}>
                  SMI = (VH<sub style={{fontSize:9}}>t</sub> + 25) / 15 × 100
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>DATA SOURCE</div>
                <div style={{ color:'var(--text-secondary)', fontSize:13 }}>Sentinel-2 SR · 6-Month Archive · Google Earth Engine</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>SAR CORRECTION</div>
                <div style={{ color:'var(--text-secondary)', fontSize:13 }}>Sentinel-1 VH backscatter adjustment for monsoon cloud periods</div>
              </div>
            </div>
          </div>

          <div className="section-grid cols-2" style={{ padding: '0 32px 32px' }}>
            {/* Stress Map */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">LSTM Stress Map</span>
                <div style={{ display:'flex', gap:4 }}>
                  {['#dc2626','#f97316','#eab308','#84cc16','#22c55e'].map((c,i) => (
                    <div key={i} style={{ width:20, height:8, background:c, borderRadius:2 }} />
                  ))}
                </div>
              </div>
              <div className="card-body">
                <div className="map-wrapper">
                  <MapContainer center={INDIA} zoom={5} style={{ height:'100%', width:'100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="CartoDB" />
                    {tileUrl && <TileLayer url={tileUrl} opacity={0.85} attribution="GEE | Sentinel-2" />}
                  </MapContainer>
                </div>
                <div style={{ display:'flex', gap:12, marginTop:12, flexWrap:'wrap' }}>
                  {['Severe','High','Moderate','Low','Healthy'].map((l, i) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:['#dc2626','#f97316','#eab308','#84cc16','#22c55e'][i] }} />
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Donut Chart + Stats */}
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div className="card">
                <div className="card-header"><span className="card-title">Stress Distribution</span></div>
                <div className="card-body">
                  {Object.keys(distribution).length > 0 ? (
                    <div style={{ height: 220 }}>
                      <Doughnut data={donutData} options={donutOptions} />
                    </div>
                  ) : (
                    <p style={{ color:'var(--text-muted)', fontSize:12 }}>No GEE data – run backend with GEE credentials.</p>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">Phenology Timeline</span></div>
                <div className="card-body">
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {[
                      { label:'Sowing',     ndvi:'0.0–0.2', color:'#fbbf24', icon:'🌱' },
                      { label:'Vegetative', ndvi:'0.2–0.5', color:'#22c55e', icon:'🌿' },
                      { label:'Flowering',  ndvi:'0.5–0.7', color:'#a855f7', icon:'🌸' },
                      { label:'Maturity',   ndvi:'0.7–1.0', color:'#f59e0b', icon:'🌾' },
                    ].map(s => (
                      <div key={s.label} style={{
                        flex:'1 1 calc(50% - 8px)',
                        background:'var(--bg-secondary)',
                        border:`1px solid ${s.color}33`,
                        borderRadius:8,
                        padding:'10px 12px',
                      }}>
                        <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                        <div style={{ fontWeight:600, color:s.color, fontSize:12 }}>{s.label}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>NDVI: {s.ndvi}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stress Table */}
          {Object.keys(distribution).length > 0 && (
            <div style={{ padding:'0 32px 32px' }}>
              <div className="card">
                <div className="card-header"><span className="card-title">Stress Category Breakdown</span></div>
                <div className="card-body" style={{ padding:0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Stress Category</th>
                        <th>VCI Range</th>
                        <th>Area (ha)</th>
                        <th>Coverage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stressData.stress_categories.map(cat => {
                        const dist = distribution[cat.label] || {}
                        const conf = STRESS_CONFIG[cat.label] || {}
                        return (
                          <tr key={cat.label}>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:12, height:12, borderRadius:3, background:cat.color }} />
                                <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{cat.label}</span>
                              </div>
                            </td>
                            <td><code style={{ fontSize:12, color:'var(--text-muted)' }}>{cat.vci_range}</code></td>
                            <td><span style={{ fontFamily:'var(--font-mono)', color: cat.color }}>{dist.area_ha?.toLocaleString() || '—'}</span></td>
                            <td>
                              {dist.percentage != null && (
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div className="progress-bar" style={{ flex:1, maxWidth:100 }}>
                                    <div className="progress-fill" style={{ width:`${dist.percentage}%`, background:cat.color }} />
                                  </div>
                                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>{dist.percentage}%</span>
                                </div>
                              )}
                            </td>
                            <td><span className={`badge ${conf.badge}`}>{cat.label}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
