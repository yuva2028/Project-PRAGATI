import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { TrendingUp, IndianRupee, MapPin, BarChart3, ArrowUpRight, ArrowDownRight, Loader2, AlertTriangle } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function YieldForecast() {
  const { userCoords } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState('ALL');
  const [sortBy, setSortBy] = useState('predicted_yield');

  useEffect(() => {
    setLoading(true);
    const params = userCoords ? `?lat=${userCoords.lat}&lng=${userCoords.lng}` : '';
    fetch(`${API}/api/yield-forecast${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userCoords]);

  const filteredForecasts = useMemo(() => {
    if (!data?.forecasts) return [];
    let items = data.forecasts;
    if (selectedCrop !== 'ALL') items = items.filter(f => f.crop === selectedCrop);
    return items.sort((a, b) => {
      if (sortBy === 'predicted_yield') return b.predicted_yield_tons_ha - a.predicted_yield_tons_ha;
      if (sortBy === 'vci') return a.vci - b.vci;
      if (sortBy === 'loss') return b.revenue_loss_inr - a.revenue_loss_inr;
      return 0;
    });
  }, [data, selectedCrop, sortBy]);

  const formatINR = (val) => {
    if (val >= 1e9) return `₹${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e7) return `₹${(val / 1e7).toFixed(1)}Cr`;
    if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const CROP_COLORS = { Rice: '#22c55e', Maize: '#eab308', Sugarcane: '#3b82f6', Others: '#f97316' };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)', marginBottom: '1rem' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading yield forecasts...</div>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={24} /> Yield Forecast Dashboard
        </h1>
        <p className="page-subtitle">
          Kharif 2026 — Stress-adjusted crop yield predictions for {data?.pilot_area || 'Karnataka, India'}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Districts', value: summary.total_districts || 0, icon: <MapPin size={18} />, color: '#3b82f6', sub: `${(summary.total_area_ha || 0).toLocaleString()} ha monitored` },
          { label: 'Avg. VCI', value: `${summary.average_vci || 0}%`, icon: <BarChart3 size={18} />, color: summary.average_vci > 50 ? '#22c55e' : '#f59e0b', sub: `${summary.average_yield_potential_pct || 0}% yield potential` },
          { label: 'Total Production', value: `${((summary.total_production_tons || 0) / 1e6).toFixed(1)}M tons`, icon: <TrendingUp size={18} />, color: '#10b981', sub: formatINR(summary.total_revenue_inr || 0) + ' est. revenue' },
          { label: 'Estimated Loss', value: formatINR(summary.total_estimated_loss_inr || 0), icon: <AlertTriangle size={18} />, color: '#ef4444', sub: 'Due to moisture stress' },
        ].map((kpi, i) => (
          <div key={i} className="card-glass" style={{
            padding: '1.25rem', borderLeft: `3px solid ${kpi.color}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {kpi.label}
              </span>
              <span style={{ color: kpi.color }}>{kpi.icon}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white', marginBottom: '0.25rem' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--card-bg)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {['ALL', 'Rice', 'Maize', 'Sugarcane', 'Others'].map(crop => (
            <button
              key={crop}
              onClick={() => setSelectedCrop(crop)}
              style={{
                padding: '4px 12px', borderRadius: '6px', border: 'none',
                background: selectedCrop === crop ? 'var(--blue-600)' : 'transparent',
                color: selectedCrop === crop ? 'white' : 'var(--text-muted)',
                fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {crop}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          aria-label="Sort yield forecasts"
          style={{
            background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-main)', padding: '6px 12px', borderRadius: '8px',
            fontSize: '0.75rem', cursor: 'pointer',
          }}
        >
          <option value="predicted_yield">Sort by Yield</option>
          <option value="vci">Sort by Stress (VCI)</option>
          <option value="loss">Sort by Loss</option>
        </select>
      </div>

      {/* District Forecast Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {filteredForecasts.map((f, i) => (
          <div key={i} className="card-glass" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            {/* Crop color accent */}
            <div style={{
              position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
              background: `radial-gradient(circle at top right, ${CROP_COLORS[f.crop]}22, transparent)`,
            }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white' }}>
                  <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {f.district}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {f.lat.toFixed(2)}°N, {f.lng.toFixed(2)}°E · {f.area_ha.toLocaleString()} ha
                </div>
              </div>
              <span style={{
                fontSize: '0.7rem', fontWeight: '700', padding: '3px 10px', borderRadius: '12px',
                background: `${CROP_COLORS[f.crop]}22`, color: CROP_COLORS[f.crop],
                border: `1px solid ${CROP_COLORS[f.crop]}44`,
              }}>
                {f.crop}
              </span>
            </div>

            {/* Yield */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Predicted Yield</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
                  {f.predicted_yield_tons_ha} <span style={{ fontSize: '0.7rem', fontWeight: '500', color: 'var(--text-muted)' }}>t/ha</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Yield Potential</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    fontSize: '1.3rem', fontWeight: '800',
                    color: f.yield_potential_pct >= 85 ? '#22c55e' : f.yield_potential_pct >= 60 ? '#eab308' : '#ef4444',
                  }}>
                    {f.yield_potential_pct}%
                  </div>
                  {f.yield_potential_pct >= 85
                    ? <ArrowUpRight size={16} color="#22c55e" />
                    : <ArrowDownRight size={16} color="#ef4444" />
                  }
                </div>
              </div>
            </div>

            {/* VCI Progress Bar */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>VCI: {f.vci}%</span>
                <span>Confidence: {f.confidence_pct}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{
                  width: `${f.vci}%`, height: '100%', borderRadius: '3px',
                  background: f.vci > 60 ? '#22c55e' : f.vci > 35 ? '#eab308' : '#ef4444',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>

            {/* Trend mini chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '40px', marginBottom: '0.5rem' }}>
              {f.yield_trend.map((val, idx) => {
                const maxVal = Math.max(...f.yield_trend);
                const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <div style={{
                      width: '100%', height: `${heightPct}%`, minHeight: '4px',
                      borderRadius: '2px 2px 0 0',
                      background: idx === f.yield_trend.length - 1
                        ? `linear-gradient(to top, ${CROP_COLORS[f.crop]}88, ${CROP_COLORS[f.crop]})`
                        : 'rgba(255,255,255,0.1)',
                    }} />
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                      {f.trend_labels[idx]?.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Economic Impact */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem',
              background: 'rgba(255,255,255,0.02)', borderRadius: '6px', marginTop: '0.25rem',
            }}>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Revenue</div>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#22c55e' }}>{formatINR(f.revenue_inr)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Stress Loss</div>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: f.revenue_loss_inr > 0 ? '#ef4444' : '#22c55e' }}>
                  {f.revenue_loss_inr > 0 ? `-${formatINR(f.revenue_loss_inr)}` : 'None'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Methodology Note */}
      <div style={{
        marginTop: '1.5rem', padding: '1rem', background: 'rgba(37,99,235,0.05)',
        borderRadius: '10px', border: '1px solid rgba(37,99,235,0.15)',
        fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.5',
      }}>
        <strong style={{ color: 'var(--blue-400)' }}>📊 Methodology Note:</strong> Yield predictions use a VCI-based stress adjustment model
        applied to FAO baseline yields (DES, MoA&FW 2024-25). Economic impact is calculated using Government of India
        Minimum Support Prices (MSP). VCI is derived from multi-temporal Sentinel-2 NDVI via the Vegetation Condition Index formula.
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
