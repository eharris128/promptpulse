'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCost, formatSavings, calculatePlanROI, CLAUDE_PLAN_PRICING } from '@/lib/utils'
import { ClaudePlan } from '@/types'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

interface FixedPlanComparisonProps {
  actualCost: number
  userPlan: ClaudePlan
}

export function FixedPlanComparison({ actualCost, userPlan }: FixedPlanComparisonProps) {
  const userPlanROI = calculatePlanROI(actualCost, userPlan)
  const otherPlans = (Object.keys(CLAUDE_PLAN_PRICING) as ClaudePlan[])
    .filter(plan => plan !== userPlan)
    .map(plan => calculatePlanROI(actualCost, plan))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Fixed Plan Comparison
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Savings compared to your current billing period
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current period total */}
        <div className="text-center pb-4 border-b">
          <div className="text-sm text-muted-foreground mb-1">Current Billing Period Total</div>
          <div className="text-3xl font-bold">{formatCost(actualCost)}</div>
          <div className="text-xs text-muted-foreground">Pay-per-use</div>
        </div>

        {/* User's current plan */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Your Plan: {userPlanROI.planName}</div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <div>
              <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                vs {userPlanROI.planName} {formatCost(userPlanROI.planPrice)}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-300">
                {userPlanROI.isOver ? 'Over' : 'Under'} budget
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${userPlanROI.isOver ? 'text-red-600' : 'text-green-600'}`}>
                {formatSavings(userPlanROI.savings, userPlanROI.isOver)}
              </div>
              <div className={`flex items-center gap-1 text-sm ${userPlanROI.isOver ? 'text-red-600' : 'text-green-600'}`}>
                {userPlanROI.isOver ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {userPlanROI.isOver ? 'Over' : 'Saved'}
              </div>
            </div>
          </div>
        </div>

        {/* Other plans comparison */}
        {otherPlans.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Other Plans</div>
            {otherPlans.map((planROI) => (
              <div key={planROI.planName} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="font-medium">vs {planROI.planName} {formatCost(planROI.planPrice)}</div>
                  <div className="text-sm text-muted-foreground">
                    {planROI.isOver ? 'Over' : 'Under'} budget
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${planROI.isOver ? 'text-red-600' : 'text-green-600'}`}>
                    {formatSavings(planROI.savings, planROI.isOver)}
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${planROI.isOver ? 'text-red-600' : 'text-green-600'}`}>
                    {planROI.isOver ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {planROI.isOver ? 'Over' : 'Saved'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>
            • Compares your actual usage costs against fixed monthly subscription plans
          </p>
          <p>
            • Green indicates savings with pay-per-use, red indicates you'd save money with a fixed plan
          </p>
          <p>
            • Update your plan in Settings to see accurate ROI calculations
          </p>
        </div>
      </CardContent>
    </Card>
  )
}