import { useState, useEffect, useRef } from 'react'
import { useLeafletMap } from '../hooks/useLeafletMap.js'
import L from 'leaflet'
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

const STRESS_ICONS = {
  'Severe Stress': 'S',
  'High Stress': 'H',
  'Moderate Stress': 'M',
  'Low Stress': 'L',
  'Healthy': 'OK',
}

export default function MoistureStress({ userCoords, userBbox, mapViewState, onMapChange }) {
  const [stressData,   setStressData]   = useState(null)
  const [phenology,    setPhenology]    = useState([])
  const [stressPoints, setStressPoints] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const mapRef    = useRef(null)
  const circlesRef= useRef([])

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
      axios.get(`${API}/api/stress-map${params}`),
      axios.get(`${API}/api/phenology`),
      axios.get(`${API}/api/stress-geojson${params}`).catch(() => null),
    ]).then(([stressRes, phenoRes, sgRes]) => {
      setStressData(stressRes.data)
      setPhenology(phenoRes.data.data || [])
      if (sgRes?.data?.features) setStressPoints(sgRes.data.features)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
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

  // Draw stress points on Leaflet Map
  useEffect(() => {
    if (!map || stressPoints.length === 0) return
    circlesRef.current.forEach(c => { try { map.removeLayer(c) } catch(e){} })
    circlesRef.current = []

    stressPoints.forEach(f => {
      const [lng, lat] = f.geometry.coordinates
      const { vci, stress_label, phenology_stage, crop_name, field_id } = f.properties
      const color = STRESS_PALETTE[stress_label]?.color || '#60a5fa'

      const circle = L.circle([lat, lng], {
        radius: 5000,
        color: '#fff',
        weight: 1,
        fillColor: color,
        fillOpacity: 0.65,
        opacity: 0.25,
      }).addTo(map)

      circle.bindPopup(`
        <div class="gmap-info">
          <div class="gmap-info-title">${stress_label}</div>
          <div class="gmap-info-row"><span>Crop</span><span>${crop_name}</span></div>
          <div class="gmap-info-row"><span>Stage</span><span>${phenology_stage}</span></div>
          <div class="gmap-info-row"><span>VCI</span><span>${vci}</span></div>
        </div>
      `)

      circle.on('click', () => {
        window.dispatchEvent(new CustomEvent('pragati-field-selected', {
          detail: {
            field_id: field_id || `STR-${lat.toFixed(2)}-${lng.toFixed(2)}`,
            crop: crop_name,
            vci: vci,
            stage: phenology_stage,
            rainfall_mm: 0
          }
        }))
      })

      circlesRef.current.push(circle)
    })

    if (userCoords) {
      const userMarker = L.circleMarker([userCoords.lat, userCoords.lng], {
        radius: 8, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1,
      }).bindTooltip('Your location').addTo(map)
      circlesRef.current.push(userMarker)
    }

    return () => {
      circlesRef.current.forEach(c => { try { map.removeLayer(c) } catch(e){} })
      circlesRef.current = []
    }
  }, [map, stressPoints, userCoords])

  const distribution = stressData?.stress_distribution || {}
  const donutData = {
    labels: Object.keys(distribution),
    datasets: [{
      data: Object.values(distribution).map(v => v.area_ha),
      backgroundColor: Object.keys(distribution).map(k => STRESS_PALETTE[k]?.color || '#64748b'),
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }
  const donutOptions = {
    plugins: {
      legend: { labels: { color: '#cbd5e1', font: { size: 12 }, padding: 20 } },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.parsed.toLocaleString()} ha (${distribution[ctx.label]?.percentage}%)`
        }
      }
    },
    cutout: '65%',
    responsive: true,
    maintainAspectRatio: false,
  }

  if (error) {
    throw new Error(error);
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <span className="live-dot" aria-hidden="true" />
          Sentinel-2 Optical · Sentinel-1 SAR
        </div>
        <h1 className="page-title">Moisture Stress Detection</h1>
        <p className="page-subtitle">
          VCI from NDVI anomalies · Phenology-aware classification · Karnataka
        </p>
      </div>

      <>
        {/* VCI Formula Banner */}
        <div style={{ padding: '0 24px 24px', marginTop: '24px' }}>
          <div className="card">
            <div className="card-body" style={{ display:'flex', flexWrap:'wrap', gap:24, alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11, color:'var(--navy-400)', marginBottom:4, fontWeight:600, letterSpacing:'0.05em' }}>DEEP LEARNING MODEL</div>
                <div style={{ fontFamily:'var(--font-mono)', color:'var(--emerald-400)', fontSize:13 }}>
                  LSTM(NDVI<sub style={{fontSize:9}}>t</sub>, NDWI<sub style={{fontSize:9}}>t</sub>, Precip<sub style={{fontSize:9}}>t</sub>) → Stress Score
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--navy-400)', marginBottom:4, fontWeight:600, letterSpacing:'0.05em' }}>SOIL MOISTURE INDEX (SMI)</div>
                <div style={{ fontFamily:'var(--font-mono)', color:'var(--blue-400)', fontSize:13 }}>
                  SMI = (VH<sub style={{fontSize:9}}>t</sub> + 25) / 15 × 100
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--navy-400)', marginBottom:4, fontWeight:600, letterSpacing:'0.05em' }}>DATA SOURCE</div>
                <div style={{ color:'var(--navy-200)', fontSize:12 }}>Sentinel-2 SR · 6-Month Archive</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--navy-400)', marginBottom:4, fontWeight:600, letterSpacing:'0.05em' }}>SAR CORRECTION</div>
                <div style={{ color:'var(--navy-200)', fontSize:12 }}>Sentinel-1 VH backscatter adjustment</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-grid cols-2">
          {/* Stress Map */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">LSTM Stress Map</span>
              <div style={{ display:'flex', gap:4 }}>
                {['#ef4444','#f97316','#f59e0b','#84cc16','#10b981'].map((c,i) => (
                  <div key={i} style={{ width:20, height:8, background:c, borderRadius:2 }} />
                ))}
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="gmap-container" style={{ height: 420, borderRadius: 0, position: 'relative' }} role="region" aria-label="Karnataka moisture stress satellite map">
                <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                {loading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,15,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <div className="spinner" />
                    <span style={{ marginLeft: 12, color: '#fff', fontWeight: 500 }}>Computing VCI from Sentinel-2 time series…</span>
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:12, padding: '12px 18px', flexWrap:'wrap', background: 'var(--navy-950)' }}>
                {['Severe','High','Moderate','Low','Healthy'].map((l, i) => (
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:['#ef4444','#f97316','#f59e0b','#84cc16','#10b981'][i] }} />
                    <span style={{ fontSize:11, color:'var(--navy-300)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Donut Chart + Stats */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Stress Distribution</span></div>
              <div className="card-body">
                {Object.keys(distribution).length > 0 ? (
                  <div style={{ height: 220, position: 'relative' }} role="img" aria-label="Moisture stress distribution donut chart showing area percentages">
                    <Doughnut data={donutData} options={donutOptions} />
                  </div>
                ) : (
                  <p style={{ color:'var(--navy-400)', fontSize:12 }}>No data available.</p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Phenology Timeline</span></div>
              <div className="card-body">
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {[
                    { label:'Sowing',     ndvi:'0.0–0.2', color:'#f59e0b', icon:'🌱' },
                    { label:'Vegetative', ndvi:'0.2–0.5', color:'#10b981', icon:'🌿' },
                    { label:'Flowering',  ndvi:'0.5–0.7', color:'#8b5cf6', icon:'🌸' },
                    { label:'Maturity',   ndvi:'0.7–1.0', color:'#f97316', icon:'🌾' },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex:'1 1 calc(50% - 8px)',
                      background:'rgba(255,255,255,0.03)',
                      border:`1px solid ${s.color}33`,
                      borderRadius: 'var(--r-sm)',
                      padding:'10px 12px',
                    }}>
                      <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                      <div style={{ fontWeight:600, color:s.color, fontSize:12 }}>{s.label}</div>
                      <div style={{ fontSize:11, color:'var(--navy-400)' }}>NDVI: {s.ndvi}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stress Table */}
        {Object.keys(distribution).length > 0 && stressData?.stress_categories && (
          <div style={{ padding:'0 24px 28px' }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Stress Category Breakdown</span></div>
              <div className="card-body" style={{ padding:0 }}>
                <table className="data-table">
                  <caption className="sr-only">Moisture stress category breakdown by area and VCI range</caption>
                  <thead>
                    <tr>
                      <th scope="col" aria-label="Stress icon">Icon</th>
                      <th scope="col">Stress Category</th>
                      <th scope="col">VCI Range</th>
                      <th scope="col">Area (ha)</th>
                      <th scope="col">Coverage</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stressData.stress_categories.map(cat => {
                      const dist = distribution[cat.label] || {}
                      const conf = STRESS_PALETTE[cat.label] || {}
                      return (
                        <tr key={cat.label}>
                          <td aria-hidden="true">{STRESS_ICONS[cat.label] || '-'}</td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:12, height:12, borderRadius:3, background:cat.color }} />
                              <span style={{ color:'#fff', fontWeight:500 }}>{cat.label}</span>
                            </div>
                          </td>
                          <td><code style={{ fontSize:12, color:'var(--navy-400)', fontFamily:'var(--font-mono)' }}>{cat.vci_range}</code></td>
                          <td><span style={{ fontFamily:'var(--font-mono)', color: cat.color }}>{dist.area_ha?.toLocaleString() || '—'}</span></td>
                          <td>
                            {dist.percentage != null && (
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div className="progress-track" style={{ flex:1, maxWidth:100, marginTop:0 }}>
                                  <div className="progress-fill" style={{ width:`${dist.percentage}%`, background:cat.color }} />
                                </div>
                                <span style={{ fontSize:11, color:'var(--navy-400)' }}>{dist.percentage}%</span>
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
    </div>
  )
}
