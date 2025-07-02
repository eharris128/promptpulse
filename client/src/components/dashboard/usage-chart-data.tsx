"use client";

import { use } from "react";
import { UsageChart } from "./usage-chart";

interface UsageChartDataProps {
  usageDataPromise: Promise<any>
  type: "cost" | "tokens"
}

export function UsageChartData({ usageDataPromise, type }: UsageChartDataProps) {
  const usageData = use(usageDataPromise);
  return <UsageChart data={usageData} type={type} />;
}
