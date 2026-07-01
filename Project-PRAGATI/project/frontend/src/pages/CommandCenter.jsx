import React from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { CheckCircle, Clock, Droplet, Waves } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

ChartJS.register(ArcElement, Tooltip, Legend);

// Mock farm boundary for the visual
const mockPolygon = [
  [28.7041, 77.1025],
  [28.7041, 77.1105],
  [28.6990, 77.1105],
  [28.6990, 77.1025]
];
const center = [28.7015, 77.1065];

// Map Sync Component (Optional, to keep them centered)
function MapController() {
  const map = useMap();
  map.setView(center, 14);
  return null;
}

export default function CommandCenter() {
  
  const gaugeData = {
    datasets: [{
      data: [35, 65], // value, remaining
      backgroundColor: ['#ef4444', '#1f2937'],
      borderWidth: 0,
      circumference: 180,
      rotation: 270,
    }]
  };

  const gaugeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '80%',
    plugins: {
      tooltip: { enabled: false },
    }
  };

  const aiSteps = [
    { name: 'Preprocessing', status: 'done' },
    { name: 'Feature Extraction', status: 'done' },
    { name: 'Crop Classification Model', status: 'done' },
    { name: 'Moisture Stress Model', status: 'done' },
    { name: 'Growth Stage Estimation', status: 'done' },
    { name: 'Irrigation Recommendation Model', status: 'done' },
  ];

  return (
    <div className="cc-dashboard">
      
      {/* Left Sidebar */}
      <div className="cc-sidebar">
        <div className="cc-panel">
          <div className="cc-header">Farm ID: FARM_0127<br/><span style={{color:'var(--text-muted)'}}>Date: 24 May 2026</span></div>
          
          <div className="cc-thumb-container">
            <div className="cc-thumb-box">
              <div className="cc-thumb-img bg-optical"></div>
              <span className="cc-thumb-label">Optical Image<br/>(Sentinel-2)</span>
            </div>
            <div className="cc-thumb-box">
              <div className="cc-thumb-img bg-sar"></div>
              <span className="cc-thumb-label">Microwave Image<br/>(Sentinel-1)</span>
            </div>
          </div>
        </div>

        <div className="cc-panel" style={{flex: 1}}>
          <div className="cc-panel-title">2. AI ANALYSIS</div>
          <div className="cc-checklist">
            {aiSteps.map((step, i) => (
              <div key={i} className="cc-check-item">
                <span className="cc-check-text">{step.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="cc-panel" style={{flex: 1}}>
           <div className="cc-panel-title">3. OUTPUTS</div>
           <div className="cc-check-item active"><Droplet size={14}/> Crop Map</div>
           <div className="cc-check-item"><Waves size={14}/> Stress Map</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="cc-main">
        
        {/* Top 3 Maps */}
        <div className="cc-maps-row">
          
          {/* Crop Map */}
          <div className="cc-map-container">
            <MapContainer center={center} zoom={14} zoomControl={false} dragging={false} className="cc-map">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <Polygon positions={mockPolygon} pathOptions={{ color: '#22c55e', weight: 2, fillColor: '#22c55e', fillOpacity: 0.4 }} />
              <MapController />
            </MapContainer>
            <div className="cc-map-legend">
              <div className="cc-legend-title">Crop Map</div>
              <div className="cc-legend-item"><span className="cc-dot bg-rice"></span>Rice</div>
              <div className="cc-legend-item"><span className="cc-dot bg-wheat"></span>Wheat</div>
              <div className="cc-legend-item"><span className="cc-dot bg-maize"></span>Maize</div>
            </div>
            <div className="cc-map-footer">Overall Accuracy: 92.4%</div>
          </div>

          {/* Stress Map */}
          <div className="cc-map-container">
            <MapContainer center={center} zoom={14} zoomControl={false} dragging={false} className="cc-map">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <Polygon positions={mockPolygon} pathOptions={{ color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.5 }} />
              <MapController />
            </MapContainer>
            <div className="cc-map-legend">
              <div className="cc-legend-item"><span className="cc-dot bg-green"></span>No Stress</div>
              <div className="cc-legend-item"><span className="cc-dot bg-yellow"></span>Low Stress</div>
              <div className="cc-legend-item"><span className="cc-dot bg-orange"></span>Moderate</div>
              <div className="cc-legend-item"><span className="cc-dot bg-red"></span>Severe</div>
            </div>
            <div className="cc-map-footer center">
              Stress Index (0-1)
              <div className="cc-gradient-bar"></div>
            </div>
          </div>

          {/* Growth Stage Map */}
          <div className="cc-map-container">
            <MapContainer center={center} zoom={14} zoomControl={false} dragging={false} className="cc-map">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <Polygon positions={mockPolygon} pathOptions={{ color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.4 }} />
              <MapController />
            </MapContainer>
            <div className="cc-map-legend right">
              <div className="cc-legend-item"><span className="cc-dot bg-green"></span>Germination</div>
              <div className="cc-legend-item"><span className="cc-dot bg-emerald"></span>Vegetative</div>
              <div className="cc-legend-item"><span className="cc-dot bg-teal"></span>Reproductive</div>
              <div className="cc-legend-item"><span className="cc-dot bg-orange"></span>Maturation</div>
            </div>
          </div>

        </div>

        {/* Bottom Panel - Irrigation Recommendations */}
        <div className="cc-bottom-panel">
          <div className="cc-panel-title center" style={{marginBottom: '1rem'}}>IRRIGATION RECOMMENDATIONS</div>
          <div className="cc-irrigation-grid">
            
            {/* Metrics */}
            <div className="cc-metrics">
              <div className="cc-metric-box">
                <div className="cc-metric-label">Recommended Action</div>
                <div className="cc-metric-value text-blue" style={{display:'flex', alignItems:'center', gap:'8px'}}><Droplet size={16}/> Irrigate in next 24-48 hours</div>
                <div className="cc-metric-sub">for Moderate to Severe Stress areas.</div>
              </div>
              <div className="cc-metric-box">
                <div className="cc-metric-label">Irrigation Depth (mm)</div>
                <div className="cc-metric-value text-blue" style={{display:'flex', alignItems:'center', gap:'8px'}}>25 - 35 mm</div>
              </div>
              <div className="cc-metric-box">
                <div className="cc-metric-label">Total Irrigation Volume</div>
                <div className="cc-metric-value text-blue" style={{display:'flex', alignItems:'center', gap:'8px'}}>18,650 m³</div>
              </div>
              <div className="cc-metric-box">
                <div className="cc-metric-label">Estimated Duration</div>
                <div className="cc-metric-value" style={{display:'flex', alignItems:'center', gap:'8px'}}><Clock size={16}/> 6 - 8 hours</div>
              </div>
            </div>

            {/* Irrigation Map (Mini) */}
            <div className="cc-mini-map-container">
               <div className="cc-metric-label center" style={{marginBottom: '8px'}}>Irrigation Map (mm)</div>
               <div style={{ display: 'flex', gap: '1rem', height: '100%', alignItems: 'center' }}>
                  <div style={{ flex: 1, height: '120px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                    <MapContainer center={center} zoom={13} zoomControl={false} dragging={false} style={{height: '100%', width: '100%'}}>
                       <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                       <Polygon positions={mockPolygon} pathOptions={{ color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.6 }} />
                    </MapContainer>
                  </div>
                  <div className="cc-mini-legend">
                    <div className="cc-legend-item"><span className="cc-box bg-blue-1"></span> 0 - 10</div>
                    <div className="cc-legend-item"><span className="cc-box bg-blue-2"></span> 10 - 20</div>
                    <div className="cc-legend-item"><span className="cc-box bg-blue-3"></span> 20 - 30</div>
                    <div className="cc-legend-item"><span className="cc-box bg-blue-4"></span> {'>'} 40</div>
                  </div>
               </div>
            </div>

            {/* Water Balance Gauge */}
            <div className="cc-gauge-container">
               <div className="cc-metric-label center" style={{marginBottom: '8px'}}>Water Balance (Field Level)</div>
               <div className="cc-gauge-wrapper">
                 <Doughnut data={gaugeData} options={gaugeOptions} />
                 <div className="cc-gauge-value">-12</div>
               </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
