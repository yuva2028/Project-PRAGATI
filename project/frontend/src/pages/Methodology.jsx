import React, { useState } from 'react';
import { BookOpen, Cpu, Satellite, Database, BarChart3, Droplets, Zap, ChevronRight, ExternalLink } from 'lucide-react';

const PIPELINE_STEPS = [
  {
    id: 1, icon: '🛰️', title: 'Data Acquisition',
    subtitle: 'Sentinel-1/2, MODIS, CHIRPS',
    color: '#3b82f6',
    description: 'Multi-sensor satellite data is acquired from ESA Copernicus and NASA datasets via Google Earth Engine. Sentinel-2 provides 10m optical imagery (13 bands) every 5 days. Sentinel-1 SAR provides all-weather microwave backscatter.',
    details: [
      'Sentinel-2 SR Harmonized (COPERNICUS/S2_SR_HARMONIZED)',
      'Sentinel-1 GRD (COPERNICUS/S1_GRD)',
      'MODIS ET (MODIS/061/MOD16A2)',
      'CHIRPS Rainfall (UCSB-CHG/CHIRPS/DAILY)',
    ],
  },
  {
    id: 2, icon: '🧹', title: 'Preprocessing',
    subtitle: 'Cloud masking, normalization',
    color: '#8b5cf6',
    description: 'Raw images are preprocessed by masking clouds using the QA60 band (bit-shifting for cirrus and opaque cloud flags), scaling reflectance to 0-1 range, and creating temporal composites to fill data gaps.',
    details: [
      'QA60 cloud mask (bit 10: clouds, bit 11: cirrus)',
      'Surface reflectance ÷ 10000 normalization',
      'Median temporal compositing (6-month window)',
      'Multi-temporal stacking: T1 (months 6-3) + T2 (months 3-0)',
    ],
  },
  {
    id: 3, icon: '📊', title: 'Feature Extraction',
    subtitle: 'Spectral indices & texture',
    color: '#10b981',
    description: 'Spectral vegetation and water indices are computed as features for the ML models. SAR backscatter ratios provide soil moisture information. GLCM texture features add spatial context.',
    details: [
      'NDVI = (B8 − B4) / (B8 + B4)',
      'NDWI = (B8 − B11) / (B8 + B11)',
      'EVI = 2.5 × (NIR − RED) / (NIR + 6×RED − 7.5×BLUE + 1)',
      'VCI = (NDVI − NDVImin) / (NDVImax − NDVImin) × 100',
      'SMI from SAR VH/VV backscatter ratio',
      'GLCM: Contrast, Dissimilarity, Homogeneity, Energy, Correlation',
    ],
  },
  {
    id: 4, icon: '🤖', title: 'ML Classification',
    subtitle: 'Random Forest + XGBoost + LSTM',
    color: '#f59e0b',
    description: 'Three model architectures work in tandem: Random Forest and XGBoost for multi-temporal crop classification (Rice, Maize, Sugarcane, Others), and a PyTorch LSTM for sequential moisture stress prediction from NDVI time series.',
    details: [
      'Random Forest: 200 trees, max_depth=12, min_samples_leaf=5',
      'XGBoost: 200 rounds, max_depth=8, η=0.1, α=0.5',
      'LSTM: 2-layer, hidden_dim=64, sequence_length=6 months',
      'Cross-validation: 5-fold Stratified with ~93% accuracy',
      'Feature importance analysis for spectral band ranking',
    ],
  },
  {
    id: 5, icon: '💧', title: 'Advisory Engine',
    subtitle: 'FAO-56 Water Balance',
    color: '#06b6d4',
    description: 'The FAO-56 crop water balance model computes Crop Water Requirement (ETc = Kc × ET0) and water deficit. MODIS 8-day ET provides reference evapotranspiration. CHIRPS supplies recent rainfall for deficit calculation.',
    details: [
      'ET0 from MODIS MOD16A2 (8-day composite)',
      'Crop coefficients (Kc) by growth stage (FAO-56 Table)',
      'ETc = Kc × ET0 (crop-specific water demand)',
      'Deficit = ETc − Effective Rainfall',
      'Command-area canal gate discharge optimization',
    ],
  },
  {
    id: 6, icon: '📱', title: 'Decision Support',
    subtitle: 'Dashboard + AI Chatbot + Alerts',
    color: '#ef4444',
    description: 'Field-level advisories are delivered through the interactive dashboard, AI chatbot (rule-based + Gemini), farmer-facing KisanView, and alert notifications. PDF reports with ISRO branding can be exported for policy use.',
    details: [
      'Real-time dashboard with map overlays',
      'AI Chatbot with SSE streaming and field context',
      'KisanView: Simplified Hindi/English farmer interface',
      'PDF/CSV/GeoTIFF report generation',
      'SMS/WhatsApp alert notification (architecture)',
    ],
  },
];

