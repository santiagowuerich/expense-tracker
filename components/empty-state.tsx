import type React from "react"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard } from "lucide-react"

interface EmptyStateProps {
  title: string
  description: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Card className="w-full text-center">
      <CardHeader>
        <div className="flex justify-center mb-4">
          {icon || <CreditCard className="h-12 w-12 text-muted-foreground" />}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action && <CardFooter className="flex justify-center">{action}</CardFooter>}
    </Card>
  )
}
