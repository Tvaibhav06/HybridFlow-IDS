import { useEffect, useRef } from 'react'
import type { PredictionRecord } from '@/types'
import { ATTACK_COLORS } from '@/config/api'

const ATTACK_ORIGINS = [
  { lat: 39.9042, lng: 116.4074, city: 'Beijing' },
  { lat: 55.7558, lng: 37.6173, city: 'Moscow' },
  { lat: 37.5665, lng: 126.9780, city: 'Seoul' },
  { lat: 52.5200, lng: 13.4050, city: 'Berlin' },
  { lat: 40.7128, lng: -74.0060, city: 'New York' },
  { lat: 35.6762, lng: 139.6503, city: 'Tokyo' },
  { lat: 51.5074, lng: -0.1278, city: 'London' },
  { lat: -23.5505, lng: -46.6333, city: 'São Paulo' },
  { lat: 28.6139, lng: 77.2090, city: 'Delhi' },
  { lat: 1.3521, lng: 103.8198, city: 'Singapore' },
]

interface WorldMapProps {
  predictions: PredictionRecord[]
  height?: number
}

export default function WorldMap({ predictions, height = 300 }: WorldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layerGroupRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    let active = true
    import('leaflet').then((L) => {
      if (!active || !mapRef.current || mapInstanceRef.current) return
      const map = L.map(mapRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

      layerGroupRef.current = L.layerGroup().addTo(map)
      mapInstanceRef.current = map
    })

    return () => {
      active = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        layerGroupRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return

    import('leaflet').then((L) => {
      const layer = layerGroupRef.current
      if (!layer) return
      layer.clearLayers()

      const attackPredictions = predictions.filter(p => p.predicted_attack !== 'BENIGN')
      attackPredictions.slice(-20).forEach((pred, i) => {
        const origin = ATTACK_ORIGINS[i % ATTACK_ORIGINS.length]
        const color = ATTACK_COLORS[pred.predicted_attack] || '#99362E'

        const icon = L.divIcon({
          html: `<div style="
            width: 8px; height: 8px;
            background: ${color};
            border: 1px solid #262420;
            border-radius: 0px;
          "></div>`,
          className: '',
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        })

        L.marker([origin.lat, origin.lng], { icon })
          .addTo(layer)
          .bindPopup(`
            <div style="font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace; font-size: 11px; color: #1C1B18">
              <strong style="color: ${color}">${pred.predicted_attack}</strong><br/>
              ${origin.city}<br/>
              Score: ${pred.threat_score.toFixed(0)}
            </div>
          `)
      })
    })
  }, [predictions])

  if (predictions.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-bg-base rounded-[2px] border border-border"
      >
        <span className="font-mono text-xs text-text-muted">No attack data to display</span>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="w-full rounded-[2px] border border-border overflow-hidden"
    />
  )
}
