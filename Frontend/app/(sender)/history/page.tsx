'use client'

import { useEffect, useState, useMemo } from 'react'
import { fetchEscrows, Escrow, mockFarmers, mockVendors } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Download, Eye, MapPin, TrendingUp } from 'lucide-react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { EscrowTimeline } from '@/components/EscrowTimeline'

export default function HistoryPage() {
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [filteredEscrows, setFilteredEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount-high' | 'amount-low'>('newest')
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null)

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
  }, [])

  // Filter and sort escrows
  const processed = useMemo(() => {
    let result = [...escrows]

    // Filter by search
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

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter)
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'amount-high':
          return parseFloat(b.amount) - parseFloat(a.amount)
        case 'amount-low':
          return parseFloat(a.amount) - parseFloat(b.amount)
        default:
          return 0
      }
    })

    return result
  }, [escrows, searchQuery, statusFilter, sortBy])

  const stats = useMemo(() => {
    const total = escrows.length
    const totalFunded = escrows.reduce((sum, e) => sum + parseFloat(e.amount), 0)
    const totalRepaid = escrows
      .filter((e) => e.status === 'repaid')
      .reduce((sum, e) => sum + parseFloat(e.repaymentAmount || e.amount), 0)
    const activeCount = escrows.filter((e) => e.status !== 'repaid').length

    return { total, totalFunded, totalRepaid, activeCount }
  }, [escrows])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'funded':
        return 'bg-blue-100 text-blue-800'
      case 'voucher_minted':
        return 'bg-purple-100 text-purple-800'
      case 'redeemed':
        return 'bg-yellow-100 text-yellow-800'
      case 'repaying':
        return 'bg-green-100 text-green-800'
      case 'repaid':
        return 'bg-emerald-100 text-emerald-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const handleDownloadReceipt = (escrow: Escrow) => {
    const farmer = mockFarmers.find((f) => f.id === escrow.farmerId)
    const vendor = mockVendors.find((v) => v.id === escrow.vendorId)
    
    const receipt = `
RemitRoot Funding Receipt
========================

Escrow ID: ${escrow.id}
Created: ${format(parseISO(escrow.createdAt), 'PPpp')}
Status: ${formatStatus(escrow.status)}

FUNDING DETAILS
Farmer: ${farmer?.name}
Location: ${farmer?.location}
Vendor: ${vendor?.name}
Crop: ${escrow.crop}

AMOUNT
Funded: $${escrow.amount}
Repayment: $${escrow.repaymentAmount}

TIMELINE
Created: ${format(parseISO(escrow.createdAt), 'PPp')}
Updated: ${format(parseISO(escrow.updatedAt), 'PPp')}
${escrow.repaymentDate ? `Repaid: ${format(parseISO(escrow.repaymentDate), 'PPp')}` : ''}

This receipt confirms your funding through RemitRoot.
For support, visit support.remitroot.com
    `.trim()

    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(receipt))
    element.setAttribute('download', `remitroot-receipt-${escrow.id}.txt`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Transaction History</h1>
        <p className="text-muted-foreground">View all your past and completed fundings</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Total Transactions</p>
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Total Funded</p>
            <p className="text-3xl font-bold text-primary">${stats.totalFunded}</p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Total Repaid</p>
            <p className="text-3xl font-bold text-green-600">${stats.totalRepaid}</p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Active</p>
            <p className="text-3xl font-bold text-foreground">{stats.activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search by farmer, vendor, or crop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
                <SelectItem value="voucher_minted">Voucher Minted</SelectItem>
                <SelectItem value="redeemed">Redeemed</SelectItem>
                <SelectItem value="repaying">Repaying</SelectItem>
                <SelectItem value="repaid">Repaid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="amount-high">Highest Amount</SelectItem>
                <SelectItem value="amount-low">Lowest Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Farmer & Location</TableHead>
                <TableHead>Crop</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : processed.length > 0 ? (
                processed.map((escrow) => {
                  const farmer = mockFarmers.find((f) => f.id === escrow.farmerId)
                  return (
                    <TableRow
                      key={escrow.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{farmer?.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {farmer?.location}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{escrow.crop}</TableCell>
                      <TableCell>
                        <p className="font-semibold text-foreground">${escrow.amount}</p>
                        <p className="text-xs text-muted-foreground">
                          Repay: ${escrow.repaymentAmount}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(escrow.status)}>
                          {formatStatus(escrow.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm text-foreground">
                            {format(parseISO(escrow.createdAt), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(parseISO(escrow.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedEscrow(escrow)}
                                className="gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Escrow Details</DialogTitle>
                                <DialogDescription>
                                  ID: {selectedEscrow?.id}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedEscrow && (
                                <div className="space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Farmer</p>
                                      <p className="font-semibold text-foreground">
                                        {mockFarmers.find((f) => f.id === selectedEscrow.farmerId)?.name}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Vendor</p>
                                      <p className="font-semibold text-foreground">
                                        {mockVendors.find((v) => v.id === selectedEscrow.vendorId)?.name}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Crop</p>
                                      <p className="font-semibold text-foreground">{selectedEscrow.crop}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Funded Amount</p>
                                      <p className="font-semibold text-primary">${selectedEscrow.amount}</p>
                                    </div>
                                  </div>
                                  <EscrowTimeline currentStatus={selectedEscrow.status} />
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadReceipt(escrow)}
                            className="gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Receipt</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <p className="text-muted-foreground">No transactions found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Export Info */}
      <Card className="border border-border bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            You can download individual receipts for each transaction. All data is secured on Stellar blockchain.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
