import { Check } from 'lucide-react'

interface Step {
  label: string
  description?: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="space-y-8">
      {/* Progress bar */}
      <div className="relative pt-2">
        <div className="absolute top-5 left-0 right-0 h-1 bg-border"></div>
        <div
          className="absolute top-5 left-0 h-1 bg-primary transition-all"
          style={{ width: `${((currentStep) / (steps.length - 1)) * 100}%` }}
        ></div>
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isComplete = index < currentStep
            const isCurrent = index === currentStep
            return (
              <div key={index} className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    isComplete
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                <div className="text-center">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground hidden sm:block">{step.description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
