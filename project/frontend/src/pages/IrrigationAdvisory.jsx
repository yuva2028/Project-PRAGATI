import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const INDIA = [22.0, 82.0] // Centered on India

const PRIORITY_CONFIG = {
  CRITICAL: { label:'CRITICAL', className:'badge-critical', icon:'🚨' },
  HIGH:     { label:'HIGH',     className:'badge-high',     icon:'⚠️' },
  MEDIUM:   { label:'MEDIUM',   className:'badge-medium',   icon:'🔔' },
  LOW:      { label:'LOW',      className:'badge-low',      icon:'💬' },
  NONE:     { label:'NONE',     className:'badge-none',     icon:'✅' },
}

const CANAL_NETWORK = {
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "properties": { "type": "main_canal" }, "geometry": { "type": "LineString", "coordinates": [[75.3, 31.4], [75.6, 31.1], [75.8, 30.9], [76.2, 30.5]] } },
    { "type": "Feature", "properties": { "type": "distributary" }, "geometry": { "type": "LineString", "coordinates": [[75.6, 31.1], [75.4, 30.8], [75.2, 30.6]] } }
  ]
}

const COMMAND_AREA = {
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "properties": { "name": "Pilot Command Area" }, "geometry": { "type": "Polygon", "coordinates": [[[75.0, 31.5], [76.5, 31.5], [76.5, 30.0], [75.0, 30.0], [75.0, 31.5]]] } }
  ]
}

