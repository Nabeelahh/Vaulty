'use client'

import { useEffect, useState } from 'react'
import { fetchEscrows, Escrow, mockFarmers, mockVendors } from '@/lib/api'
import { EscrowTimeline } from '@/components/EscrowTimeline'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

export default function TrackPage() {
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [filteredEscrows, setFilteredEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [autoRefreshCount, setAutoRefreshCount] = useState(0)

  // Simulate real-time updates
  useEffect(() => {
    async function loadEscrows() {
      try {
        const data = await fetchEscrows()
        setEscrows(data)
      } catch (error) {
        console.error('Failed to load escrows:', error)
      } finally {
        setLoading(false)
      }
    }

    loadEscrows()

    // Simulate auto-refresh every 15 seconds
    const interval = setInterval(() => {
      setAutoRefreshCount((c) => c + 1)
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  // Filter escrows based on search and status
  useEffect(() => {
    let result = escrows

    if (searchQuery) {
      result = result.filter(
        (e) =>
          mockFarmers
            .find((f) => f.id === e.farmerId)
            ?.name.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          mockVendors
            .find((v) => v.id === e.vendorId)
            ?.name.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          e.crop.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedStatus && selectedStatus !== 'all') {
      result = result.filter((e) => e.status === selectedStatus)
    }

    setFilteredEscrows(result)
  }, [escrows, searchQuery, selectedStatus])

  const statusCounts = {
    funded: escrows.filter((e) => e.status === 'funded').length,
    voucher_minted: escrows.filter((e) => e.status === 'voucher_minted').length,
    redeemed: escrows.filter((e) => e.status === 'redeemed').length,
    repaying: escrows.filter((e) => e.status === 'repaying').length,
    repaid: escrows.filter((e) => e.status === 'repaid').length,
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'funded':
        return <TrendingUp className="w-4 h-4 text-blue-600" />
      case 'voucher_minted':
        return <CheckCircle className="w-4 h-4 text-purple-600" />
      case 'redeemed':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'repaying':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'repaid':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Track Active Escrows</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          Real-time monitoring of your funded rounds
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Live updates" />
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Last updated: Just now (Auto-refresh every 15s)
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {[
          { status: 'funded', label: 'Funded', color: 'bg-blue-100 text-blue-800' },
          { status: 'voucher_minted', label: 'Voucher Minted', color: 'bg-purple-100 text-purple-800' },
          { status: 'redeemed', label: 'Redeemed', color: 'bg-yellow-100 text-yellow-800' },
          { status: 'repaying', label: 'Repaying', color: 'bg-green-100 text-green-800' },
          { status: 'repaid', label: 'Repaid', color: 'bg-emerald-100 text-emerald-800' },
        ].map((s) => (
          <button
            key={s.status}
            onClick={() => setSelectedStatus(selectedStatus === s.status ? null : s.status)}
            className={`p-3 rounded-lg border-2 transition-all text-center cursor-pointer ${
              selectedStatus === s.status
                ? `border-primary ${s.color}`
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="text-2xl font-bold text-foreground">
              {statusCounts[s.status as keyof typeof statusCounts]}
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder="Search by farmer name, vendor, or crop..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full"
      />

      {/* Escrows List */}
      <div className="space-y-6">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))
        ) : filteredEscrows.length > 0 ? (
          filteredEscrows.map((escrow) => {
            const farmer = mockFarmers.find((f) => f.id === escrow.farmerId)
            const vendor = mockVendors.find((v) => v.id === escrow.vendorId)

            return (
              <Card key={escrow.id} className="border border-border overflow-hidden hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-foreground">{farmer?.name}</h3>
                        <Badge className={`gap-1 ${
                          escrow.status === 'funded'
                            ? 'bg-blue-100 text-blue-800'
                            : escrow.status === 'voucher_minted'
                              ? 'bg-purple-100 text-purple-800'
                              : escrow.status === 'redeemed'
                                ? 'bg-yellow-100 text-yellow-800'
                                : escrow.status === 'repaying'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {getStatusIcon(escrow.status)}
                          {escrow.status
                            .split('_')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        {farmer?.location}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">${escrow.amount}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(escrow.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Summary info */}
                  <div className="grid grid-cols-3 gap-4 pb-6 border-b border-border">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Crop</p>
                      <p className="font-semibold text-foreground">{escrow.crop}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Vendor</p>
                      <p className="font-semibold text-foreground">{vendor?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Repayment</p>
                      <p className="font-semibold text-primary">${escrow.repaymentAmount}</p>
                    </div>
                  </div>

                  {/* Timeline */}
                  <EscrowTimeline currentStatus={escrow.status} />

                  {/* Repayment info */}
                  {escrow.status === 'repaid' && escrow.repaymentDate && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-semibold text-green-900 mb-1">Repayment Completed</p>
                      <p className="text-sm text-green-800">
                        Farmer repaid ${escrow.repaymentAmount} on{' '}
                        {format(new Date(escrow.repaymentDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card className="border border-border">
            <CardContent className="pt-12 text-center pb-12">
              <p className="text-muted-foreground mb-4">No escrows found matching your filters</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-primary hover:underline text-sm"
                >
                  Clear search
                </button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Connected to Stellar network • Auto-refresh enabled
      </div>
    </div>
  )
}
