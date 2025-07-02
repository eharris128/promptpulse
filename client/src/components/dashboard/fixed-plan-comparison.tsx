"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCost, formatSavings, calculatePlanROI, CLAUDE_PLAN_PRICING } from "@/lib/utils";
import { ClaudePlan } from "@/types";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface FixedPlanComparisonProps {
  actualCost: number
  userPlan: ClaudePlan
}

export function FixedPlanComparison({ actualCost, userPlan }: FixedPlanComparisonProps) {
  // Don't show the component if there's no actual usage/cost
  if (!actualCost || actualCost === 0) {
    return null;
  }

  const userPlanROI = calculatePlanROI(actualCost, userPlan);
  const otherPlans = (Object.keys(CLAUDE_PLAN_PRICING) as ClaudePlan[])
    .filter(plan => plan !== userPlan)
    .map(plan => calculatePlanROI(actualCost, plan));

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Fixed Plan Comparison
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Savings compared to your current billing period
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current period and plan comparisons in horizontal layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Current period total */}
          <div className="text-center p-4 rounded-lg border bg-muted/50">
            <div className="text-sm text-muted-foreground mb-1">Current Billing Period Total</div>
            <div className="text-2xl font-bold">{formatCost(actualCost)}</div>
            <div className="text-xs text-muted-foreground">Pay-per-use</div>
          </div>

          {/* User's current plan */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              vs {userPlanROI.planName} {formatCost(userPlanROI.planPrice)}
            </div>
            <div className={`text-xl font-bold ${userPlanROI.isOver ? "text-green-600" : "text-yellow-600"}`}>
              {formatSavings(userPlanROI.savings, userPlanROI.isOver)}
            </div>
            <div className={`flex items-center gap-1 text-sm ${userPlanROI.isOver ? "text-green-600" : "text-yellow-600"}`}>
              {userPlanROI.isOver ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {userPlanROI.isOver ? "Great value!" : "Light usage"}
            </div>
          </div>

          {/* Other plans comparison */}
          {otherPlans.map((planROI) => (
            <div key={planROI.planName} className="p-4 rounded-lg border">
              <div className="text-sm font-medium mb-2">
                vs {planROI.planName} {formatCost(planROI.planPrice)}
              </div>
              <div className={`text-xl font-bold ${planROI.isOver ? "text-green-600" : "text-yellow-600"}`}>
                {formatSavings(planROI.savings, planROI.isOver)}
              </div>
              <div className={`flex items-center gap-1 text-sm ${planROI.isOver ? "text-green-600" : "text-yellow-600"}`}>
                {planROI.isOver ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {planROI.isOver ? "Great value!" : "Light usage"}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>
            • Shows what your usage would cost if paying per-use, compared to your fixed monthly plan cost
          </p>
          <p>
            • <span className="text-green-600 font-medium">Green</span>: Great value from your plan (usage worth more than plan cost) • <span className="text-yellow-600 font-medium">Yellow</span>: Light usage (room to use more)
          </p>
          <p>
            • Update your plan in Settings to see accurate calculations
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
