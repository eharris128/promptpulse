import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function LeaderboardCardSkeleton() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Ranking items */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
          
          {/* Button */}
          <Skeleton className="h-10 w-full mt-4" />
        </div>
      </CardContent>
    </Card>
  )
}