const INDEX_FORMULAS = [
  {
    name: 'NDVI', formula: '(B8 − B4) / (B8 + B4)', range: '−1 to +1',
    purpose: 'Measures live green vegetation cover. Values > 0.5 indicate healthy crops.',
    bands: 'B8 (NIR, 842nm) | B4 (Red, 665nm)', color: '#22c55e',
  },
  {
    name: 'NDWI', formula: '(B8 − B11) / (B8 + B11)', range: '−1 to +1',
    purpose: 'Detects water content in vegetation canopy and surface water bodies.',
    bands: 'B8 (NIR, 842nm) | B11 (SWIR, 1610nm)', color: '#3b82f6',
  },
  {
    name: 'EVI', formula: '2.5 × (NIR−RED) / (NIR + 6×RED − 7.5×BLUE + 1)', range: '−1 to +1',
    purpose: 'Enhanced sensitivity in dense canopy. Corrects atmospheric and soil effects.',
    bands: 'B8 (NIR) | B4 (Red) | B2 (Blue, 490nm)', color: '#10b981',
  },
  {
    name: 'VCI', formula: '(NDVI − NDVImin) / (NDVImax − NDVImin) × 100', range: '0 to 100%',
    purpose: 'Vegetation Condition Index — measures moisture stress relative to historical range.',
    bands: 'Derived from NDVI time series', color: '#f59e0b',
  },
  {
    name: 'SMI', formula: 'f(VH, VV) - Empirical SAR Ratio', range: '0 to 100%',
    purpose: 'Soil Moisture Index - derived from Sentinel-1 radar, works through cloud cover.',
    bands: 'Phase 2 Roadmap: Physical Water Cloud Model (WCM) integration with ISRO NISAR L-band data.', color: '#8b5cf6',
  },
];

