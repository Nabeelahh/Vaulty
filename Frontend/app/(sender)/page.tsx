'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { fetchDashboardStats, fetchEscrows, DashboardStats, Escrow, mockFarmers, mockVendors } from '@/lib/api'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { TrendingUp, ArrowRight, Zap, Activity } from 'lucide-react'
import { formatBalance } from '@/lib/stellar'
import { formatDistanceToNow, format } from 'date-fns'

export default function DashboardPage() {
  const { balance } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, escrowsData] = await Promise.all([
          fetchDashboardStats(),
          fetchEscrows(),
        ])
        setStats(statsData)
        setEscrows(escrowsData)
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

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

  const getStatusLabel = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const recentEscrows = escrows.slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 rounded-lg border border-border p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Welcome back!</h1>
            <p className="text-muted-foreground">
              You&apos;re making a real difference in African agriculture. Track your impact below.
            </p>
          </div>
          <Link href="/sender/fund">
            <Button size="lg" className="gap-2">
              <Zap className="w-4 h-4" />
              Fund a Farmer
            </Button>
          </Link>
        </div>
      </div>

      {/* Balance Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle>Your USDC Balance</CardTitle>
          <CardDescription>Connected wallet balance on Stellar Testnet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-bold text-primary">${balance}</div>
          <p className="text-sm text-muted-foreground mt-2">Ready to deploy for impact</p>
        </CardContent>
      </Card>

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Funded"
          value={stats ? `$${stats.totalFunded}` : '—'}
          subtitle="Across all farmers"
          loading={loading}
          icon={TrendingUp}
        />
        <StatCard
          title="Active Escrows"
          value={stats ? stats.activeEscrows : '—'}
          subtitle="In progress"
          loading={loading}
          icon={Activity}
        />
        <StatCard
          title="Total Repaid"
          value={stats ? `$${stats.totalRepaid}` : '—'}
          subtitle="Repayment received"
          loading={loading}
          trend={stats?.averageROI}
        />
        <StatCard
          title="Avg. Return"
          value={stats ? `${stats.averageROI}%` : '—'}
          subtitle="Per funding round"
          loading={loading}
        />
      </div>

      {/* Recent Activity */}
      <Card className="border border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest funding rounds and escrow updates</CardDescription>
          </div>
          <Link href="/sender/history">
            <Button variant="outline" size="sm" className="gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gradient-to-r from-muted to-muted/50 rounded animate-pulse" />
              ))}
            </div>
          ) : recentEscrows.length > 0 ? (
            <div className="space-y-3">
              {recentEscrows.map((escrow) => {
                const farmer = mockFarmers.find((f) => f.id === escrow.farmerId)
                const vendor = mockVendors.find((v) => v.id === escrow.vendorId)

                return (
                  <div
                    key={escrow.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {farmer?.name} • {escrow.crop}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {vendor?.name} • {formatDistanceToNow(new Date(escrow.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">${escrow.amount}</p>
                        <p className="text-xs text-muted-foreground">
                          Repay: ${escrow.repaymentAmount}
                        </p>
                      </div>
                      <Badge className={getStatusColor(escrow.status)}>
                        {getStatusLabel(escrow.status)}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No funding rounds yet</p>
              <Link href="/sender/fund">
                <Button variant="outline">Create your first funding</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Browse Farmers',
            description: 'Explore verified farmers and their profiles',
            href: '/sender/fund',
          },
          {
            title: 'Track Active Funds',
            description: 'Monitor your active funding rounds in real-time',
            href: '/sender/track',
          },
          {
            title: 'Transaction History',
            description: 'View all past and completed escrows',
            href: '/sender/history',
          },
        ].map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="h-full border border-border hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer">
              <CardContent className="pt-6 text-center">
                <h3 className="font-semibold text-foreground mb-2">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
