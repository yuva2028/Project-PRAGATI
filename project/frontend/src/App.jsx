import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home.jsx'
import CropMap from './pages/CropMap.jsx'
import MoistureStress from './pages/MoistureStress.jsx'
import IrrigationAdvisory from './pages/IrrigationAdvisory.jsx'
import Analytics from './pages/Analytics.jsx'

const navItems = [
  { path: '/',          label: 'Home',               icon: '🏠' },
  { path: '/crop-map',  label: 'Crop Classification', icon: '🌾' },
  { path: '/stress',    label: 'Moisture Stress',     icon: '💧' },
  { path: '/advisory',  label: 'Irrigation Advisory', icon: '📋' },
  { path: '/analytics', label: 'Analytics',           icon: '📈' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <a href="#main-content" className="skip-link">Skip to main content</a>

        {/* ── Sidebar ─────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-badge">
              <div className="logo-icon">🛰️</div>
              <div className="logo-text">
                <h1>PRAGATI</h1>
                <p>ISRO Hackathon 2025</p>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <span className="nav-section-label">Navigation</span>
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-pilot">
            <div className="pilot-badge">
              <span>📍 Pilot Area</span>
              <strong>Karnataka, India</strong>
              <span className="pilot-meta">
                Sentinel-1/2 | GEE
              </span>
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────── */}
        <main id="main-content" className="main-content">
          <Routes>
            <Route path="/"          element={<Home />} />
            <Route path="/crop-map"  element={<CropMap />} />
            <Route path="/stress"    element={<MoistureStress />} />
            <Route path="/advisory"  element={<IrrigationAdvisory />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  )
}
