
/**
 * Detects the user's GPS position via browser Geolocation API.
 * Returns { coords, address, loading, error, permission, setCoords, setAddress }
 *
 * Reverse geocodes via Nominatim (free, no API key needed).
 * Falls back gracefully — no coordinates forced on denial.
 * Caches result in localStorage for 30 min to avoid repeated prompts.
 */

import { useState, useEffect } from 'react'

const LOCATION_CACHE_KEY = 'pragati_user_location'
const LOCATION_CACHE_TTL_MS = 30 * 60 * 1000  // 30 minutes

function loadCachedLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    const age = Date.now() - (cached.ts || 0)
    if (age > LOCATION_CACHE_TTL_MS) return null
    return cached  // { lat, lng, address, ts }
  } catch {
    return null
  }
}

function saveLocationCache(lat, lng, address) {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ lat, lng, address, ts: Date.now() }))
  } catch {
    // storage quota exceeded or private mode — silently skip
  }
}

export function useUserLocation() {
  const cached = loadCachedLocation()

  const [coords, setCoords]         = useState(cached ? { lat: cached.lat, lng: cached.lng } : null)
  const [address, setAddress]       = useState(cached?.address ?? null)
  const [loading, setLoading]       = useState(!cached)   // skip loading if cache hit
  const [error, setError]           = useState(null)
  const [permission, setPermission] = useState('prompt')  // prompt | granted | denied

  useEffect(() => {
    // If cache is fresh, skip the prompt entirely
    if (cached) {
      setPermission('granted')
      return
    }

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

        // Reverse geocode via Nominatim (free, no key needed)
        let resolvedAddress = null
        try {
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
            resolvedAddress = parts.join(', ')
            setAddress(resolvedAddress)
          }
        } catch (_) {
          // Reverse geocoding is best-effort; failure is silent
        }

        saveLocationCache(lat, lng, resolvedAddress)
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
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return { coords, setCoords, address, setAddress, loading, error, permission }
}

