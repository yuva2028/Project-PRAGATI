import { useState, useEffect, useRef } from 'react'
import { useGoogleMap } from '../hooks/useGoogleMap.js'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PRIORITY_CONFIG = {
  CRITICAL: { label:'CRITICAL', className:'badge-critical', icon:'🚨' },
  HIGH:     { label:'HIGH',     className:'badge-high',     icon:'⚠️' },
  MEDIUM:   { label:'MEDIUM',   className:'badge-medium',   icon:'🔔' },
  LOW:      { label:'LOW',      className:'badge-low',      icon:'💬' },
  NONE:     { label:'NONE',     className:'badge-ok',       icon:'✅' },
}

const CANAL_NETWORK = {
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "properties": { "type": "main_canal" }, "geometry": { "type": "LineString", "coordinates": [[74.8, 16.2], [75.3, 15.7], [75.9, 15.1], [76.5, 14.5]] } },
    { "type": "Feature", "properties": { "type": "distributary" }, "geometry": { "type": "LineString", "coordinates": [[75.3, 15.7], [75.7, 15.3], [76.2, 14.9]] } }
  ]
}

const COMMAND_AREA = {
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "properties": { "name": "Karnataka Pilot Command Area" }, "geometry": { "type": "Polygon", "coordinates": [[[74.4, 16.8], [77.2, 16.8], [77.2, 13.8], [74.4, 13.8], [74.4, 16.8]]] } }
  ]
}

