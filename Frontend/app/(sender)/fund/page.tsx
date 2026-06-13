'use client'

import { useState, useMemo } from 'react'
import { StepIndicator } from '@/components/StepIndicator'
import { FarmerSelector } from '@/components/FarmerSelector'
import { VendorSelector } from '@/components/VendorSelector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Farmer, Vendor, createEscrow, mockFarmers, mockVendors } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const STEPS = [
  { label: 'Select Farmer', description: 'Choose a farmer to support' },
  { label: 'Choose Vendor', description: 'Pick approved vendor' },
  { label: 'Set Amount', description: 'Enter funding amount' },
  { label: 'Review', description: 'Confirm details' },
  { label: 'Complete', description: 'Submit & fund' },
]

export default function FundPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [amount, setAmount] = useState('')
  const [crop, setCrop] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  const availableCrops = useMemo(() => {
    if (!selectedFarmer) return []
    return selectedFarmer.crops
  }, [selectedFarmer])

  const projectedReturn = useMemo(() => {
    if (!amount || isNaN(parseFloat(amount))) return 0
    return parseFloat(amount) * 0.2 // 20% return
  }, [amount])

  const handleSelectFarmer = (farmer: Farmer) => {
    setSelectedFarmer(farmer)
    setCrop('') // Reset crop selection
  }

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor)
  }

  const canProceedStep = () => {
    switch (step) {
      case 0:
        return !!selectedFarmer
      case 1:
        return !!selectedVendor
      case 2:
        return !!amount && parseFloat(amount) > 0 && !!crop
      case 3:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (canProceedStep() && step < STEPS.length - 1) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (!selectedFarmer || !selectedVendor || !amount || !crop) {
      setError('Please complete all fields')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      const escrow = await createEscrow({
        farmerId: selectedFarmer.id,
        vendorId: selectedVendor.id,
        amount,
        crop,
      })
      setSuccessId(escrow.id)
      setStep(step + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create escrow')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/sender" className="flex items-center gap-1 text-primary hover:text-primary/80 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-foreground mb-2">Fund a Farmer</h1>
        <p className="text-muted-foreground">Start a new funding round to support African agriculture</p>
      </div>

      {/* Steps Indicator */}
      <StepIndicator steps={STEPS} currentStep={step} />

      {/* Step Content */}
      <Card className="border border-border mt-8">
        <CardContent className="pt-8">
          {/* Step 1: Select Farmer */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Select a Farmer</h2>
                <p className="text-muted-foreground mb-6">
                  Choose a verified farmer you&apos;d like to support. Click to select.
                </p>
              </div>
              <FarmerSelector onSelect={handleSelectFarmer} selected={selectedFarmer?.id} />
            </div>
          )}

          {/* Step 2: Choose Vendor */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Choose a Vendor</h2>
                <p className="text-muted-foreground mb-6">
                  Select where {selectedFarmer?.name} will purchase inputs from.
                </p>
              </div>
              <VendorSelector onSelect={handleSelectVendor} selected={selectedVendor?.id} />
            </div>
          )}

          {/* Step 3: Set Amount */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Funding Details</h2>
                <p className="text-muted-foreground mb-6">Enter the amount and select the crop.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="crop" className="text-base">
                    Crop Type
                  </Label>
                  <Select value={crop} onValueChange={setCrop}>
                    <SelectTrigger id="crop">
                      <SelectValue placeholder="Select a crop..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCrops.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount" className="text-base">
                    Funding Amount (USDC)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="100"
                    step="50"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Minimum $100</p>
                </div>

                {amount && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                    <p className="text-sm text-muted-foreground">Projected outcomes:</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-foreground">${amount}</p>
                        <p className="text-xs text-muted-foreground">Initial funding</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">${projectedReturn.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Projected return (20%)</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Review Your Funding</h2>
                <p className="text-muted-foreground mb-6">Please confirm all details before submitting.</p>
              </div>

              <div className="space-y-4">
                <Card className="bg-muted/30 border-0">
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Farmer</p>
                      <p className="font-semibold text-foreground">{selectedFarmer?.name}</p>
                      <Badge variant="secondary" className="gap-1">
                        {selectedFarmer?.location}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30 border-0">
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Vendor</p>
                      <p className="font-semibold text-foreground">{selectedVendor?.name}</p>
                      <Badge variant="secondary" className="gap-1">
                        {selectedVendor?.location}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30 border-0">
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Crop</p>
                        <p className="font-semibold text-foreground">{crop}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-semibold text-primary text-lg">${amount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900">
                    Your USDC will be held in a smart escrow contract on Stellar until the farmer repays the funding.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 4 && (
            <div className="space-y-6 text-center py-8">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Funding Created!</h2>
                <p className="text-muted-foreground">
                  Your escrow is now active on Stellar blockchain.
                </p>
                {successId && (
                  <p className="text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded mt-2">
                    ID: {successId}
                  </p>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The farmer and vendor will now receive notifications about this funding.
                </p>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm font-semibold text-foreground mb-2">What happens next?</p>
                  <ul className="text-sm text-muted-foreground space-y-1 text-left">
                    <li>✓ Vendor mints a voucher for the farmer</li>
                    <li>✓ Farmer redeems inputs with the vendor</li>
                    <li>✓ You track progress in real-time</li>
                    <li>✓ Farmer repays the escrow</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-4 mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0 || step === 4}
          className="flex-1"
        >
          Back
        </Button>
        {step < 4 ? (
          <>
            {step === 3 ? (
              <Button
                onClick={handleSubmit}
                disabled={!canProceedStep() || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Creating...' : 'Create Funding'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceedStep()}
                className="flex-1"
              >
                Next Step
              </Button>
            )}
          </>
        ) : (
          <Button
            onClick={() => router.push('/sender/track')}
            className="flex-1"
          >
            View Active Fundings
          </Button>
        )}
      </div>
    </div>
  )
}
