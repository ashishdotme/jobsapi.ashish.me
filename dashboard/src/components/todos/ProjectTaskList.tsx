import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { TodosWorkspaceProjectDetailPayload, TodosWorkspaceTask } from '../../types'

type ProjectTaskListProps = {
  detail: TodosWorkspaceProjectDetailPayload
  disabled?: boolean
  completedTasks?: TodosWorkspaceTask[]
  completedTasksLoading?: boolean
  completedTasksVisible?: boolean
  completedTasksError?: string
  onLoadCompletedTasks?: () => void
  onToggleCompletedTasks?: () => void
}

const formatTaskDate = (value: string | null) => {
  if (!value?.trim()) {
    return 'No date'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown'
  }

  return parsed.toISOString().slice(0, 10)
}

export const ProjectTaskList = ({
  detail,
  disabled = false,
  completedTasks,
  completedTasksLoading = false,
  completedTasksVisible,
  completedTasksError = '',
  onLoadCompletedTasks,
  onToggleCompletedTasks,
}: ProjectTaskListProps) => {
  const fallbackCompletedTasks = useMemo(
    () => detail.tasks.filter(task => task.completed),
    [detail.tasks],
  )
  const tasks = completedTasks ?? fallbackCompletedTasks
  const hasLazyControls = Boolean(onLoadCompletedTasks)
  const isVisible = hasLazyControls ? Boolean(completedTasksVisible) : true
  const hasLoadedCompletedTasks = completedTasks !== undefined
  const hasTasks = tasks.length > 0
  const isCollapsed = hasLazyControls && !isVisible
  const actionLabel = completedTasksLoading
    ? 'Loading...'
    : isVisible
      ? 'Hide completed tasks'
      : hasLoadedCompletedTasks
        ? 'Show completed tasks'
        : 'Load completed tasks'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-heading text-sm font-medium">Completed tasks</h3>
        </div>
        {hasLazyControls ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleCompletedTasks ?? onLoadCompletedTasks}
            disabled={disabled || completedTasksLoading}
          >
            {actionLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {completedTasksError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{completedTasksError}</AlertDescription>
          </Alert>
        ) : null}

        {completedTasksLoading ? (
          <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
            Loading completed tasks...
          </div>
        ) : isCollapsed ? (
          <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
            Load completed tasks to view history.
          </div>
        ) : hasTasks ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Lane</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium leading-tight text-foreground">{task.title}</div>
                      {task.description ? (
                        <p className="text-[11px] text-muted-foreground">{task.description}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.sourceCategory}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatTaskDate(task.completedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
            No completed tasks yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
