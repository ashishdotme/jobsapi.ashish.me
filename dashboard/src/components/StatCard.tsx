import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardProps = {
  label: string
  value: ReactNode
  tone: 'neutral' | 'good' | 'warn' | 'bad'
}

export const StatCard = ({ label, value, tone }: StatCardProps) => {
  return (
    <Card
      size="sm"
      className={cn(
        'bg-gradient-to-t',
        tone === 'neutral' && 'from-primary/5',
        tone === 'good' && 'from-success/10',
        tone === 'warn' && 'from-warning/10',
        tone === 'bad' && 'from-danger/10',
      )}
    >
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          'text-3xl font-bold tracking-tight',
          tone === 'good' && 'text-success',
          tone === 'warn' && 'text-warning',
          tone === 'bad' && 'text-danger',
        )}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
