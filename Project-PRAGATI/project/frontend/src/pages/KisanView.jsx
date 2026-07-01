import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPin, Droplets, Sun, Cloud, Volume2 } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * KisanView — Simplified Farmer-Facing Dashboard
 * Giant traffic-light cards: 🔴 IRRIGATE NOW, 🟡 MONITOR, 🟢 HEALTHY
 * Bilingual Hindi/English, mobile-first design, accessibility-focused
 */
export default function KisanView() {
  const { userCoords, activeField } = useStore();
  const { t, i18n } = useTranslation();

  const [advisoryData, setAdvisoryData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(i18n.language === 'hi' ? 'hi' : 'en');

  const labels = {
    en: {
      title: 'KisanView — Farmer Advisory',
      subtitle: 'Simple irrigation guidance for your fields',
      irrigateNow: 'IRRIGATE NOW',
      monitor: 'MONITOR CLOSELY',
      healthy: 'HEALTHY — NO ACTION',
      field: 'Field',
      crop: 'Crop',
      water: 'Water Needed',
      action: 'Action',
      mm: 'mm',
      weather: 'Weather Forecast',
      noFields: 'No field data available. Please wait or check your connection.',
      critical: 'CRITICAL — Irrigate within 24 hours',
      high: 'HIGH — Irrigate within 48 hours',
      routine: 'ROUTINE — Standard schedule',
      tapForDetails: 'Tap for details',
      language: 'Language',
      ttsHint: 'Tap speaker icon to hear advisory',
    },
    hi: {
      title: 'किसान दृश्य — कृषि सलाह',
      subtitle: 'आपके खेतों के लिए सरल सिंचाई मार्गदर्शन',
      irrigateNow: 'अभी सिंचाई करें',
      monitor: 'निगरानी रखें',
      healthy: 'स्वस्थ — कोई कार्रवाई नहीं',
      field: 'खेत',
      crop: 'फसल',
      water: 'पानी की आवश्यकता',
      action: 'कार्रवाई',
      mm: 'मिमी',
      weather: 'मौसम पूर्वानुमान',
      noFields: 'कोई खेत डेटा उपलब्ध नहीं। कृपया प्रतीक्षा करें।',
      critical: 'गंभीर — 24 घंटे में सिंचाई करें',
      high: 'उच्च — 48 घंटे में सिंचाई करें',
      routine: 'सामान्य — मानक कार्यक्रम',
      tapForDetails: 'विवरण के लिए टैप करें',
      language: 'भाषा',
      ttsHint: 'सलाह सुनने के लिए स्पीकर आइकन टैप करें',
    },
  };

  const L = labels[lang];

  useEffect(() => {
    setLoading(true);
    const params = userCoords ? `?lat=${userCoords.lat}&lng=${userCoords.lng}` : '';

    Promise.all([
      fetch(`${API}/api/advisory${params}`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/weather-forecast${params}`).then(r => r.json()).catch(() => null),
    ]).then(([adv, weather]) => {
      setAdvisoryData(adv);
      setWeatherData(weather);
      setLoading(false);
    });
  }, [userCoords]);

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getTrafficLight = (priority) => {
    switch (priority) {
      case 'CRITICAL': return { bg: '#dc2626', bgLight: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.4)', emoji: '🔴', label: L.irrigateNow, desc: L.critical };
      case 'HIGH': return { bg: '#f59e0b', bgLight: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', emoji: '🟡', label: L.monitor, desc: L.high };
      default: return { bg: '#22c55e', bgLight: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)', emoji: '🟢', label: L.healthy, desc: L.routine };
    }
  };

  const advisories = advisoryData?.advisories || [];
  const grouped = {
    CRITICAL: advisories.filter(a => a.priority === 'CRITICAL'),
    HIGH: advisories.filter(a => a.priority === 'HIGH'),
    LOW: advisories.filter(a => a.priority !== 'CRITICAL' && a.priority !== 'HIGH'),
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)', marginBottom: '1rem' }} />
          <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
            {lang === 'hi' ? 'डेटा लोड हो रहा है...' : 'Loading farm data...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Language Toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div style={{
          display: 'flex', gap: '4px', background: 'var(--card-bg)',
          padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <button
            onClick={() => { setLang('en'); i18n.changeLanguage('en'); }}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none',
              background: lang === 'en' ? 'var(--blue-600)' : 'transparent',
              color: lang === 'en' ? 'white' : 'var(--text-muted)',
              fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer',
            }}
          >
            English
          </button>
          <button
            onClick={() => { setLang('hi'); i18n.changeLanguage('hi'); }}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none',
              background: lang === 'hi' ? 'var(--blue-600)' : 'transparent',
              color: lang === 'hi' ? 'white' : 'var(--text-muted)',
              fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer',
            }}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'white', margin: 0 }}>
          👨‍🌾 {L.title}
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          {L.subtitle}
        </p>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <Volume2 size={12} /> {L.ttsHint}
        </p>
      </div>

      {/* Traffic Light Cards */}
      {['CRITICAL', 'HIGH', 'LOW'].map(priority => {
        const fields = grouped[priority] || [];
        if (fields.length === 0) return null;
        const tl = getTrafficLight(priority);

        return (
          <div key={priority} style={{ marginBottom: '1.5rem' }}>
            {/* Priority Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '1rem 1.25rem', borderRadius: '12px 12px 0 0',
              background: tl.bgLight, borderTop: `3px solid ${tl.bg}`,
              borderLeft: `1px solid ${tl.border}`, borderRight: `1px solid ${tl.border}`,
            }}>
              <span style={{ fontSize: '2rem' }}>{tl.emoji}</span>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: tl.bg }}>{tl.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tl.desc} · {fields.length} {L.field}</div>
              </div>
              <button
                onClick={() => speak(`${tl.label}. ${fields.length} ${lang === 'hi' ? 'खेत' : 'fields'}. ${tl.desc}`)}
                aria-label="Speak advisory"
                style={{
                  marginLeft: 'auto', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  padding: '8px', cursor: 'pointer', color: 'var(--text-main)',
                }}
              >
                <Volume2 size={18} />
              </button>
            </div>

            {/* Field Cards */}
            <div style={{
              border: `1px solid ${tl.border}`, borderTop: 'none',
              borderRadius: '0 0 12px 12px', overflow: 'hidden',
            }}>
              {fields.map((field, i) => (
                <div key={i} style={{
                  padding: '1rem 1.25rem',
                  borderBottom: i < fields.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: 'var(--card-bg)',
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.75rem', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{L.field}</div>
                    <div style={{ fontSize: '1rem', fontWeight: '700', color: 'white' }}>{field.field_id}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{L.crop}</div>
                    <div style={{ fontSize: '1rem', fontWeight: '700', color: 'white' }}>{field.crop}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{L.water}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: tl.bg }}>
                      {field.water_to_apply_mm?.toFixed(1) || '—'} {L.mm}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {advisories.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem', color: 'var(--text-muted)',
          fontSize: '1rem', background: 'var(--card-bg)', borderRadius: '12px',
        }}>
          {L.noFields}
        </div>
      )}

      {/* Weather Preview */}
      {weatherData?.daily && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cloud size={18} /> {L.weather}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {weatherData.daily.slice(0, 5).map((d, i) => (
              <div key={i} className="card-glass" style={{
                flex: '0 0 auto', minWidth: '120px', padding: '1rem',
                textAlign: 'center', borderRadius: '12px',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  {d.day_short}
                </div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{d.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'white' }}>
                  {d.temp_max_c}° / {d.temp_min_c}°
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--blue-400)', marginTop: '0.25rem' }}>
                  <Droplets size={12} style={{ display: 'inline', marginRight: '2px' }} />
                  {d.precipitation_mm} mm
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
