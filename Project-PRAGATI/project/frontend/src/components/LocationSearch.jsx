import React, { useState, useRef, useCallback } from 'react';

/**
 * LocationSearch — India-aware place search using Nominatim.
 * Typing any Indian state, district, city, or village will return real
 * geocoded coordinates and the bounding box so the map can fit-zoom to it.
 *
 * Props:
 *  onLocationSelect(lat, lng, displayName, boundingBox?)
 *    boundingBox: [south, north, west, east] as floats — optional, for fitBounds
 */
export default function LocationSearch({ onLocationSelect }) {
  const [query, setQuery]           = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [activeIdx, setActiveIdx]   = useState(-1);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  // ── Geocoding via Nominatim ──────────────────────────────────────────────
  const doSearch = useCallback(async (value) => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]); setIsOpen(false); return;
    }
    setLoading(true);
    try {
      // Bias results to India; ask for addressdetails and boundingbox
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('q', value.trim());
      url.searchParams.set('countrycodes', 'in');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '7');
      url.searchParams.set('dedupe', '1');
      // Boost admin levels (state / district / city) by including feature types
      url.searchParams.set('featuretype', 'settlement');

      const res  = await fetch(url.toString(), {
        headers: { 'Accept-Language': 'en-IN,en;q=0.9' }
      });
      const data = await res.json();

      // Fallback if settlement filter yields nothing — try without it
      if (data.length === 0) {
        const url2 = new URL('https://nominatim.openstreetmap.org/search');
        url2.searchParams.set('format', 'json');
        url2.searchParams.set('q', value.trim() + ', India');
        url2.searchParams.set('countrycodes', 'in');
        url2.searchParams.set('addressdetails', '1');
        url2.searchParams.set('limit', '7');
        url2.searchParams.set('dedupe', '1');
        const res2  = await fetch(url2.toString(), { headers: { 'Accept-Language': 'en-IN,en;q=0.9' } });
        const data2 = await res2.json();
        setSuggestions(data2);
        setIsOpen(data2.length > 0);
        setActiveIdx(-1);
      } else {
        setSuggestions(data);
        setIsOpen(true);
        setActiveIdx(-1);
      }
    } catch {
      /* network error — silently ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 350);
  };

  // ── Select a result ──────────────────────────────────────────────────────
  const select = (place) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);

    // Build a short label: city/district + state
    const addr = place.address || {};
    const parts = [
      addr.city || addr.town || addr.village || addr.county || addr.state_district,
      addr.state,
    ].filter(Boolean);
    const label = parts.length > 0
      ? parts.join(', ')
      : place.display_name.split(',').slice(0, 2).join(', ');

    setQuery(label);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIdx(-1);

    // Convert Nominatim boundingbox [minlat, maxlat, minlon, maxlon]
    // to [south, north, west, east]
    let bbox = null;
    if (place.boundingbox && place.boundingbox.length === 4) {
      const [s, n, w, e] = place.boundingbox.map(parseFloat);
      bbox = [s, n, w, e];
    }

    onLocationSelect(lat, lng, place.display_name, bbox);
  };

  // ── Keyboard nav ─────────────────────────────────────────────────────────
  const handleKey = (e) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        select(suggestions[activeIdx]);
      } else if (suggestions.length > 0) {
        select(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
    }
  };

  // ── Helper: friendly type label ──────────────────────────────────────────
  const typeLabel = (place) => {
    const t = place.type || place.class || '';
    const map = {
      administrative: 'Region', state: 'State', district: 'District',
      city: 'City', town: 'Town', village: 'Village', suburb: 'Area',
      hamlet: 'Village', county: 'District',
    };
    return map[t] || '';
  };

  return (
    <div style={{ position: 'relative', marginBottom: '1rem', padding: '0 1.5rem' }}>
      <div style={{ position: 'relative' }}>
        {/* Search icon */}
        <span style={{
          position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none', fontSize: 14
        }}>
          {loading ? '⏳' : '🔍'}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 180)}
          placeholder="Search state, district, city…"
          aria-label="Search location in India"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '0.5rem 1rem 0.5rem 2.5rem',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            fontSize: '0.875rem',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--blue-400, #60a5fa)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
        />
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Location suggestions"
          style={{
            position: 'absolute', top: '100%', left: '1.5rem', right: '1.5rem',
            background: 'var(--card-bg, #1e293b)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px', listStyle: 'none', margin: '4px 0 0', padding: 0,
            zIndex: 9999, maxHeight: 260, overflowY: 'auto',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          {suggestions.map((s, i) => {
            const addr = s.address || {};
            const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
            const state = addr.state || '';
            const lbl = typeLabel(s);

            return (
              <li
                key={s.place_id}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={() => select(s)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  padding: '0.55rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: 'var(--text-main)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: i === activeIdx ? 'rgba(96,165,250,0.12)' : 'transparent',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ marginTop: 1, flexShrink: 0 }}>📍</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: i === activeIdx ? 'var(--blue-300, #93c5fd)' : '#fff',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {city || s.display_name.split(',')[0]}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {[state, 'India'].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {lbl && (
                  <span style={{
                    fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
                    fontWeight: 600, flexShrink: 0, alignSelf: 'center',
                  }}>
                    {lbl}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
