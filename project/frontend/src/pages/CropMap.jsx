
import { useState, useEffect, useRef } from 'react'

import { useGoogleMap } from '../hooks/useGoogleMap.js'

import axios from 'axios'



const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'



const CROP_COLORS = {

  Rice:      '#3b82f6',

  Maize:     '#f59e0b',

  Sugarcane: '#10b981',

  Others:    '#8b5cf6',

}



const CLASS_NAMES = ['Rice', 'Maize', 'Sugarcane', 'Others']



export default function CropMap({ userCoords }) {

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

  const infoWindowRef = useRef(null)



  const center = userCoords || { lat: 15.3, lng: 75.7 }

  const { map, mapsApi } = useGoogleMap(mapRef, { center, zoom: 7 })



  // Fetch data

  useEffect(() => {

    Promise.all([

      axios.get(`${API}/api/crop-stats`),

      axios.get(`${API}/api/crop-map`).catch(() => null),

      axios.get(`${API}/api/crop-geojson`).catch(() => null),

    ]).then(([statsRes, cropMapRes, geoRes]) => {

      setCropData(statsRes.data)

      if (cropMapRes?.data) {

        setLiveData(cropMapRes.data)

        setLiveMetrics(cropMapRes.data.metrics || null)

      }

      if (geoRes?.data?.features) setCropPoints(geoRes.data.features)

      setLoading(false)

    }).catch(e => { setError(e.message); setLoading(false) })

  }, [activeBand])



  // Place markers on Google Map

  useEffect(() => {

    if (!map || !mapsApi || cropPoints.length === 0) return



    // Clear old markers

    markersRef.current.forEach(m => m.setMap(null))

    markersRef.current = []



    if (!infoWindowRef.current) {

      infoWindowRef.current = new mapsApi.InfoWindow()

    }



    cropPoints.forEach(feature => {

      const { coordinates } = feature.geometry

      const { crop_name, confidence, field_id, color } = feature.properties



      const circle = new mapsApi.Circle({

        map,

        center: { lat: coordinates[1], lng: coordinates[0] },

        radius: 4000,

        fillColor: CROP_COLORS[crop_name] || color || '#60a5fa',

        fillOpacity: 0.7,

        strokeColor: '#fff',

        strokeWeight: 1,

        strokeOpacity: 0.3,

        clickable: true,

      })



      circle.addListener('click', () => {

        infoWindowRef.current.setContent(`

          <div class="gmap-info">

            <div class="gmap-info-title">${field_id}</div>

            <div class="gmap-info-row"><span>Crop</span><span>${crop_name}</span></div>

            <div class="gmap-info-row"><span>Confidence</span><span>${confidence}%</span></div>

            <div class="gmap-info-row"><span>Model</span><span>${selectedModel.toUpperCase()}</span></div>

          </div>

        `)

        infoWindowRef.current.setPosition({ lat: coordinates[1], lng: coordinates[0] })

        infoWindowRef.current.open(map)

      })



      markersRef.current.push(circle)

    })



    // If user location exists, add a user marker

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

  }, [map, mapsApi, cropPoints, userCoords, selectedModel])



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

