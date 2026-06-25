
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'

import { useUserLocation } from './hooks/useUserLocation.js'

import Home from './pages/Home.jsx'

import CropMap from './pages/CropMap.jsx'

import MoistureStress from './pages/MoistureStress.jsx'

import IrrigationAdvisory from './pages/IrrigationAdvisory.jsx'

import Analytics from './pages/Analytics.jsx'



const NAV = [

  { path: '/',          label: 'Overview',           icon: '⊞' },

  { path: '/crop-map',  label: 'Crop Classification', icon: '◈' },

  { path: '/stress',    label: 'Moisture Stress',     icon: '◉' },

  { path: '/advisory',  label: 'Irrigation Advisory', icon: '◆' },

  { path: '/analytics', label: 'Analytics',           icon: '▦' },

]



export default function App() {

  const { coords, address, permission } = useUserLocation()



  return (

    <BrowserRouter>

      <div className="app-layout">

        <a href="#main-content" className="skip-link">Skip to main content</a>



        <aside className="sidebar" role="complementary" aria-label="Application sidebar">

          <div className="sidebar-header">

            <div className="brand-mark">

              <div className="brand-icon" aria-hidden="true">🛰</div>

              <div>

                <div className="brand-name">PRAGATI</div>

                <div className="brand-sub">ISRO · 2025</div>

              </div>

            </div>

          </div>



          <nav className="sidebar-nav" aria-label="Main navigation">

            <div className="nav-section">Platform</div>

            {NAV.map(item => (

              <NavLink

                key={item.path}

                to={item.path}

                end={item.path === '/'}

                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}

              >

                <span className="nav-icon" aria-hidden="true">{item.icon}</span>

                {item.label}

              </NavLink>

            ))}

          </nav>



          <div className="sidebar-footer">

            <div className="location-pill" aria-label="Your detected location">

              <div className="location-pill-label">

                📍 {permission === 'granted' ? 'Your Location' : 'Pilot Area'}

              </div>

              <div className="location-pill-value">

                {address

                  ? address.split(',').slice(0, 2).join(',')

                  : 'Karnataka, India'}

              </div>

              {coords && (

                <div className="location-pill-coords">

                  {coords.lat}°N {coords.lng}°E

                </div>

              )}

            </div>

          </div>

        </aside>



        <main id="main-content" className="main-content">

          <Routes>

            <Route path="/"          element={<Home userCoords={coords} />} />

            <Route path="/crop-map"  element={<CropMap userCoords={coords} />} />

            <Route path="/stress"    element={<MoistureStress userCoords={coords} />} />

            <Route path="/advisory"  element={<IrrigationAdvisory userCoords={coords} />} />

            <Route path="/analytics" element={<Analytics />} />

          </Routes>

        </main>

      </div>

    </BrowserRouter>

  )

}

