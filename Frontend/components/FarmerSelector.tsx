'use client'

import { useState, useEffect } from 'react'
import { fetchFarmers, Farmer } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, MapPin, Sprout } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface FarmerSelectorProps {
  onSelect: (farmer: Farmer) => void
  selected?: string
}

export function FarmerSelector({ onSelect, selected }: FarmerSelectorProps) {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFarmers() {
      try {
        const data = await fetchFarmers()
        setFarmers(data)
      } catch (error) {
        console.error('Failed to load farmers:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFarmers()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {farmers.map((farmer) => (
        <Card
          key={farmer.id}
          className={`cursor-pointer border-2 transition-all hover:border-primary ${
            selected === farmer.id ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onClick={() => onSelect(farmer)}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">{farmer.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="w-4 h-4" />
                    {farmer.location}
                  </div>
                </div>
                {farmer.verified && (
                  <Badge className="bg-green-100 text-green-800">Verified</Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.floor(farmer.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-foreground">{farmer.rating}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {farmer.crops.map((crop) => (
                  <Badge key={crop} variant="secondary" className="gap-1">
                    <Sprout className="w-3 h-3" />
                    {crop}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
