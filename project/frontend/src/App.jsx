import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login.jsx'
import { useTranslation } from 'react-i18next'

import { useUserLocation } from './hooks/useUserLocation.js'
import LocationSearch from './components/LocationSearch.jsx'

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



const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div style={{padding: '2rem'}}>Loading...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {

  const { coords, setCoords, address, setAddress, permission } = useUserLocation()
  const { user, logout } = useAuth()
  const { t, i18n } = useTranslation()

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'hi' : 'en')
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <ProtectedRoute>
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

            <LocationSearch 
              onLocationSelect={(lat, lng, newAddress) => {
                setCoords({ lat, lng });
                setAddress(newAddress);
              }} 
            />

            <div className="nav-section">Platform</div>

            {NAV.map(item => (

              <NavLink

                key={item.path}

                to={item.path}

                end={item.path === '/'}

                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}

              >

                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                {t(item.label)}
              </NavLink>

            ))}

          </nav>



          <div className="sidebar-footer">
            
            <div style={{marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>{user?.username}</span>
              <div>
                <button onClick={toggleLanguage} style={{background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', marginRight: '0.5rem'}}>
                  {i18n.language === 'en' ? 'HI' : 'EN'}
                </button>
                <button onClick={logout} style={{background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem'}}>{t('Logout')}</button>
              </div>
            </div>

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
    </ProtectedRoute>
    } />
    </Routes>
    </BrowserRouter>

  )

}

