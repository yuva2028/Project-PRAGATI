import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Satellite, Layers, Eye, Clock, ChevronLeft, ChevronRight, Info, Download } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const BANDS = [
  { id: 'NDVI', label: 'NDVI (Vegetation)', palette: ['#d73027', '#fee08b', '#1a9850'], description: 'Normalized Difference Vegetation Index — measures canopy greenness and crop vigor.' },
  { id: 'NDWI', label: 'NDWI (Water)', palette: ['#d73027', '#ffffbf', '#4575b4'], description: 'Normalized Difference Water Index — detects surface water and leaf water content.' },
  { id: 'EVI', label: 'EVI (Enhanced Veg.)', palette: ['#d73027', '#ffffbf', '#1a9850'], description: 'Enhanced Vegetation Index — sensitive in high biomass regions; reduces atmospheric interference.' },
  { id: 'B4', label: 'Band 4 (Red)', palette: ['#000000', '#ffffff'], description: 'Sentinel-2 Band 4 (665nm) — Red reflectance used in chlorophyll absorption analysis.' },
  { id: 'B8', label: 'Band 8 (NIR)', palette: ['#000000', '#ffffff'], description: 'Sentinel-2 Band 8 (842nm) — Near-infrared reflectance, high in healthy vegetation.' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SatelliteViewer() {
  const { userCoords } = useStore();
  const [selectedBand, setSelectedBand] = useState('NDVI');
  const [comparisonBand, setComparisonBand] = useState('NDWI');
  const [sliderPos, setSliderPos] = useState(50);
  const [tileUrl, setTileUrl] = useState(null);
  const [timeStep, setTimeStep] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentBandInfo = BANDS.find(b => b.id === selectedBand);
  const comparisonBandInfo = BANDS.find(b => b.id === comparisonBand);

  // Simulate time-lapse NDVI values for demonstration
  const timeSeriesData = Array.from({ length: 6 }, (_, i) => {
    const month = (new Date().getMonth() - 5 + i + 12) % 12;
    const ndviBase = 0.3 + Math.sin((i / 5) * Math.PI) * 0.35;
    return {
      month: MONTHS[month],
      ndvi: +(ndviBase + (Math.random() * 0.08 - 0.04)).toFixed(3),
      color: ndviBase > 0.55 ? '#22c55e' : ndviBase > 0.4 ? '#eab308' : '#ef4444',
    };
  });

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeStep(prev => (prev + 1) % 6);
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Fetch tile URL from backend
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/crop-tile?band=${selectedBand}`)
      .then(r => r.json())
      .then(data => {
        setTileUrl(data.tile_url);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedBand]);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Satellite size={24} /> Satellite Imagery Viewer
          </h1>
          <p className="page-subtitle">
            Multi-spectral band analysis using Sentinel-2 SR and Sentinel-1 SAR data
          </p>
        </div>
        <div className="info-chip">
          <Info size={14} />
          <span>Resolution: 10m/px | Revisit: 5 days</span>
        </div>
      </div>

      {/* Band Selector Cards */}
      <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
        {BANDS.map(band => (
          <button
            key={band.id}
            onClick={() => setSelectedBand(band.id)}
            className={`card-glass ${selectedBand === band.id ? 'card-active' : ''}`}
            style={{
              flex: '0 0 auto',
              padding: '0.75rem 1rem',
              border: selectedBand === band.id ? '1px solid var(--blue-500)' : '1px solid rgba(255,255,255,0.06)',
              background: selectedBand === band.id ? 'rgba(37,99,235,0.12)' : 'var(--card-bg)',
              cursor: 'pointer',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              minWidth: '140px',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '28px', height: '6px', borderRadius: '3px',
                background: `linear-gradient(to right, ${band.palette.join(', ')})`,
              }} />
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: selectedBand === band.id ? 'var(--blue-400)' : 'var(--text-main)' }}>
                {band.id}
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{band.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem' }}>

        {/* Left: Map / Comparison Viewer */}
        <div className="card-glass" style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: '500px' }}>
          {/* Map placeholder with band overlay */}
          <div style={{
            width: '100%', height: '100%', minHeight: '500px',
            background: 'var(--navy-900)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {/* Left side - selected band */}
            <div style={{
              position: 'absolute', top: 0, left: 0, width: `${sliderPos}%`, height: '100%',
              background: `linear-gradient(135deg, ${currentBandInfo?.palette[0]}22, ${currentBandInfo?.palette[2]}33)`,
              borderRight: '2px solid var(--blue-500)',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{
                  width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto 1rem',
                  background: `conic-gradient(${currentBandInfo?.palette[2]} 0deg, ${currentBandInfo?.palette[1]} 120deg, ${currentBandInfo?.palette[0]} 240deg, ${currentBandInfo?.palette[2]} 360deg)`,
                  opacity: 0.7, filter: 'blur(1px)',
                }} />
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white' }}>{selectedBand}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {currentBandInfo?.label}
                </div>
              </div>
            </div>

            {/* Right side - comparison band */}
            <div style={{
              position: 'absolute', top: 0, right: 0, width: `${100 - sliderPos}%`, height: '100%',
              background: `linear-gradient(135deg, ${comparisonBandInfo?.palette[0]}22, ${comparisonBandInfo?.palette[2]}33)`,
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{
                  width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto 1rem',
                  background: `conic-gradient(${comparisonBandInfo?.palette[2]} 0deg, ${comparisonBandInfo?.palette[1]} 120deg, ${comparisonBandInfo?.palette[0]} 240deg, ${comparisonBandInfo?.palette[2]} 360deg)`,
                  opacity: 0.7, filter: 'blur(1px)',
                }} />
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white' }}>{comparisonBand}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {comparisonBandInfo?.label}
                </div>
              </div>
            </div>

            {/* Slider handle */}
            <input
              type="range" min="5" max="95" value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              aria-label="Comparison slider between two satellite bands"
              style={{
                position: 'absolute', bottom: '24px', left: '10%', width: '80%',
                zIndex: 10, accentColor: 'var(--blue-500)',
              }}
            />

            {/* Band labels overlay */}
            <div style={{
              position: 'absolute', top: '12px', left: '12px',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
              padding: '6px 12px', borderRadius: '6px',
              fontSize: '0.75rem', fontWeight: '600', color: 'var(--blue-400)',
            }}>
              <Layers size={12} style={{ display: 'inline', marginRight: '4px' }} /> {selectedBand}
            </div>
            <div style={{
              position: 'absolute', top: '12px', right: '12px',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
              padding: '6px 12px', borderRadius: '6px',
              fontSize: '0.75rem', fontWeight: '600', color: 'var(--emerald-500)',
            }}>
              {comparisonBand} <Eye size={12} style={{ display: 'inline', marginLeft: '4px' }} />
            </div>

            {loading && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,0.8)', padding: '1rem 2rem', borderRadius: '8px',
                color: 'white', fontSize: '0.85rem', zIndex: 20,
              }}>
                Loading satellite tile...
              </div>
            )}
          </div>

          {/* Comparison Band Selector */}
          <div style={{
            position: 'absolute', bottom: '56px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            padding: '4px', borderRadius: '8px', zIndex: 10,
          }}>
            {BANDS.filter(b => b.id !== selectedBand).map(band => (
              <button
                key={band.id}
                onClick={() => setComparisonBand(band.id)}
                style={{
                  padding: '4px 10px', borderRadius: '6px', border: 'none',
                  background: comparisonBand === band.id ? 'var(--blue-600)' : 'transparent',
                  color: comparisonBand === band.id ? 'white' : 'var(--text-muted)',
                  fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {band.id}
              </button>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Band Info Card */}
          <div className="card-glass" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--blue-400)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} /> Band Information
            </h3>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: 'white', marginBottom: '0.5rem' }}>
              {selectedBand}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1rem' }}>
              {currentBandInfo?.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Color Palette:</span>
              <div style={{
                flex: 1, height: '10px', borderRadius: '5px',
                background: `linear-gradient(to right, ${currentBandInfo?.palette.join(', ')})`,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              <span>Low</span><span>Medium</span><span>High</span>
            </div>
          </div>

          {/* Time-Lapse Controller */}
          <div className="card-glass" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--blue-400)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> NDVI Time-Lapse (6 Months)
            </h3>

            {/* Time series mini-chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px', marginBottom: '0.75rem' }}>
              {timeSeriesData.map((d, i) => (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                }}>
                  <div style={{
                    width: '100%', height: `${d.ndvi * 100}px`, maxHeight: '70px',
                    background: i === timeStep
                      ? `linear-gradient(to top, ${d.color}88, ${d.color})`
                      : `${d.color}33`,
                    borderRadius: '3px 3px 0 0',
                    border: i === timeStep ? `1px solid ${d.color}` : '1px solid transparent',
                    transition: 'all 0.3s ease',
                  }} />
                  <span style={{
                    fontSize: '0.6rem',
                    color: i === timeStep ? 'white' : 'var(--text-muted)',
                    fontWeight: i === timeStep ? '700' : '400',
                  }}>
                    {d.month}
                  </span>
                </div>
              ))}
            </div>

            {/* Current values */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem 0.75rem',
              fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>NDVI: <strong style={{ color: timeSeriesData[timeStep]?.color }}>{timeSeriesData[timeStep]?.ndvi}</strong></span>
              <span>{timeSeriesData[timeStep]?.month}</span>
            </div>

            {/* Playback controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setTimeStep(prev => (prev - 1 + 6) % 6)}
                aria-label="Previous month"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-main)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer',
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  flex: 1, background: isPlaying ? 'var(--red-600)' : 'var(--blue-600)',
                  border: 'none', color: 'white', borderRadius: '6px', padding: '6px',
                  fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play Time-Lapse'}
              </button>
              <button
                onClick={() => setTimeStep(prev => (prev + 1) % 6)}
                aria-label="Next month"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-main)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer',
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Sentinel Info Cards */}
          <div className="card-glass" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--blue-400)', marginBottom: '0.75rem' }}>
              🛰️ Data Sources
            </h3>
            {[
              { name: 'Sentinel-2 (Optical)', bands: '13 bands', res: '10m', revisit: '5 days', color: '#3b82f6' },
              { name: 'Sentinel-1 (SAR)', bands: 'VV, VH', res: '10m', revisit: '6 days', color: '#f59e0b' },
              { name: 'MODIS (ET)', bands: 'MOD16A2', res: '500m', revisit: '8 days', color: '#10b981' },
              { name: 'CHIRPS (Rainfall)', bands: 'Precipitation', res: '5km', revisit: 'Daily', color: '#8b5cf6' },
            ].map((src, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{
                  width: '6px', height: '32px', borderRadius: '3px', background: src.color,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-main)' }}>{src.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {src.bands} · {src.res} · {src.revisit}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Export Button */}
          <button
            onClick={() => window.open(`${API}/api/export-crop-map`, '_blank')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: 'linear-gradient(135deg, var(--blue-600), var(--blue-700))',
              border: 'none', color: 'white', padding: '0.75rem', borderRadius: '10px',
              fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            aria-label="Export satellite composite as GeoTIFF"
          >
            <Download size={16} /> Export GeoTIFF
          </button>
        </div>
      </div>
    </div>
  );
}
