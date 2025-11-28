"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MapPin, Search, Loader2 } from "lucide-react"

interface LocationPickerProps {
  value: {
    address: string
    lat: number
    lng: number
  }
  onChange: (location: { address: string; lat: number; lng: number }) => void
  className?: string
}

export function LocationPicker({ value, onChange, className }: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const initMap = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default
        await import("mapbox-gl/dist/mapbox-gl.css")
        
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!token) {
          setMapError("Mapbox token is missing")
          return
        }
        mapboxgl.accessToken = token

        const initialLng = value.lng || 77.209
        const initialLat = value.lat || 28.6139

        const map = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [initialLng, initialLat],
          zoom: 12,
        })

        map.addControl(new mapboxgl.NavigationControl(), "top-right")

        // Add marker
        const marker = new mapboxgl.Marker({
          color: "#2563eb",
          draggable: true,
        })
          .setLngLat([initialLng, initialLat])
          .addTo(map)

        // Handle marker drag
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat()
          reverseGeocode(lngLat.lng, lngLat.lat)
        })

        // Handle map click
        map.on("click", (e) => {
          marker.setLngLat([e.lngLat.lng, e.lngLat.lat])
          reverseGeocode(e.lngLat.lng, e.lngLat.lat)
        })

        map.on("load", () => {
          setMapLoaded(true)
        })

        mapRef.current = map
        markerRef.current = marker
      } catch (error) {
        console.error("Error initializing map:", error)
        setMapError("Failed to load map")
      }
    }

    initMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update marker when value changes externally
  useEffect(() => {
    if (markerRef.current && value.lat && value.lng) {
      markerRef.current.setLngLat([value.lng, value.lat])
      mapRef.current?.flyTo({ center: [value.lng, value.lat], zoom: 15 })
    }
  }, [value.lat, value.lng])

  const reverseGeocode = async (lng: number, lat: number) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
      )
      const data = await response.json()
      const address = data.features?.[0]?.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      
      onChange({
        address,
        lat,
        lng,
      })
    } catch (error) {
      console.error("Reverse geocode error:", error)
      onChange({
        address: value.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        lat,
        lng,
      })
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=1`
      )
      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center
        const address = data.features[0].place_name

        onChange({ address, lat, lng })

        if (markerRef.current && mapRef.current) {
          markerRef.current.setLngLat([lng, lat])
          mapRef.current.flyTo({ center: [lng, lat], zoom: 15 })
        }
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Select Location
        </CardTitle>
        <CardDescription>
          Search for an address or click on the map to set location
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Map */}
        <div className="relative w-full h-[300px] rounded-lg overflow-hidden border">
          {!mapLoaded && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <p className="text-sm text-destructive">{mapError}</p>
            </div>
          )}
          <div
            ref={mapContainerRef}
            className="w-full h-full"
          />
        </div>

        {/* Coordinates Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Latitude</Label>
            <Input
              type="number"
              step="any"
              value={value.lat || ""}
              onChange={(e) =>
                onChange({ ...value, lat: parseFloat(e.target.value) || 0 })
              }
              placeholder="Latitude"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Longitude</Label>
            <Input
              type="number"
              step="any"
              value={value.lng || ""}
              onChange={(e) =>
                onChange({ ...value, lng: parseFloat(e.target.value) || 0 })
              }
              placeholder="Longitude"
            />
          </div>
        </div>

        {/* Selected Address */}
        {value.address && (
          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-xs text-muted-foreground">Selected Address</Label>
            <p className="text-sm mt-1">{value.address}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
