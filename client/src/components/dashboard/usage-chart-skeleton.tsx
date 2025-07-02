import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function UsageChartSkeleton() {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full flex items-end justify-between px-4 pb-4">
          {/* Simulate chart bars with varying heights */}
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center space-y-2">
              <Skeleton
                className="w-8 rounded-sm"
                style={{ height: `${Math.random() * 200 + 50}px` }}
              />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