export default function IrrigationAdvisory() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState('ALL')

  useEffect(() => {
    axios.get(`${API}/api/advisory`)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const advisories = data?.advisories || []
  const filtered = filter === 'ALL' ? advisories : advisories.filter(a => a.priority === filter)

  const priorityCounts = advisories.reduce((acc, a) => {
    acc[a.priority] = (acc[a.priority] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div className="header-badge"><span className="live-dot" /> Rule-Based + FAO-56</div>
        <h2>📋 Irrigation Advisory</h2>
        <p>Field-level water deficit estimation · Sorted by urgency · India</p>
      </div>

      {loading && <div className="loading-container"><div className="spinner" /><p className="loading-text">Generating irrigation advisories...</p></div>}
      {error   && <div style={{padding:'0 32px'}}><div className="error-card">API Error: {error}</div></div>}

      {!loading && data && (
        <>
          {/* Priority KPIs */}
          <div className="kpi-grid">
            {Object.entries(PRIORITY_CONFIG).map(([key, conf], i) => (
              <div key={key} className="kpi-card fade-in-up"
                style={{ '--accent-gradient': 'linear-gradient(135deg, var(--bg-card), var(--bg-card))', animationDelay: `${i*0.07}s`, cursor:'pointer' }}
                onClick={() => setFilter(filter === key ? 'ALL' : key)}>
                <div className="kpi-label">{conf.label}</div>
                <div className="kpi-value" style={{ fontSize:26 }}>{priorityCounts[key] || 0}</div>
                <div className="kpi-sub">fields</div>
                <div style={{ position:'absolute', top:16, right:16, fontSize:22 }}>{conf.icon}</div>
              </div>
            ))}
          </div>

          <div className="section-grid cols-2" style={{ padding:'0 32px 32px' }}>
            {/* Map with field markers */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Field Advisory Map</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>Click markers for details</span>
              </div>
              <div className="card-body">
                <div className="map-wrapper">
                  <MapContainer center={INDIA} zoom={5} style={{ height:'100%', width:'100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                    
                    {/* Canal Network Layer */}
                    <GeoJSON data={CANAL_NETWORK} style={f => ({
                      color: f.properties.type === 'main_canal' ? '#3b82f6' : '#60a5fa',
                      weight: f.properties.type === 'main_canal' ? 3 : 1.5,
                      dashArray: f.properties.type === 'distributary' ? '4 4' : ''
                    })} />
                    
                    {/* Command Area Boundary Layer */}
                    <GeoJSON data={COMMAND_AREA} style={() => ({
                      color: '#f59e0b', weight: 2, fillOpacity: 0.05, dashArray: '5 5'
                    })} />

                    {advisories.filter(a => a.lat && a.lng).map(a => (
                      <CircleMarker
                        key={a.field_id}
                        center={[a.lat, a.lng]}
                        radius={14}
                        pathOptions={{ color: a.advisory_color, fillColor: a.advisory_color, fillOpacity: 0.8, weight: 2 }}
                      >
                        <Popup>
                          <div style={{ fontFamily:'Inter, sans-serif', minWidth:180 }}>
                            <strong style={{ color:'#111', display:'block', marginBottom:4 }}>Field {a.field_id}</strong>
                            <div><b>Crop:</b> {a.crop}</div>
                            <div><b>Stage:</b> {a.growth_stage}</div>
                            <div><b>Stress:</b> {a.stress_level}</div>
                            <div><b>VCI:</b> {a.vci}</div>
                            <div><b>Water needed:</b> {a.water_to_apply_mm} mm</div>
                            <div style={{ marginTop:6, fontWeight:600, color: a.advisory_color }}>
                              {a.recommendation}
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            </div>

            {/* Advisory Rules Reference */}
            <div className="card">
              <div className="card-header"><span className="card-title">Advisory Rules</span></div>
              <div className="card-body">
                {Object.entries(data.advisory_rules || {}).map(([stress, rule]) => (
                  <div key={stress} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'10px 0', borderBottom:'1px solid var(--border)', gap:12
                  }}>
                    <div>
                      <div style={{ fontSize:12, color:'var(--text-primary)', fontWeight:500 }}>{stress}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{rule.message}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <span className={`badge badge-${rule.priority?.toLowerCase()}`}>{rule.urgency}</span>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:16, background:'var(--bg-secondary)', borderRadius:8, padding:'12px' }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>WATER BALANCE MODEL</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--green-400)' }}>
                    ETc = ET₀ × Kc (FAO-56)
                  </div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--teal-500)' }}>
                    Deficit = ETc − Rainfall
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Advisory Table */}
          <div style={{ padding:'0 32px 32px' }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Field Advisory Table</span>
                <div style={{ display:'flex', gap:6 }}>
                  {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(f => (
                    <button key={f} className={`map-btn ${filter === f ? 'active':''}`}
                      onClick={() => setFilter(f)}>{f}</button>
                  ))}
                  <button className="primary-btn" style={{ marginLeft: 12, background: 'var(--bg-secondary)', color: 'var(--green-400)', border: '1px solid var(--green-400)' }} onClick={() => {
                    const headers = "Field,Crop,Soil,Stage,VCI,Stress,Rainfall(mm),ETc(mm),Deficit(mm),Apply(mm)\n";
                    const csv = filtered.map(a => `${a.field_id},${a.crop},${a.soil_type || 'Loam'},${a.growth_stage},${a.vci},${a.stress_level},${a.rainfall_mm},${a.crop_water_requirement_mm},${a.water_deficit_mm},${a.water_to_apply_mm}`).join('\n');
                    const blob = new Blob([headers + csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `irrigation_advisories_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                  }}>
                    📥 Export CSV
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ padding:0, overflowX:'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Crop</th>
                      <th>Soil Type</th>
                      <th>Stage</th>
                      <th>VCI</th>
                      <th>Stress</th>
                      <th>Rainfall (mm)</th>
                      <th>ETc (mm)</th>
                      <th>Deficit (mm)</th>
                      <th>Apply (mm)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => (
                      <tr key={a.field_id}>
                        <td><strong style={{ color:'var(--green-400)', fontFamily:'var(--font-mono)' }}>{a.field_id}</strong></td>
                        <td>{a.crop}</td>
                        <td><span style={{ fontSize:11, color:'var(--blue-400)' }}>{a.soil_type || 'Loam'}</span></td>
                        <td><span style={{ fontSize:11, color:'var(--text-muted)' }}>{a.growth_stage}</span></td>
                        <td><span style={{ fontFamily:'var(--font-mono)', color: a.advisory_color }}>{a.vci}</span></td>
                        <td><span className={`badge badge-${a.priority?.toLowerCase()}`}>{a.stress_level}</span></td>
                        <td style={{ fontFamily:'var(--font-mono)' }}>{a.rainfall_mm}</td>
                        <td style={{ fontFamily:'var(--font-mono)' }}>{a.crop_water_requirement_mm}</td>
                        <td style={{ fontFamily:'var(--font-mono)', color: a.water_deficit_mm > 0 ? '#ef4444' : '#22c55e' }}>
                          {a.water_deficit_mm}
                        </td>
                        <td style={{ fontFamily:'var(--font-mono)', color:'var(--green-400)', fontWeight:600 }}>
                          {a.water_to_apply_mm}
                        </td>
                        <td>
                          <div style={{ fontSize:11, color: a.advisory_color, fontWeight:500, maxWidth:160 }}>
                            {a.urgency === 'NONE' ? '✅ No action' : `⏱ ${a.within_days}d`}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
