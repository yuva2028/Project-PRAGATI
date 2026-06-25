import { useState, useEffect } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js'
import axios from 'axios'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
    tooltip: { backgroundColor: '#1e293b', borderColor: '#3b82f6', borderWidth: 1 }
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 8 } },
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
  }
}

export default function Analytics() {
  const [ndviData,     setNdviData]     = useState([])
  const [phenoMetrics, setPhenoMetrics] = useState(null)
  const [rainfallData, setRainfallData] = useState(null)
  const [rainfallSeries, setRainfallSeries] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/ndvi`),
      axios.get(`${API}/api/rainfall`),
      axios.get(`${API}/api/rainfall-series`),
    ])
    .then(([ndviRes, rainRes, rainSeriesRes]) => {
      setNdviData(ndviRes.data.data || [])
      setPhenoMetrics(ndviRes.data.metrics || null)
      setRainfallData(rainRes.data)
      setRainfallSeries(rainSeriesRes.data.data || [])
      setLoading(false)
    })
    .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const STAGE_COLORS = { Sowing:'#f59e0b', Vegetative:'#10b981', Flowering:'#8b5cf6', Maturity:'#f97316' }

  const ndviChartData = ndviData.length ? {
    labels: ndviData.map(d => d.date),
    datasets: [
      {
        label: 'NDVI',
        data: ndviData.map(d => d.ndvi),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: ndviData.map(d => STAGE_COLORS[d.phenology_stage] || '#10b981'),
        pointRadius: 5,
        pointHoverRadius: 8,
      },
      {
        label: 'VCI / 100',
        data: ndviData.map(d => d.vci / 100),
        borderColor: '#3b82f6',
        backgroundColor: 'transparent',
        borderDash: [5,5],
        tension: 0.4,
        pointRadius: 3,
      },
    ]
  } : null

  const stressTrendData = ndviData.length ? {
    labels: ndviData.map(d => d.date),
    datasets: [{
      label: 'VCI',
      data: ndviData.map(d => d.vci),
      backgroundColor: ndviData.map(d => {
        const v = d.vci
        if (v < 20) return '#ef4444'
        if (v < 40) return '#f97316'
        if (v < 60) return '#f59e0b'
        if (v < 80) return '#84cc16'
        return '#10b981'
      }),
      borderWidth: 0,
      borderRadius: 4,
    }]
  } : null

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <span className="live-dot" aria-hidden="true" />
          GEE · CHIRPS · ERA5
        </div>
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">
          NDVI Time Series · Rainfall Aggregation · Karnataka
        </p>
      </div>

      {loading && <div className="loading-wrap"><div className="spinner" /><p className="loading-text">Fetching time series from Google Earth Engine & CHIRPS…</p></div>}
      {error   && <div className="error-card" role="alert">API Error: {error}</div>}

      {!loading && (
        <>
          {/* Rainfall Summary */}
          {rainfallData && (
            <div className="kpi-grid">
              {[
                { label:'Total Rainfall (6mo)', value:`${rainfallData.total_rainfall_mm} mm`, sub:'CHIRPS Daily Aggregate', color:'#3b82f6' },
                { label:'Avg Daily Rainfall',   value:`${rainfallData.avg_daily_rainfall_mm} mm`, sub:'CHIRPS per-pixel mean', color:'#0ea5e9' },
                { label:'Start of Season',      value: phenoMetrics?.start_of_season || 'N/A', sub:'Algorithmic SOS detection', color:'#10b981' },
                { label:'Peak Growth Date',     value: phenoMetrics?.peak_growth_date || 'N/A', sub:'Max NDVI in series', color:'#8b5cf6' },
                { label:'Est. LGP',             value: phenoMetrics?.length_of_growing_period_days ? `${phenoMetrics.length_of_growing_period_days} Days` : 'N/A', sub:'Length of Growing Period', color:'#f97316' },
              ].map((k, i) => (
                <div key={k.label} className="kpi-card fade-up" style={{ animationDelay:`${(i)*0.05}s` }}>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
                  <div className="kpi-sub">{k.sub}</div>
                  <div className="kpi-accent-bar" style={{ background: k.color + '40' }} />
                </div>
              ))}
            </div>
          )}

          <div className="section-grid" style={{ gridTemplateColumns:'1fr' }}>
            {/* NDVI Time Series */}
            <div className="card fade-up" style={{ animationDelay: '0.25s' }}>
              <div className="card-header">
                <span className="card-title">NDVI & VCI Time Series</span>
                <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--navy-400)' }}>
                  {Object.entries(STAGE_COLORS).map(([s,c]) => (
                    <div key={s} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{ width:8,height:8,borderRadius:'50%',background:c }} /> {s}
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-body">
                {ndviChartData ? (
                  <div style={{ height:300 }} role="img" aria-label="NDVI and VCI time series line chart for Karnataka pilot">
                    <Line data={ndviChartData} options={{ ...CHART_OPTS,
                      scales: { ...CHART_OPTS.scales,
                        y: { ...CHART_OPTS.scales.y, min:-0.1, max:1.0,
                          title: { display:true, text:'Index Value', color:'#64748b' } }
                      }
                    }} />
                  </div>
                ) : (
                  <p style={{ color:'var(--navy-400)', fontSize:12, textAlign:'center', padding:40 }}>
                    NDVI data requires GEE authentication. Connect backend to see live chart.
                  </p>
                )}
              </div>
            </div>

            {/* VCI Stress Bar Chart */}
            <div className="card fade-up" style={{ animationDelay: '0.3s' }}>
              <div className="card-header">
                <span className="card-title">Stress Level Trend (VCI)</span>
                <div style={{ display:'flex', gap:6 }}>
                  {['0-20 Severe','20-40 High','40-60 Mod','60-80 Low','80+ Healthy'].map((l,i) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10 }}>
                      <div style={{ width:8,height:8,borderRadius:2,background:['#ef4444','#f97316','#f59e0b','#84cc16','#10b981'][i] }} />
                      <span style={{ color:'var(--navy-400)' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-body">
                {stressTrendData ? (
                  <div style={{ height:260 }} role="img" aria-label="VCI stress level bar chart">
                    <Bar data={stressTrendData} options={{ ...CHART_OPTS,
                      scales: { ...CHART_OPTS.scales,
                        y: { ...CHART_OPTS.scales.y, min:0, max:100,
                          title: { display:true, text:'VCI Score', color:'#64748b' } }
                      }
                    }} />
                  </div>
                ) : (
                  <p style={{ color:'var(--navy-400)', fontSize:12, textAlign:'center', padding:40 }}>
                    Stress trend requires live GEE data. Connect backend to see real values.
                  </p>
                )}
              </div>
            </div>

            {/* CHIRPS Monthly Rainfall Chart */}
            <div className="card fade-up" style={{ animationDelay: '0.35s' }}>
              <div className="card-header">
                <span className="card-title">Monthly Rainfall (CHIRPS)</span>
                <span style={{ fontSize:11, color:'var(--navy-400)' }}>India · 6-month · mm/month</span>
              </div>
              <div className="card-body">
                {rainfallSeries.length > 0 ? (
                  <div style={{ height:260 }} role="img" aria-label="Monthly CHIRPS rainfall bar chart in millimetres">
                    <Bar
                      data={{
                        labels: rainfallSeries.map(d => d.date),
                        datasets: [{
                          label: 'Rainfall (mm)',
                          data: rainfallSeries.map(d => d.rainfall_mm),
                          backgroundColor: rainfallSeries.map(d => {
                            const maxMm = Math.max(...rainfallSeries.map(x => x.rainfall_mm))
                            const intensity = d.rainfall_mm / maxMm
                            return `rgba(59,130,246,${0.30 + intensity * 0.70})`
                          }),
                          borderColor: '#3b82f6',
                          borderWidth: 1,
                          borderRadius: 5,
                        }]
                      }}
                      options={{ ...CHART_OPTS,
                        scales: { ...CHART_OPTS.scales,
                          y: { ...CHART_OPTS.scales.y, min:0,
                            title: { display:true, text:'Rainfall (mm)', color:'#64748b' } }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <p style={{ color:'var(--navy-400)', fontSize:12, textAlign:'center', padding:40 }}>
                    Loading CHIRPS rainfall series...
                  </p>
                )}
              </div>
            </div>

            {/* Index Reference Table */}
            <div className="card fade-up" style={{ animationDelay: '0.4s' }}>
              <div className="card-header"><span className="card-title">Index Reference</span></div>
              <div className="card-body" style={{ padding:0 }}>
                <table className="data-table" style={{ width: '100%', overflowX: 'auto', display: 'block' }}>
                  <caption className="sr-only">Spectral index reference table</caption>
                  <thead style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                    <tr>
                      <th scope="col" style={{ width: '15%' }}>Index</th>
                      <th scope="col" style={{ width: '35%' }}>Formula</th>
                      <th scope="col" style={{ width: '15%' }}>Bands Used</th>
                      <th scope="col" style={{ width: '15%' }}>Source</th>
                      <th scope="col" style={{ width: '20%' }}>Purpose</th>
                    </tr>
                  </thead>
                  <tbody style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                    {[
                      { idx:'NDVI', formula:'(NIR−RED)/(NIR+RED)', bands:'B8, B4', src:'Sentinel-2', purpose:'Vegetation vigor' },
                      { idx:'NDWI', formula:'(NIR−SWIR)/(NIR+SWIR)', bands:'B8, B11', src:'Sentinel-2', purpose:'Water content' },
                      { idx:'EVI',  formula:'2.5×(NIR−RED)/(NIR+6R−7.5B+1)', bands:'B8,B4,B2', src:'Sentinel-2', purpose:'Enhanced vegetation' },
                      { idx:'VV',   formula:'Backscatter (dB)', bands:'VV', src:'Sentinel-1', purpose:'Surface structure' },
                      { idx:'VH',   formula:'Backscatter (dB)', bands:'VH', src:'Sentinel-1', purpose:'Crop moisture' },
                      { idx:'VCI',  formula:'(NDVI−NDVImin)/(NDVImax−NDVImin)×100', bands:'Derived', src:'GEE Composite', purpose:'Moisture stress' },
                    ].map(r => (
                      <tr key={r.idx}>
                        <td style={{ width: '15%' }}><strong style={{ color:'var(--blue-400)', fontFamily:'var(--font-mono)' }}>{r.idx}</strong></td>
                        <td style={{ width: '35%' }}><code style={{ fontSize:11, color:'var(--navy-300)' }}>{r.formula}</code></td>
                        <td style={{ width: '15%' }}><code style={{ fontSize:11, color:'var(--blue-300)' }}>{r.bands}</code></td>
                        <td style={{ fontSize:12, width: '15%', color: 'var(--navy-200)' }}>{r.src}</td>
                        <td style={{ fontSize:12, color:'var(--navy-400)', width: '20%' }}>{r.purpose}</td>
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
