"use client"

import { useEffect, useRef, useState } from "react"

interface EventMapProps {
  lat: number
  lng: number
  address?: string
  eventName?: string
  className?: string
  height?: string
  zoom?: number
  interactive?: boolean
}

export function EventMap({
  lat,
  lng,
  address,
  eventName,
  className,
  height = "300px",
  zoom = 15,
  interactive = true,
}: EventMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Ensure coordinates are numbers and valid
  const latitude = Number(lat)
  const longitude = Number(lng)
  const isValidLocation = !isNaN(latitude) && !isNaN(longitude) && 
    latitude >= -90 && latitude <= 90 && 
    longitude >= -180 && longitude <= 180 &&
    (latitude !== 0 || longitude !== 0)

  useEffect(() => {
    if (!mapContainerRef.current || !isValidLocation) {
      setIsLoading(false)
      return
    }

    const initMap = async () => {
      try {
        // Dynamically import mapbox-gl and its CSS
        const mapboxgl = (await import("mapbox-gl")).default
        await import("mapbox-gl/dist/mapbox-gl.css")

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!token) {
          setMapError("Mapbox token is missing")
          setIsLoading(false)
          return
        }
        mapboxgl.accessToken = token

        if (mapRef.current) {
          mapRef.current.remove()
        }

        const map = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [longitude, latitude],
          zoom: zoom,
          interactive: interactive,
        })

        map.on('load', () => {
          setIsLoading(false)
        })

        map.on('error', (e) => {
          console.error('Map error:', e)
          setMapError('Failed to load map')
          setIsLoading(false)
        })

        if (interactive) {
          map.addControl(new mapboxgl.NavigationControl(), "top-right")
        }

        // Add marker with popup
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding: 8px;">
            <strong>${eventName || "Event Location"}</strong>
            ${address ? `<br/><span style="font-size: 12px; color: #666;">${address}</span>` : ""}
          </div>`
        )

        new mapboxgl.Marker({ color: "#2563eb" })
          .setLngLat([longitude, latitude])
          .setPopup(popup)
          .addTo(map)

        mapRef.current = map
      } catch (error) {
        console.error("Error initializing map:", error)
        setMapError("Failed to initialize map")
        setIsLoading(false)
      }
    }

    initMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [latitude, longitude, address, eventName, zoom, interactive, isValidLocation])

  if (!isValidLocation) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No valid location set</p>
      </div>
    )
  }

  if (mapError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ height }}
      >
        <p className="text-sm text-destructive">{mapError}</p>
      </div>
    )
  }

  return (
    <div className="relative" style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg z-10">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
      <div
        ref={mapContainerRef}
        className={`rounded-lg overflow-hidden ${className}`}
        style={{ height, width: "100%" }}
      />
    </div>
  )
}
