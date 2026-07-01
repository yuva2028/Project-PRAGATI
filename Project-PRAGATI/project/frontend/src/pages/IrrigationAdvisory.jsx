import { useState, useEffect, useRef } from 'react'
import { useLeafletMap } from '../hooks/useLeafletMap.js'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
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
    // Ganga–Yamuna doab main canal (north India)
    { "type": "Feature", "properties": { "type": "main_canal" }, "geometry": { "type": "LineString", "coordinates": [[77.2, 28.6], [78.0, 27.5], [79.0, 26.5], [80.5, 25.5], [81.8, 25.0], [83.0, 24.5]] } },
    // Indira Gandhi Canal (Rajasthan)
    { "type": "Feature", "properties": { "type": "main_canal" }, "geometry": { "type": "LineString", "coordinates": [[73.9, 29.5], [72.5, 28.8], [71.2, 27.8], [70.5, 26.5]] } },
    // Krishna–Godavari system (Andhra / Telangana)
    { "type": "Feature", "properties": { "type": "main_canal" }, "geometry": { "type": "LineString", "coordinates": [[78.5, 17.5], [79.5, 16.8], [80.5, 16.3], [81.5, 16.0], [82.0, 16.5]] } },
    // Cauvery system (Karnataka / Tamil Nadu)
    { "type": "Feature", "properties": { "type": "distributary" }, "geometry": { "type": "LineString", "coordinates": [[75.8, 12.3], [76.5, 11.8], [77.5, 11.2], [78.5, 10.8], [79.5, 10.5]] } },
    // Brahmaputra / NE India
    { "type": "Feature", "properties": { "type": "distributary" }, "geometry": { "type": "LineString", "coordinates": [[91.5, 26.5], [92.5, 26.0], [93.5, 25.5], [94.5, 25.0]] } }
  ]
}

const COMMAND_AREA = {
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "properties": { "name": "India Agricultural Command Area" }, "geometry": { "type": "Polygon", "coordinates": [[[68.0, 37.0], [97.5, 37.0], [97.5, 8.0], [68.0, 8.0], [68.0, 37.0]]] } }
  ]
}

