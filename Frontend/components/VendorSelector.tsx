'use client'

import { useState, useEffect } from 'react'
import { fetchVendors, Vendor } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, MapPin, Package } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface VendorSelectorProps {
  onSelect: (vendor: Vendor) => void
  selected?: string
}

export function VendorSelector({ onSelect, selected }: VendorSelectorProps) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadVendors() {
      try {
        const data = await fetchVendors()
        setVendors(data)
      } catch (error) {
        console.error('Failed to load vendors:', error)
      } finally {
        setLoading(false)
      }
    }

    loadVendors()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {vendors.map((vendor) => (
        <Card
          key={vendor.id}
          className={`cursor-pointer border-2 transition-all hover:border-primary ${
            selected === vendor.id ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onClick={() => onSelect(vendor)}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">{vendor.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="w-4 h-4" />
                    {vendor.location}
                  </div>
                </div>
                {vendor.verified && (
                  <Badge className="bg-green-100 text-green-800">Verified</Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.floor(vendor.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-foreground">{vendor.rating}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {vendor.products.map((product) => (
                  <Badge key={product} variant="secondary" className="gap-1">
                    <Package className="w-3 h-3" />
                    {product}
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
