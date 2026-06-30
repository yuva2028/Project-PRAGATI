
/**
 * Detects the user's GPS position via browser Geolocation API.
 * Returns { coords, address, loading, error, permission, setCoords, setAddress }
 *
 * Reverse geocodes via Nominatim (free, no API key needed).
 * Falls back gracefully — no coordinates forced on denial.
 */

import { useState, useEffect } from 'react'

export function useUserLocation() {
  const [coords, setCoords]         = useState(null)   // { lat, lng }
  const [address, setAddress]       = useState(null)   // human-readable string
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [permission, setPermission] = useState('prompt')  // prompt | granted | denied

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5))
        const lng = parseFloat(pos.coords.longitude.toFixed(5))

        setCoords({ lat, lng })
        setPermission('granted')
        setLoading(false)

        // Reverse geocode — try Google Maps Geocoder first, fall back to Nominatim
        try {
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder()
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === 'OK' && results[0]) {
                const component = results.find(r =>
                  r.types.includes('locality') ||
                  r.types.includes('administrative_area_level_2')
                ) || results[0]
                setAddress(component.formatted_address)
              }
            })
          } else {
            // Nominatim reverse geocode (free, no key needed)
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
              { headers: { 'Accept-Language': 'en-IN,en;q=0.9' } }
            )
            const data = await res.json()
            if (data?.display_name) {
              const addr = data.address || {}
              const parts = [
                addr.city || addr.town || addr.village || addr.county || addr.state_district,
                addr.state,
                'India',
              ].filter(Boolean)
              setAddress(parts.join(', '))
            }
          }
        } catch (_) {
          // Reverse geocoding is best-effort; failure is silent
        }
      },

      (err) => {
        // User denied location — DO NOT force any coords; let map show all of India
        setError(err.message)
        setPermission('denied')
        setLoading(false)
        // coords stays null → map defaults to India overview (zoom 5)
      },

      { timeout: 8000, enableHighAccuracy: false }
    )
  }, [])

  return { coords, setCoords, address, setAddress, loading, error, permission }
}

