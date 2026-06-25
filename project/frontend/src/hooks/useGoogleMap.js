
/**

 * Shared hook: initialises a Google Map on a given container ref.

 * Returns { map, mapsApi } once loaded, null while loading.

 *

 * Usage:

 *   const mapRef = useRef(null)

 *   const { map } = useGoogleMap(mapRef, { center, zoom, mapId })

 */

import { useEffect, useRef, useState } from 'react'



const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''



let _loaderPromise = null



function loadGoogleMapsScript() {

  if (window.google?.maps) return Promise.resolve(window.google.maps)

  if (_loaderPromise) return _loaderPromise

  _loaderPromise = new Promise((resolve, reject) => {

    const script = document.createElement('script')

    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=marker,visualization&v=weekly`

    script.async = true

    script.defer = true

    script.onload = () => resolve(window.google.maps)

    script.onerror = () => reject(new Error('Google Maps failed to load'))

    document.head.appendChild(script)

  })

  return _loaderPromise

}



export function useGoogleMap(containerRef, options = {}) {

  const [map, setMap] = useState(null)

  const [mapsApi, setMapsApi] = useState(null)

  const mapInstanceRef = useRef(null)



  const {

    center = { lat: 15.3, lng: 75.7 },

    zoom = 7,

    mapId = 'PRAGATI_DARK',

  } = options



  useEffect(() => {

    if (!containerRef.current) return

    let cancelled = false



    loadGoogleMapsScript().then((maps) => {

      if (cancelled || mapInstanceRef.current) return



      const mapInstance = new maps.Map(containerRef.current, {

        center,

        zoom,

        mapId,
        mapTypeId: 'hybrid',
        // Professional dark style — matches the navy UI
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0a0f1e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0f1e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
          { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#263348' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
          { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1e293b' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0d1526' }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,

      })



      mapInstanceRef.current = mapInstance

      setMap(mapInstance)

      setMapsApi(maps)

    }).catch(console.error)



    return () => { cancelled = true }

  }, [])  // only run once on mount



  return { map, mapsApi }
}

// Eagerly preload the Google Maps script as soon as this module is evaluated,
// so it doesn't wait for the backend API calls (which block map rendering) to finish.
loadGoogleMapsScript().catch(() => {})