export default function IrrigationAdvisory({ userCoords, userBbox, mapViewState, onMapChange }) {
  const { t } = useTranslation()
  const [data,    setData]    = useState(null)
  const [commandData, setCommandData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState('ALL')

  const mapRef    = useRef(null)
  const markersRef= useRef([])

  const center = userCoords || { lat: 20.5937, lng: 78.9629 }
  const { map, fitBounds } = useLeafletMap(mapRef, { 
    center, 
    zoom: userCoords ? 10 : 5,
    mapViewState,
    onMapChange
  })

  useEffect(() => {
    setLoading(true)
    const params = userCoords ? `?lat=${userCoords.lat}&lng=${userCoords.lng}` : ''
    Promise.all([
      axios.get(`${API}/api/advisory${params}`),
      axios.get(`${API}/api/advisory/command-summary${params}`).catch(() => null)
    ])
    .then(([advRes, cmdRes]) => {
      setData(advRes.data)
      if (cmdRes?.data) setCommandData(cmdRes.data.command_areas)
      setLoading(false)
    })
    .catch(e => { setError(e.message); setLoading(false) })
  }, [userCoords])

  // Pan map when userCoords change
  useEffect(() => {
    if (map && userCoords) {
      if (userBbox) {
        fitBounds(userBbox)
      } else {
        map.panTo([userCoords.lat, userCoords.lng])
      }
    }
  }, [map, userCoords, userBbox])

  const advisories = data?.advisories || []
  const filtered = filter === 'ALL' ? advisories : advisories.filter(a => a.priority === filter)

  const priorityCounts = advisories.reduce((acc, a) => {
    acc[a.priority] = (acc[a.priority] || 0) + 1
    return acc
  }, {})

  // Leaflet map setup
  useEffect(() => {
    if (!map) return

    // Remove old layers
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []

    // Canal network GeoJSON overlay
    const canalLayer = L.geoJSON(CANAL_NETWORK, {
      style: (feature) => ({
        color: feature.properties.type === 'main_canal' ? '#3b82f6' : '#60a5fa',
        weight: feature.properties.type === 'main_canal' ? 3 : 1.5,
        opacity: 0.8,
      })
    }).addTo(map)
    markersRef.current.push(canalLayer)

    // Command area polygon
    const cmdLayer = L.geoJSON(COMMAND_AREA, {
      style: { color: '#f59e0b', weight: 2, fillOpacity: 0.05, opacity: 0.7 }
    }).addTo(map)
    markersRef.current.push(cmdLayer)

    // Field markers
    filtered.filter(a => a.lat && a.lng).forEach(a => {
      const circle = L.circle([a.lat, a.lng], {
        radius: 3000,
        color: '#fff',
        weight: 1,
        fillColor: a.advisory_color || '#3b82f6',
        fillOpacity: 0.8,
      }).addTo(map)

      circle.bindPopup(`
        <div class="gmap-info">
          <div class="gmap-info-title">Field ${a.field_id}</div>
          <div class="gmap-info-row"><span>Crop</span><span>${a.crop}</span></div>
          <div class="gmap-info-row"><span>Stage</span><span>${a.growth_stage}</span></div>
          <div class="gmap-info-row"><span>Stress</span><span>${a.stress_level}</span></div>
          <div class="gmap-info-row"><span>VCI</span><span>${a.vci}</span></div>
          <div class="gmap-info-row"><span>Water needed</span><span>${a.water_to_apply_mm} mm</span></div>
          <div class="gmap-info-row"><span>Confidence</span><span style="color:${a.confidence_score > 90 ? '#10b981' : '#f59e0b'}">${a.confidence_score}%</span></div>
          <div style="margin-top:6px;font-weight:600;color:${a.advisory_color}">${a.recommendation}</div>
          <div style="margin-top:4px;font-size:10px;color:#94a3b8;font-style:italic">${a.explanation || ''}</div>
        </div>
      `)

      circle.on('click', () => {
        window.dispatchEvent(new CustomEvent('pragati-field-selected', {
          detail: { field_id: a.field_id, crop: a.crop, vci: a.vci, stage: a.growth_stage, rainfall_mm: a.rainfall_mm }
        }))
      })

      markersRef.current.push(circle)
    })

    if (userCoords) {
      const userMarker = L.circleMarker([userCoords.lat, userCoords.lng], {
        radius: 8, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1,
      }).bindTooltip('Your location').addTo(map)
      markersRef.current.push(userMarker)
    }

    return () => {
      markersRef.current.forEach(m => { try { map.removeLayer(m) } catch(e){} })
      markersRef.current = []
    }
  }, [map, filtered, userCoords])

  if (error) {
    throw new Error(error);
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <span className="live-dot" aria-hidden="true" />
          {t("FAO-56 CROP WATER REQUIREMENT")}
        </div>
        <h1 className="page-title">{t("Irrigation Advisory")}</h1>
        <p className="page-subtitle">
          {t("Field-level water deficit estimation · Sorted by urgency · Karnataka")}
        </p>
      </div>

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
              <span className="card-title">{t("Field Advisory Map")}</span>
              <span style={{ fontSize:11, color:'var(--navy-400)' }}>{t("Click markers for details")}</span>
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
            <div className="card-header"><span className="card-title">{t("Advisory Rules")}</span></div>
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
                <div style={{ fontSize:11, color:'var(--navy-400)', marginBottom:4, fontWeight:600, letterSpacing:'0.05em' }}>{t("Water Balance Model")}</div>
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
                <span className="card-title">🚰 {t("Canal Command Distributary Advisory (PMKSY Planning)")}</span>
                <span className="badge badge-blue">{t("Canal Gate Controller Strategy")}</span>
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
              <span className="card-title">{t("Field Advisory Table")}</span>
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
                  📥 {t("Export CSV")}
                </button>
                <button
                  className="btn btn-ghost"
                  aria-label="Print advisory report or save as PDF"
                  style={{ marginLeft: 8 }}
                  onClick={() => window.print()}
                >
                  🖨️ {t("Print Report")}
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
                    <th scope="col">Confidence</th>
                    <th scope="col">Action</th>
                    <th scope="col">XAI Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.field_id} style={{ cursor: 'pointer' }} onClick={() => {
                      window.dispatchEvent(new CustomEvent('pragati-field-selected', {
                        detail: {
                          field_id: a.field_id,
                          crop: a.crop,
                          vci: a.vci,
                          stage: a.growth_stage,
                          rainfall_mm: a.rainfall_mm
                        }
                      }))
                    }}>
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
                        <span className={`badge ${a.confidence_score > 90 ? 'badge-ok' : 'badge-medium'}`}>
                          {a.confidence_score}%
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize:11, color: a.advisory_color, fontWeight:500, maxWidth:100 }}>
                          {a.urgency === 'NONE' ? '✅ No action' : `⏱ ${a.within_days}d`}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize:11, color:'var(--navy-300)', maxWidth:200, fontStyle:'italic' }}>
                          {a.explanation || 'No explanation available'}
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
