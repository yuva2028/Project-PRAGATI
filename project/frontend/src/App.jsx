import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login.jsx'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useStore } from './store/useStore'

import { useUserLocation } from './hooks/useUserLocation.js'
import LocationSearch from './components/LocationSearch.jsx'
import ChatBot from './components/ChatBot.jsx'

import Home from './pages/Home.jsx'
import CropMap from './pages/CropMap.jsx'
import MoistureStress from './pages/MoistureStress.jsx'
import IrrigationAdvisory from './pages/IrrigationAdvisory.jsx'
import Analytics from './pages/Analytics.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

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
  const { activeField, setActiveField, bbox, setBbox, mapViewState, setMapViewState } = useStore()
  const [apiStatus, setApiStatus] = useState('checking')
  const [geeStatus, setGeeStatus] = useState('checking')

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'hi' : 'en')
  }

  useEffect(() => {
    const handleFieldSelect = (e) => {
      setActiveField(e.detail);
    };
    window.addEventListener('pragati-field-selected', handleFieldSelect);
    return () => window.removeEventListener('pragati-field-selected', handleFieldSelect);
  }, []);

  useEffect(() => {
    let active = true
    const checkHealth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/health`)
        if (response.ok) {
          const data = await response.json()
          if (active) {
            setApiStatus('online')
            setGeeStatus(data.gee ? 'online' : 'offline')
          }
        } else {
          if (active) {
            setApiStatus('offline')
            setGeeStatus('offline')
          }
        }
      } catch (err) {
        if (active) {
          setApiStatus('offline')
          setGeeStatus('offline')
        }
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 15000) // check every 15s
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

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
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '4px 8px',
                    marginTop: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      width: 'fit-content'
                    }} aria-label={`API status: ${apiStatus}`}>
                      <span style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: apiStatus === 'online' ? 'var(--emerald-500)' : (apiStatus === 'offline' ? 'var(--red-500)' : 'var(--amber-500)'),
                        display: 'inline-block',
                        boxShadow: apiStatus === 'online' ? '0 0 6px var(--emerald-500)' : (apiStatus === 'offline' ? '0 0 6px var(--red-500)' : 'none')
                      }} />
                      <span style={{
                        color: apiStatus === 'online' ? 'var(--navy-200)' : 'var(--navy-400)',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        {apiStatus === 'online' ? 'API Online' : (apiStatus === 'offline' ? 'API Offline' : 'Checking...')}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      width: 'fit-content'
                    }} aria-label={`GEE status: ${geeStatus}`}>
                      <span style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: geeStatus === 'online' ? 'var(--blue-400)' : (geeStatus === 'offline' ? 'var(--red-500)' : 'var(--amber-500)'),
                        display: 'inline-block',
                        boxShadow: geeStatus === 'online' ? '0 0 6px var(--blue-400)' : 'none'
                      }} />
                      <span style={{
                        color: geeStatus === 'online' ? 'var(--navy-200)' : 'var(--navy-400)',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        {geeStatus === 'online' ? 'GEE Online' : 'GEE Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                <nav className="sidebar-nav" aria-label="Main navigation">

                  {/* Location search — passes bbox for fit-to-place */}
                  <LocationSearch
                    onLocationSelect={(lat, lng, newAddress, newBbox) => {
                      setCoords({ lat, lng });
                      setAddress(newAddress);
                      if (newBbox) setBbox(newBbox);
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
                      📍 {permission === 'granted' ? 'Your Location' : 'Selected Area'}
                    </div>
                    <div className="location-pill-value">
                      {address
                        ? address.split(',').slice(0, 2).join(',')
                        : 'India'}
                    </div>
                    {coords && (
                      <div className="location-pill-coords">
                        {coords.lat.toFixed(4)}°N {coords.lng.toFixed(4)}°E
                      </div>
                    )}
                  </div>

                </div>

              </aside>

              <main id="main-content" className="main-content">
                {apiStatus === 'offline' && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
                    padding: '10px 24px',
                    fontSize: '0.85rem',
                    color: '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center',
                    animation: 'fadeUp 0.3s ease'
                  }}>
                    <span className="live-dot" style={{ background: '#ef4444' }} />
                    <strong>API Connection Offline:</strong> The backend server is unreachable. Ensure the FastAPI server is running on port 8000.
                  </div>
                )}
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/crop-map" element={
                      <CropMap 
                        userCoords={coords} 
                        userBbox={bbox} 
                        mapViewState={mapViewState}
                        onMapChange={setMapViewState}
                      />
                    } />
                    <Route path="/stress" element={
                      <MoistureStress 
                        userCoords={coords} 
                        userBbox={bbox} 
                        mapViewState={mapViewState}
                        onMapChange={setMapViewState}
                      />
                    } />
                    <Route path="/advisory" element={
                      <IrrigationAdvisory 
                        userCoords={coords} 
                        userBbox={bbox} 
                        mapViewState={mapViewState}
                        onMapChange={setMapViewState}
                      />
                    } />
                    <Route path="/analytics" element={<Analytics userCoords={coords} />} />
                  </Routes>
                </ErrorBoundary>
              </main>

            </div>
            <ChatBot userCoords={coords} />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}
