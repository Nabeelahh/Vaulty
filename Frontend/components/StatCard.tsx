import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: number
  loading?: boolean
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  loading = false,
}: StatCardProps) {
  return (
    <Card className="border border-border hover:border-primary/50 transition-colors">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {Icon && <Icon className="w-4 h-4 text-primary" />}
          </div>

          {loading ? (
            <div className="h-8 bg-gradient-to-r from-muted to-muted/50 rounded animate-pulse" />
          ) : (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {(subtitle || trend !== undefined) && (
                <p className={`text-xs ${trend && trend > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {subtitle}{trend !== undefined && ` (+${trend}%)`}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
