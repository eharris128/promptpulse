"use client";

import { use } from "react";
import { StatsCards } from "./stats-cards";
import { apiClient } from "@/lib/api";

interface StatsCardsDataProps {
  usageDataPromise: Promise<any>
}

export function StatsCardsData({ usageDataPromise }: StatsCardsDataProps) {
  const usageData = use(usageDataPromise);
  return <StatsCards data={usageData} />;
}
