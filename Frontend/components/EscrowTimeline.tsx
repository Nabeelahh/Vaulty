import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Circle, TrendingUp } from 'lucide-react'

interface TimelineStep {
  status: string
  label: string
  description: string
  timestamp?: string
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    status: 'funded',
    label: 'Funded',
    description: 'USDC deposited in escrow',
  },
  {
    status: 'voucher_minted',
    label: 'Voucher Minted',
    description: 'Digital voucher created',
  },
  {
    status: 'redeemed',
    label: 'Redeemed',
    description: 'Farmer received inputs',
  },
  {
    status: 'repaying',
    label: 'Repaying',
    description: 'Harvest collected & selling',
  },
  {
    status: 'repaid',
    label: 'Repaid',
    description: 'Full repayment received',
  },
]

interface EscrowTimelineProps {
  currentStatus: string
  completedAt?: Record<string, string>
}

export function EscrowTimeline({ currentStatus, completedAt = {} }: EscrowTimelineProps) {
  const currentIndex = TIMELINE_STEPS.findIndex((s) => s.status === currentStatus)

  return (
    <Card className="border border-border p-6">
      <div className="space-y-6">
        {TIMELINE_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isPending = index > currentIndex

          return (
            <div key={step.status} className="flex gap-4">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-green-100 text-green-700'
                      : isCurrent
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                {index < TIMELINE_STEPS.length - 1 && (
                  <div
                    className={`w-1 h-12 ${isCompleted ? 'bg-green-200' : 'bg-border'}`}
                  ></div>
                )}
              </div>

              {/* Timeline content */}
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className={`font-semibold ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </h4>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  <div className="text-right">
                    {isCurrent && (
                      <Badge className="gap-1 bg-primary/10 text-primary">
                        <TrendingUp className="w-3 h-3" />
                        In Progress
                      </Badge>
                    )}
                    {isCompleted && (
                      <Badge className="bg-green-100 text-green-800">Completed</Badge>
                    )}
                    {isPending && (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </div>
                </div>
                {completedAt[step.status] && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Completed on {new Date(completedAt[step.status]).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