export default function IrrigationAdvisory({ userCoords }) {
  const [data,    setData]    = useState(null)
  const [commandData, setCommandData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState('ALL')

  const mapRef    = useRef(null)
  const markersRef= useRef([])
  const infoRef   = useRef(null)

  const center = userCoords || { lat: 15.3, lng: 75.7 }
  const { map, mapsApi } = useGoogleMap(mapRef, { center, zoom: 7 })

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/advisory`),
      axios.get(`${API}/api/advisory/command-summary`).catch(() => null)
    ])
    .then(([advRes, cmdRes]) => {
      setData(advRes.data)
      if (cmdRes?.data) setCommandData(cmdRes.data.command_areas)
      setLoading(false)
    })
    .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const advisories = data?.advisories || []
  const filtered = filter === 'ALL' ? advisories : advisories.filter(a => a.priority === filter)

  const priorityCounts = advisories.reduce((acc, a) => {
    acc[a.priority] = (acc[a.priority] || 0) + 1
    return acc
  }, {})

  // Google Maps setup
  useEffect(() => {
    if (!map || !mapsApi) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    if (!infoRef.current) infoRef.current = new mapsApi.InfoWindow()

    // Add GeoJSON data for canals and command areas
    map.data.addGeoJson(CANAL_NETWORK)
    map.data.addGeoJson(COMMAND_AREA)

    map.data.setStyle((feature) => {
      if (feature.getGeometry().getType() === 'LineString') {
        const isMain = feature.getProperty('type') === 'main_canal'
        return {
          strokeColor: isMain ? '#3b82f6' : '#60a5fa',
          strokeWeight: isMain ? 3 : 1.5,
          zIndex: 1
        }
      } else if (feature.getGeometry().getType() === 'Polygon') {
        return {
          fillColor: '#f59e0b',
          fillOpacity: 0.05,
          strokeColor: '#f59e0b',
          strokeWeight: 2,
          zIndex: 0
        }
      }
    })

    // Add field markers
    filtered.filter(a => a.lat && a.lng).forEach(a => {
      const circle = new mapsApi.Circle({
        map,
        center: { lat: a.lat, lng: a.lng },
        radius: 3000,
        fillColor: a.advisory_color || '#3b82f6',
        fillOpacity: 0.8,
        strokeColor: '#fff',
        strokeWeight: 1,
        clickable: true,
      })

      circle.addListener('click', () => {
        infoRef.current.setContent(`
          <div class="gmap-info">
            <div class="gmap-info-title">Field ${a.field_id}</div>
            <div class="gmap-info-row"><span>Crop</span><span>${a.crop}</span></div>
            <div class="gmap-info-row"><span>Stage</span><span>${a.growth_stage}</span></div>
            <div class="gmap-info-row"><span>Stress</span><span>${a.stress_level}</span></div>
            <div class="gmap-info-row"><span>VCI</span><span>${a.vci}</span></div>
            <div class="gmap-info-row"><span>Water needed</span><span>${a.water_to_apply_mm} mm</span></div>
            <div style="margin-top:6px; font-weight:600; color:${a.advisory_color}">${a.recommendation}</div>
          </div>
        `)
        infoRef.current.setPosition({ lat: a.lat, lng: a.lng })
        infoRef.current.open(map)
      })

      markersRef.current.push(circle)
    })

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

    return () => {
      // Clean up GeoJSON features if needed, though they stay on the map instance
      map.data.forEach(feature => map.data.remove(feature))
    }
  }, [map, mapsApi, filtered, userCoords])

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <span className="live-dot" aria-hidden="true" />
          Rule-Based + FAO-56
        </div>
        <h1 className="page-title">Irrigation Advisory</h1>
        <p className="page-subtitle">
          Field-level water deficit estimation · Sorted by urgency · Karnataka
        </p>
      </div>

      {error   && <div className="error-card" role="alert">API Error: {error}</div>}

      <>
        {/* Priority KPIs */}
        <div className="kpi-grid">
          {Object.entries(PRIORITY_CONFIG).map(([key, conf], i) => (
            <div key={key} className="kpi-card fade-up"
              style={{ animationDelay: `${i*0.05}s`, cursor:'pointer' }}
              onClick={() => setFilter(filter === key ? 'ALL' : key)}
              role="button"
              tabIndex={0}
              aria-label={`Filter by ${key} priority. ${priorityCounts[key] || 0} fields`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setFilter(filter === key ? 'ALL' : key)
                }
              }}>
              <div className="kpi-label">{conf.label}</div>
              <div className="kpi-value" style={{ fontSize:26 }}>{priorityCounts[key] || 0}</div>
              <div className="kpi-sub">fields</div>
              <div style={{ position:'absolute', top:16, right:16, fontSize:22 }}>{conf.icon}</div>
              <div className="kpi-accent-bar" style={{ background: filter === key ? 'var(--blue-500)' : 'transparent', transition: 'background 0.2s' }} />
            </div>
          ))}
        </div>

        <div className="section-grid cols-2">
          {/* Map with field markers */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Field Advisory Map</span>
              <span style={{ fontSize:11, color:'var(--navy-400)' }}>Click markers for details</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="gmap-container" style={{ height: 420, borderRadius: 0, position: 'relative' }} role="region" aria-label="Field advisory map">
                <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                {loading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,15,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <div className="spinner" />
                    <span style={{ marginLeft: 12, color: '#fff', fontWeight: 500 }}>Generating irrigation advisories…</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advisory Rules Reference */}
          <div className="card">
            <div className="card-header"><span className="card-title">Advisory Rules</span></div>
            <div className="card-body">
              {Object.entries(data?.advisory_rules || {}).map(([stress, rule]) => (
                <div key={stress} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', gap:12
                }}>
                  <div>
                    <div style={{ fontSize:12, color:'#fff', fontWeight:500 }}>{stress}</div>
                    <div style={{ fontSize:11, color:'var(--navy-300)' }}>{rule.message}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <span className={`badge badge-${rule.priority?.toLowerCase()}`}>{rule.urgency}</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:16, background:'rgba(255,255,255,0.03)', borderRadius:'var(--r-sm)', padding:'12px' }}>
                <div style={{ fontSize:11, color:'var(--navy-400)', marginBottom:4, fontWeight:600, letterSpacing:'0.05em' }}>WATER BALANCE MODEL</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--emerald-400)' }}>
                  ETc = ET₀ × Kc (FAO-56)
                </div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--blue-400)' }}>
                  Deficit = ETc − Rainfall
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Command Area Gate Advisory Table */}
        {commandData && (
          <div style={{ padding:'0 24px 28px' }}>
            <div className="card">
              <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span className="card-title">🚰 Canal Command Distributary Advisory (PMKSY Planning)</span>
                <span className="badge badge-blue">Canal Gate Controller Strategy</span>
              </div>
              <div className="card-body" style={{ padding:0, overflowX:'auto' }}>
                <table className="data-table">
                  <caption className="sr-only">Command area canal distributary advisory table</caption>
                  <thead>
                    <tr>
                      <th scope="col">Command Distributary</th>
                      <th scope="col" style={{ textAlign:'center' }}>Monitored Fields</th>
                      <th scope="col" style={{ textAlign:'center' }}>Critical Alerts</th>
                      <th scope="col" style={{ textAlign:'center' }}>Average VCI</th>
                      <th scope="col" style={{ textAlign:'center' }}>Total Crop Demand (mm)</th>
                      <th scope="col" style={{ textAlign:'center' }}>Total Deficit (mm)</th>
                      <th scope="col">Recommended Discharge</th>
                      <th scope="col">Gate Controller Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandData.map(c => (
                      <tr key={c.command_area}>
                        <td><strong style={{ color:'var(--blue-400)' }}>{c.command_area}</strong></td>
                        <td style={{ textAlign:'center', fontFamily:'var(--font-mono)' }}>{c.total_fields_monitored}</td>
                        <td style={{ textAlign:'center' }}>
                          <span className={c.critical_fields > 0 ? 'badge badge-critical' : 'badge badge-ok'}>
                            {c.critical_fields}
                          </span>
                        </td>
                        <td style={{ textAlign:'center', fontFamily:'var(--font-mono)' }}>{c.average_vci}%</td>
                        <td style={{ textAlign:'center', fontFamily:'var(--font-mono)' }}>{c.total_crop_demand_mm}</td>
                        <td style={{ textAlign:'center', fontFamily:'var(--font-mono)', color: c.total_deficit_mm > 0 ? '#ef4444' : '#10b981' }}>
                          {c.total_deficit_mm}
                        </td>
                        <td>
                          <span className="badge" style={{ background: c.color+'22', color: c.color, fontWeight:700 }}>
                            {c.discharge_recommendation}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize:11, color:'var(--navy-300)' }}>
                            {c.gate_action}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Advisory Table */}
        <div style={{ padding:'0 24px 28px' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Field Advisory Table</span>
              <div style={{ display:'flex', gap:6 }}>
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(f => (
                  <button
                    key={f}
                    className={`btn btn-ghost ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                    aria-label={`Show ${f} priority advisories`}
                    aria-pressed={filter === f}
                  >
                    {f}
                  </button>
                ))}
                <button
                  className="btn btn-primary"
                  aria-label="Export filtered advisories as CSV file"
                  style={{ marginLeft: 12 }}
                  onClick={() => {
                  const headers = "Field,Crop,Soil,Stage,VCI,Stress,Rainfall(mm),ETc(mm),Deficit(mm),Apply(mm)\n";
                  const escCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
                  const csv = filtered.map(a =>
                    [a.field_id, a.crop, a.soil_type || 'Loam', a.growth_stage,
                     a.vci, a.stress_level, a.rainfall_mm,
                     a.crop_water_requirement_mm, a.water_deficit_mm, a.water_to_apply_mm]
                    .map(escCsv).join(',')
                  ).join('\n');
                  const blob = new Blob([headers + csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `irrigation_advisories_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                }}
                >
                  📥 Export CSV
                </button>
              </div>
            </div>
            <div className="card-body" style={{ padding:0, overflowX:'auto' }}>
              <table className="data-table">
                <caption className="sr-only">Field irrigation advisory table sorted by urgency</caption>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Crop</th>
                    <th scope="col">Soil Type</th>
                    <th scope="col">Stage</th>
                    <th scope="col">VCI</th>
                    <th scope="col">Stress</th>
                    <th scope="col">Rainfall (mm)</th>
                    <th scope="col">ETc (mm)</th>
                    <th scope="col">Deficit (mm)</th>
                    <th scope="col">Apply (mm)</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.field_id}>
                      <td><strong style={{ color:'var(--blue-400)', fontFamily:'var(--font-mono)' }}>{a.field_id}</strong></td>
                      <td>{a.crop}</td>
                      <td><span style={{ fontSize:11, color:'var(--navy-300)' }}>{a.soil_type || 'Loam'}</span></td>
                      <td><span style={{ fontSize:11, color:'var(--navy-400)' }}>{a.growth_stage}</span></td>
                      <td><span style={{ fontFamily:'var(--font-mono)', color: a.advisory_color }}>{a.vci}</span></td>
                      <td><span className={`badge badge-${a.priority?.toLowerCase()}`}>{a.stress_level}</span></td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{a.rainfall_mm}</td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{a.crop_water_requirement_mm}</td>
                      <td style={{ fontFamily:'var(--font-mono)', color: a.water_deficit_mm > 0 ? '#ef4444' : '#10b981' }}>
                        {a.water_deficit_mm}
                      </td>
                      <td style={{ fontFamily:'var(--font-mono)', color:'var(--blue-400)', fontWeight:600 }}>
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
    </div>
  )
}
