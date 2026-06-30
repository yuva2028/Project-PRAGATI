
import { useState, useEffect, useRef } from 'react'

import { useLeafletMap } from '../hooks/useLeafletMap.js'
import L from 'leaflet'

import axios from 'axios'



const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'



const CROP_COLORS = {

  Rice:      '#3b82f6',

  Maize:     '#f59e0b',

  Sugarcane: '#10b981',

  Others:    '#8b5cf6',

}



const CLASS_NAMES = ['Rice', 'Maize', 'Sugarcane', 'Others']



export default function CropMap({ userCoords, userBbox, mapViewState, onMapChange }) {

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



  const center = userCoords || { lat: 20.5937, lng: 78.9629 }

  const { map, fitBounds } = useLeafletMap(mapRef, { 
    center, 
    zoom: userCoords ? 10 : 5,
    mapViewState,
    onMapChange 
  })



  // Fetch data
  useEffect(() => {
    setLoading(true)
    const params = userCoords ? `?lat=${userCoords.lat}&lng=${userCoords.lng}` : ''
    Promise.all([
      axios.get(`${API}/api/crop-stats`),
      axios.get(`${API}/api/crop-map`).catch(() => null),
      axios.get(`${API}/api/crop-geojson${params}`).catch(() => null),
    ]).then(([statsRes, cropMapRes, geoRes]) => {

      setCropData(statsRes.data)

      if (cropMapRes?.data) {

        setLiveData(cropMapRes.data)

        setLiveMetrics(cropMapRes.data.metrics || null)

      }

      if (geoRes?.data?.features) setCropPoints(geoRes.data.features)

      setLoading(false)

    }).catch(e => { setError(e.message); setLoading(false) })
  }, [activeBand, userCoords])

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



  // Place markers on Leaflet Map

  useEffect(() => {

    if (!map || cropPoints.length === 0) return



    // Clear old markers

    markersRef.current.forEach(m => { try { map.removeLayer(m) } catch(e){} })

    markersRef.current = []



    cropPoints.forEach(feature => {

      const { coordinates } = feature.geometry

      const { crop_name, confidence, field_id, color } = feature.properties



      const circle = L.circle([coordinates[1], coordinates[0]], {

        radius: 4000,

        color: '#fff',
        weight: 1,
        opacity: 0.3,
        fillColor: CROP_COLORS[crop_name] || color || '#60a5fa',

        fillOpacity: 0.7,

      }).addTo(map)



      circle.bindPopup(`

        <div class="gmap-info">

          <div class="gmap-info-title">${field_id}</div>

          <div class="gmap-info-row"><span>Crop</span><span>${crop_name}</span></div>

          <div class="gmap-info-row"><span>Confidence</span><span>${confidence}%</span></div>

          <div class="gmap-info-row"><span>Model</span><span>${selectedModel.toUpperCase()}</span></div>

        </div>

      `)



      circle.on('click', () => {

        window.dispatchEvent(new CustomEvent('pragati-field-selected', {
          detail: {
            field_id: field_id,
            crop: crop_name,
            vci: 50,
            stage: "Vegetative",
            rainfall_mm: 0
          }
        }))

      })



      markersRef.current.push(circle)

    })



    // If user location exists, add a user marker

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

  }, [map, cropPoints, userCoords, selectedModel])



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



  if (loading) return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-slate-500 font-medium">Fetching Earth Engine Data...</div>
      </div>
    </div>
  )

  if (error) {
    throw new Error(error);
  }

  const handleFieldSelect = (id) => {
    // optional logic
  }

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



      {error   && <div className="error-card" role="alert">API Error: {error}</div>}

      {!error && (
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
            <div className="gmap-container" style={{ height: 420, position: 'relative' }} role="region" aria-label="Karnataka crop classification map">
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
              {loading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,15,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <div className="spinner" />
                  <span style={{ marginLeft: 12, color: '#fff', fontWeight: 500 }}>Running classification model…</span>
                </div>
              )}
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

