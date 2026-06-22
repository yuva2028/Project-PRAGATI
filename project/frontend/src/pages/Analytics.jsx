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
  plugins: {
    legend: { labels: { color: '#86efac', font: { size: 12 } } },
    tooltip: { backgroundColor: '#0f2318', borderColor: '#22c55e', borderWidth: 1 }
  },
  scales: {
    x: { grid: { color: 'rgba(34,197,94,0.06)' }, ticks: { color: '#4b7a5e', font: { size: 10 }, maxTicksLimit: 8 } },
    y: { grid: { color: 'rgba(34,197,94,0.06)' }, ticks: { color: '#4b7a5e', font: { size: 10 } } },
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

  const STAGE_COLORS = { Sowing:'#fbbf24', Vegetative:'#22c55e', Flowering:'#a855f7', Maturity:'#f59e0b' }

  const ndviChartData = ndviData.length ? {
    labels: ndviData.map(d => d.date),
    datasets: [
      {
        label: 'NDVI',
        data: ndviData.map(d => d.ndvi),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: ndviData.map(d => STAGE_COLORS[d.phenology_stage] || '#22c55e'),
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
        if (v < 20) return '#dc2626'
        if (v < 40) return '#f97316'
        if (v < 60) return '#eab308'
        if (v < 80) return '#84cc16'
        return '#22c55e'
      }),
      borderWidth: 0,
      borderRadius: 4,
    }]
  } : null

  return (
    <div>
      <div className="page-header">
        <div className="header-badge"><span className="live-dot" /> GEE · CHIRPS · ERA5</div>
        <h2>📈 Analytics</h2>
        <p>NDVI Time Series · Rainfall Aggregation · India</p>
      </div>

      {loading && <div className="loading-container"><div className="spinner" /><p className="loading-text">Fetching time series from Google Earth Engine & CHIRPS...</p></div>}
      {error   && <div style={{padding:'0 32px'}}><div className="error-card">API Error: {error}</div></div>}

      {!loading && (
        <>
          {/* Rainfall Summary */}
          {rainfallData && (
            <div className="kpi-grid">
              {[
                { label:'Total Rainfall (6mo)', value:`${rainfallData.total_rainfall_mm} mm`, sub:'CHIRPS Daily Aggregate', color:'#3b82f6' },
                { label:'Avg Daily Rainfall',   value:`${rainfallData.avg_daily_rainfall_mm} mm`, sub:'CHIRPS per-pixel mean', color:'#14b8a6' },
                { label:'Start of Season',      value: phenoMetrics?.start_of_season || 'N/A', sub:'Algorithmic SOS detection', color:'#22c55e' },
                { label:'Peak Growth Date',     value: phenoMetrics?.peak_growth_date || 'N/A', sub:'Max NDVI in series', color:'#a855f7' },
                { label:'Est. LGP',             value: phenoMetrics?.length_of_growing_period_days ? `${phenoMetrics.length_of_growing_period_days} Days` : 'N/A', sub:'Length of Growing Period', color:'#f97316' },
              ].map((k, i) => (
                <div key={k.label} className="kpi-card fade-in-up" style={{ '--accent-gradient': `linear-gradient(135deg, ${k.color}44, ${k.color}11)`, animationDelay:`${(i+2)*0.07}s` }}>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value" style={{ color: k.color, fontSize:24 }}>{k.value}</div>
                  <div className="kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>
          )}

          <div className="section-grid" style={{ padding:'0 32px 32px', gridTemplateColumns:'1fr' }}>
            {/* NDVI Time Series */}
            <div className="card fade-in-up">
              <div className="card-header">
                <span className="card-title">NDVI & VCI Time Series</span>
                <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text-muted)' }}>
                  {Object.entries(STAGE_COLORS).map(([s,c]) => (
                    <div key={s} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{ width:8,height:8,borderRadius:'50%',background:c }} /> {s}
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-body">
                {ndviChartData ? (
                  <div style={{ height:300 }}>
                    <Line data={ndviChartData} options={{ ...CHART_OPTS,
                      scales: { ...CHART_OPTS.scales,
                        y: { ...CHART_OPTS.scales.y, min:-0.1, max:1.0,
                          title: { display:true, text:'Index Value', color:'#4b7a5e' } }
                      }
                    }} />
                  </div>
                ) : (
                  <p style={{ color:'var(--text-muted)', fontSize:12, textAlign:'center', padding:40 }}>
                    NDVI data requires GEE authentication. Connect backend to see live chart.
                  </p>
                )}
              </div>
            </div>

            {/* VCI Stress Bar Chart */}
            <div className="card fade-in-up">
              <div className="card-header">
                <span className="card-title">Stress Level Trend (VCI)</span>
                <div style={{ display:'flex', gap:6 }}>
                  {['0-20 Severe','20-40 High','40-60 Mod','60-80 Low','80+ Healthy'].map((l,i) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10 }}>
                      <div style={{ width:8,height:8,borderRadius:2,background:['#dc2626','#f97316','#eab308','#84cc16','#22c55e'][i] }} />
                      <span style={{ color:'var(--text-muted)' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-body">
                {stressTrendData ? (
                  <div style={{ height:260 }}>
                    <Bar data={stressTrendData} options={{ ...CHART_OPTS,
                      scales: { ...CHART_OPTS.scales,
                        y: { ...CHART_OPTS.scales.y, min:0, max:100,
                          title: { display:true, text:'VCI Score', color:'#4b7a5e' } }
                      }
                    }} />
                  </div>
                ) : (
                  <p style={{ color:'var(--text-muted)', fontSize:12, textAlign:'center', padding:40 }}>
                    Stress trend requires live GEE data. Connect backend to see real values.
                  </p>
                )}
              </div>
            </div>

            {/* CHIRPS Monthly Rainfall Chart */}
            <div className="card fade-in-up">
              <div className="card-header">
                <span className="card-title">Monthly Rainfall (CHIRPS)</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>India · 6-month · mm/month</span>
              </div>
              <div className="card-body">
                {rainfallSeries.length > 0 ? (
                  <div style={{ height:260 }}>
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
                            title: { display:true, text:'Rainfall (mm)', color:'#4b7a5e' } }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <p style={{ color:'var(--text-muted)', fontSize:12, textAlign:'center', padding:40 }}>
                    Loading CHIRPS rainfall series...
                  </p>
                )}
              </div>
            </div>

            {/* Index Reference Table */}

            <div className="card fade-in-up">
              <div className="card-header"><span className="card-title">Index Reference</span></div>
              <div className="card-body" style={{ padding:0 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Index</th><th>Formula</th><th>Bands Used</th><th>Source</th><th>Purpose</th></tr>
                  </thead>
                  <tbody>
                    {[
                      { idx:'NDVI', formula:'(NIR−RED)/(NIR+RED)', bands:'B8, B4', src:'Sentinel-2', purpose:'Vegetation vigor' },
                      { idx:'NDWI', formula:'(NIR−SWIR)/(NIR+SWIR)', bands:'B8, B11', src:'Sentinel-2', purpose:'Water content' },
                      { idx:'EVI',  formula:'2.5×(NIR−RED)/(NIR+6R−7.5B+1)', bands:'B8,B4,B2', src:'Sentinel-2', purpose:'Enhanced vegetation' },
                      { idx:'VV',   formula:'Backscatter (dB)', bands:'VV', src:'Sentinel-1', purpose:'Surface structure' },
                      { idx:'VH',   formula:'Backscatter (dB)', bands:'VH', src:'Sentinel-1', purpose:'Crop moisture' },
                      { idx:'VCI',  formula:'(NDVI−NDVImin)/(NDVImax−NDVImin)×100', bands:'Derived', src:'GEE Composite', purpose:'Moisture stress' },
                    ].map(r => (
                      <tr key={r.idx}>
                        <td><strong style={{ color:'var(--green-400)', fontFamily:'var(--font-mono)' }}>{r.idx}</strong></td>
                        <td><code style={{ fontSize:11, color:'var(--text-muted)' }}>{r.formula}</code></td>
                        <td><code style={{ fontSize:11, color:'var(--blue-500)' }}>{r.bands}</code></td>
                        <td style={{ fontSize:12 }}>{r.src}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{r.purpose}</td>
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