export default function Methodology() {
  const [activeStep, setActiveStep] = useState(null);
  const [activeFormula, setActiveFormula] = useState(null);

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={24} /> Methodology & Science
        </h1>
        <p className="page-subtitle">
          Understanding the PRAGATI pipeline — from satellite acquisition to farmer advisory
        </p>
      </div>

      {/* Pipeline Overview */}
      <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>
          End-to-End Processing Pipeline
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Click any stage to expand its technical details
        </p>

        {/* Pipeline Flow Diagram */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {PIPELINE_STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
                aria-label={`Pipeline step ${step.id}: ${step.title}`}
                style={{
                  flex: '1 1 0',
                  minWidth: '150px',
                  padding: '1rem 0.75rem',
                  background: activeStep === step.id ? `${step.color}15` : 'rgba(255,255,255,0.02)',
                  border: activeStep === step.id ? `1px solid ${step.color}44` : '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: `${step.color}22`,
                  border: `1px solid ${step.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem',
                }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'white', textAlign: 'center' }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {step.subtitle}
                </div>
                <div style={{
                  position: 'absolute', top: '4px', right: '4px',
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: step.color, color: 'white',
                  fontSize: '0.6rem', fontWeight: '800',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {step.id}
                </div>
              </button>
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '0 4px',
                  color: 'var(--text-muted)', opacity: 0.5,
                }}>
                  <ChevronRight size={16} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Expanded Step Details */}
        {activeStep && (() => {
          const step = PIPELINE_STEPS.find(s => s.id === activeStep);
          return (
            <div style={{
              marginTop: '1rem', padding: '1.25rem', borderRadius: '10px',
              background: `${step.color}08`,
              border: `1px solid ${step.color}22`,
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.3rem' }}>{step.icon}</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white', margin: 0 }}>
                  Step {step.id}: {step.title}
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '1rem' }}>
                {step.description}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {step.details.map((detail, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '0.75rem', color: 'var(--text-main)',
                    padding: '4px 8px', background: 'rgba(255,255,255,0.03)',
                    borderRadius: '6px', fontFamily: 'var(--font-mono)',
                  }}>
                    <span style={{ color: step.color, fontWeight: '700' }}>›</span>
                    {detail}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Spectral Index Reference */}
      <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>
          Spectral Index Reference
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Mathematical formulations used for feature extraction from satellite imagery
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {INDEX_FORMULAS.map((idx, i) => (
            <div
              key={i}
              className="card-glass"
              style={{
                padding: '1rem',
                border: `1px solid ${idx.color}22`,
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setActiveFormula(activeFormula === i ? null : i)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{
                  fontSize: '0.85rem', fontWeight: '800', color: idx.color,
                  letterSpacing: '0.05em',
                }}>
                  {idx.name}
                </span>
                <span style={{
                  fontSize: '0.65rem', color: 'var(--text-muted)',
                  background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px',
                }}>
                  Range: {idx.range}
                </span>
              </div>
              <div style={{
                fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                color: 'var(--text-main)', background: 'rgba(0,0,0,0.3)',
                padding: '6px 10px', borderRadius: '6px', marginBottom: '0.5rem',
              }}>
                {idx.formula}
              </div>
              {activeFormula === i && (
                <div style={{ animation: 'fadeIn 0.2s ease' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '0.5rem' }}>
                    {idx.purpose}
                  </p>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    📡 Bands: {idx.bands}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Model Architecture Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Random Forest / XGBoost */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={16} /> Crop Classification Models
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { model: 'Random Forest', params: '200 trees · depth=12 · min_leaf=5', acc: '~93.2%', purpose: 'Primary classifier for crop type mapping' },
              { model: 'XGBoost', params: '200 rounds · depth=8 · η=0.1', acc: '~94.1%', purpose: 'Gradient-boosted ensemble for higher precision' },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '0.75rem', background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'white' }}>{m.model}</span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: '700', color: '#22c55e',
                    background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '4px',
                  }}>
                    {m.acc}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>
                  {m.params}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.purpose}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <strong>Classes:</strong> Rice (1), Maize (2), Sugarcane (3), Others (4)<br />
            <strong>Features:</strong> 12 spectral + 6 SAR + 5 texture = 23 features<br />
            <strong>Validation:</strong> 5-fold Stratified CV, Cohen's Kappa ≥ 0.88
          </div>
        </div>

        {/* LSTM */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#8b5cf6', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={16} /> Moisture Stress Model (LSTM)
          </h3>
          <div style={{
            padding: '0.75rem', background: 'rgba(255,255,255,0.02)',
            borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '0.75rem',
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>PyTorch LSTM Network</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              2 layers · hidden_dim=64 · dropout=0.2
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <div>📥 <strong>Input:</strong> 6-month sequence [NDVI, NDWI, Precipitation]</div>
            <div>🧠 <strong>Architecture:</strong> LSTM → Dense → Softmax (5 stress classes)</div>
            <div>📤 <strong>Output:</strong> VCI prediction → stress category mapping</div>
          </div>
          <div style={{
            marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(139,92,246,0.08)',
            borderRadius: '8px', border: '1px solid rgba(139,92,246,0.2)',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a78bfa', marginBottom: '0.25rem' }}>
              Stress Categories (VCI-based)
            </div>
            {[
              { label: 'Healthy', range: '60-100%', color: '#22c55e' },
              { label: 'Low Stress', range: '40-60%', color: '#84cc16' },
              { label: 'Moderate Stress', range: '25-40%', color: '#eab308' },
              { label: 'High Stress', range: '10-25%', color: '#f97316' },
              { label: 'Severe Stress', range: '0-10%', color: '#dc2626' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-main)', flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{s.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PMKSY Alignment */}
      <div className="card-glass" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>
          🇮🇳 PMKSY Alignment — "Per Drop More Crop"
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          How PRAGATI supports the Pradhan Mantri Krishi Sinchayee Yojana mission objectives
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
          {[
            { icon: '🎯', title: 'Precision Irrigation', desc: 'FAO-56 water balance model calculates exact mm of water needed per field, per crop stage — eliminating guesswork.' },
            { icon: '🚰', title: 'Canal Gate Optimization', desc: 'Command-area aggregation recommends optimal gate discharge levels to minimize water wastage across distributaries.' },
            { icon: '📡', title: 'Satellite Monitoring', desc: 'All-weather monitoring via Sentinel-1 SAR + Sentinel-2 optical ensures continuous coverage even during monsoon cloud cover.' },
            { icon: '🌾', title: 'Yield Protection', desc: 'Early stress detection (VCI < 35%) alerts trigger timely intervention, protecting 15-20% of potential yield loss.' },
            { icon: '👨‍🌾', title: 'Farmer Empowerment', desc: 'KisanView provides traffic-light advisories in Hindi/English — accessible to all literacy levels.' },
            { icon: '📊', title: 'Policy Intelligence', desc: 'District-level aggregation of crop area, stress, and water deficit enables evidence-based PMKSY fund allocation.' },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '1rem', background: 'rgba(255,255,255,0.02)',
              borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{item.icon}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>{item.title}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
