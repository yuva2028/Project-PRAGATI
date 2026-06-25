import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function LocationSearch({ onLocationSelect }) {
  const inputRef = useRef(null);

  useEffect(() => {
    let autocomplete;
    const initAutocomplete = () => {
      if (window.google?.maps?.places) {
        autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['(regions)'],
          componentRestrictions: { country: 'IN' },
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry && place.geometry.location) {
            const lat = parseFloat(place.geometry.location.lat().toFixed(5));
            const lng = parseFloat(place.geometry.location.lng().toFixed(5));
            onLocationSelect(lat, lng, place.formatted_address || place.name);
          }
        });
      }
    };

    // Try initializing immediately
    initAutocomplete();
    
    // Fallback polling in case the script takes longer to load
    const interval = setInterval(() => {
      if (window.google?.maps?.places && !autocomplete) {
        initAutocomplete();
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [onLocationSelect]);

  return (
    <div style={{ position: 'relative', marginBottom: '1rem', padding: '0 1.5rem' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search location in India..."
          style={{
            width: '100%',
            padding: '0.5rem 1rem 0.5rem 2.5rem',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            fontSize: '0.875rem'
          }}
        />
        <Search 
          size={16} 
          style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
        />
      </div>
    </div>
  );
}
