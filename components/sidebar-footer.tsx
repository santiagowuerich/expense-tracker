"use client"

import { useUser } from "@/lib/user-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { UserNav } from "@/components/user-nav";

export function SidebarFooter() {
  const { user, isLoading } = useUser();
  
  if (isLoading) {
    return (
      <div className="mt-auto flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="mt-auto flex items-center justify-between p-4">
      <UserNav user={user} />
    </div>
  )
} 