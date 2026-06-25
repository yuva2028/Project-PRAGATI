
/**

 * Detects the user's GPS position via browser Geolocation API.

 * Returns { coords, address, loading, error, permission }

 * Reverse geocodes via Google Maps Geocoder if Maps API is loaded.

 */

import { useState, useEffect } from 'react'



export function useUserLocation() {

  const [coords, setCoords]       = useState(null)   // { lat, lng }

  const [address, setAddress]     = useState(null)   // human-readable string

  const [loading, setLoading]     = useState(true)

  const [error, setError]         = useState(null)

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



        // Reverse geocode using Google Maps Geocoder if available

        try {

          if (window.google?.maps?.Geocoder) {

            const geocoder = new window.google.maps.Geocoder()

            geocoder.geocode({ location: { lat, lng } }, (results, status) => {

              if (status === 'OK' && results[0]) {

                // Extract district/city level

                const component = results.find(r =>

                  r.types.includes('locality') ||

                  r.types.includes('administrative_area_level_2')

                ) || results[0]

                setAddress(component.formatted_address)

              }

            })

          }

        } catch (_) {

          // Geocoding is best-effort; failure is silent

        }

      },

      (err) => {

        setError(err.message)

        setPermission('denied')

        setLoading(false)

        // Fall back to Karnataka centroid

        setCoords({ lat: 15.3, lng: 75.7 })

      },

      { timeout: 8000, enableHighAccuracy: false }

    )

  }, [])



  return { coords, setCoords, address, setAddress, loading, error, permission }

}

