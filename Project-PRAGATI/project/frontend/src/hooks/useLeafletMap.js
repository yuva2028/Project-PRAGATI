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

    // Freely available open source map layers (Zero API key needed)
    // 1. OpenStreetMap Standard
    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19,
      minZoom: 3,
    })

    // 2. OpenStreetMap Humanitarian (HOT)
    const osmHot = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles courtesy of <a href="https://www.hotosm.org/">HOT</a>',
      subdomains: 'abc',
      maxZoom: 19,
      minZoom: 3,
    })

    // 3. OpenTopoMap (Topographic open source)
    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      subdomains: 'abc',
      maxZoom: 17,
      minZoom: 3,
    })

    // 4. Satellite Imagery (ESRI World Imagery)
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19,
      minZoom: 3,
    })

    // Default to OpenStreetMap Standard
    osmStandard.addTo(mapInstance)

    // Add layer switcher control for quick switching between open source maps
    const baseLayers = {
      "OpenStreetMap": osmStandard,
      "OSM Humanitarian": osmHot,
      "OpenTopoMap": openTopo,
      "Satellite": satellite,
    }
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(mapInstance)

    // Ensure map tiles are fully calculated & visible after layout render
    const resizeTimer = setTimeout(() => {
      mapInstance.invalidateSize()
    }, 200)

    const handleResize = () => {
      mapInstance.invalidateSize()
    }
    window.addEventListener('resize', handleResize)

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
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', handleResize)
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
