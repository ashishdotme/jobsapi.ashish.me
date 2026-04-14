import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getStatusTone } from '@/lib/jobs'

export const StatusPill = ({ status }: { status: string }) => {
  const tone = getStatusTone(status as never)

  return (
    <Badge
      className={cn(
        'capitalize',
        tone === 'success' && 'bg-success/15 text-success hover:bg-success/20',
        tone === 'info' && 'bg-primary/15 text-primary hover:bg-primary/20',
        tone === 'warn' && 'bg-warning/15 text-warning hover:bg-warning/20',
        tone === 'danger' && 'bg-danger/15 text-danger hover:bg-danger/20',
        tone === 'default' && 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </Badge>
  )
}
