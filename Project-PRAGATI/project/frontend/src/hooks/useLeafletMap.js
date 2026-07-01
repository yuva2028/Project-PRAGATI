/**
 * Shared hook: initializes a Leaflet map (OpenStreetMap, zero API key needed).
 * Returns { map, fitIndia, fitBounds } once ready, null while loading.
 *
 * Usage:
 *   const mapRef = useRef(null)
 *   const { map, fitBounds } = useLeafletMap(mapRef, { center, zoom })
 *
 * fitBounds([south, north, west, east]) — zooms map to a bounding box.
 * fitIndia()                             — resets view to whole India.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix the default icon path broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// India bounding box [south, north, west, east]
const INDIA_BOUNDS = [[6.5, 37.1], [68.0, 97.5]] // [[sw], [ne]] in Leaflet format

export function useLeafletMap(containerRef, options = {}) {
  const [map, setMap] = useState(null)
  const mapInstanceRef = useRef(null)

  const {
    center = { lat: 20.5937, lng: 78.9629 },
    zoom = 5,
    mapViewState = null,
    onMapChange = null,
  } = options

  // ── Initialise once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return

    const mapInstance = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      // Restrict panning so users can't drift too far outside India
      maxBounds: [[-10, 55], [45, 105]],
      maxBoundsViscosity: 0.6,
    })

    // Dark-style OSM tile layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
      minZoom: 4,
    }).addTo(mapInstance)

    // Restore view state if available
    if (mapViewState) {
      mapInstance.setView([mapViewState.center.lat, mapViewState.center.lng], mapViewState.zoom, { animate: false })
    }

    // Persist view state on move/zoom
    if (onMapChange) {
      const handleMapChange = () => {
        onMapChange({
          center: mapInstance.getCenter(),
          zoom: mapInstance.getZoom()
        })
      }
      mapInstance.on('moveend', handleMapChange)
      mapInstance.on('zoomend', handleMapChange)
    }

    mapInstanceRef.current = mapInstance
    setMap(mapInstance)

    return () => {
      mapInstance.remove()
      mapInstanceRef.current = null
      setMap(null)
    }
  }, [containerRef]) // Removed mapViewState from dependencies so we don't recreate map on pan // run once on mount

  // ── Pan when center changes (user location update) ───────────────────────
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.panTo([center.lat, center.lng])
    }
  }, [center.lat, center.lng])

  // ── fitBounds helper — zooms to a bounding box ───────────────────────────
  const fitBounds = useCallback((bbox) => {
    if (!mapInstanceRef.current || !bbox) return
    // bbox = [south, north, west, east]
    const [s, n, w, e] = bbox
    mapInstanceRef.current.fitBounds([[s, w], [n, e]], { padding: [30, 30], maxZoom: 12 })
  }, [])

  // ── fitIndia — reset to whole-India view ──────────────────────────────────
  const fitIndia = useCallback(() => {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.fitBounds(INDIA_BOUNDS, { padding: [10, 10] })
  }, [])

  return { map, fitBounds, fitIndia }
}
