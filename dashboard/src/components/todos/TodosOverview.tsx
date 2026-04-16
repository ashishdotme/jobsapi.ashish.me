import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { StatCard } from '@/components/StatCard'
import type {
  TodosWorkspaceNormalizedBoardColumnId,
  TodosWorkspaceOverviewPayload,
  TodosWorkspaceProjectSummary,
  TodosWorkspaceTask,
} from '../../types'

type TodosOverviewProps = {
  overview: TodosWorkspaceOverviewPayload
  boardOnly?: boolean
  onMoveTask?: (task: TodosWorkspaceTask, targetColumnId: TodosWorkspaceNormalizedBoardColumnId) => Promise<void>
  showProjectSummary?: boolean
  showOverdue?: boolean
  showDueSoon?: boolean
}

type NormalizedBoardTaskDragData = {
  kind: 'normalized-board-task'
  task: TodosWorkspaceTask
}

const isNormalizedBoardTaskDragData = (
  value: Record<string | symbol, unknown> | null | undefined,
): value is NormalizedBoardTaskDragData =>
  value?.kind === 'normalized-board-task' && typeof value.task === 'object' && value.task !== null

const formatDateTime = (value: string) => {
  if (!value?.trim()) {
    return 'Unknown'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown'
  }

  const normalized = parsed.toISOString()
  return `${normalized.slice(0, 10)} ${normalized.slice(11, 16)} UTC`
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

const renderProjectCard = (project: TodosWorkspaceProjectSummary) => {
  return (
    <Card key={project.id} size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h4 className="font-heading text-base font-medium">{project.name}</h4>
            <CardDescription>{project.sourceProjectId}</CardDescription>
          </div>
          <Badge variant="secondary">{project.taskCount} tasks</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Open</div>
            <div className="mt-1 font-semibold">{project.openTaskCount}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Overdue</div>
            <div className="mt-1 font-semibold">{project.overdueTaskCount}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Due soon</div>
            <div className="mt-1 font-semibold">{project.dueSoonTaskCount}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Updated {formatDateTime(project.updatedAt)}</p>
      </CardContent>
    </Card>
  )
}

type NormalizedTaskCardProps = {
  task: TodosWorkspaceTask
  isDragging: boolean
}

const NormalizedTaskCard = ({ task, isDragging }: NormalizedTaskCardProps) => {
  const cardRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    const element = cardRef.current

    if (!element || !task.taskId) {
      return
    }

    return draggable({
      element,
      getInitialData: () => ({
        kind: 'normalized-board-task',
        task,
      }),
    })
  }, [task])

  return (
    <li
      ref={cardRef}
      className="rounded-xl border bg-background/90 p-3 shadow-sm transition-opacity"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div
        className="cursor-grab space-y-1 text-left active:cursor-grabbing"
        aria-label={`Drag ${task.title}`}
      >
        <div className="font-medium leading-tight">{task.title}</div>
        {task.description ? (
          <p className="text-xs text-muted-foreground">{task.description}</p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="secondary">{task.projectName}</Badge>
        <Badge variant="outline">{task.sourceCategory}</Badge>
        <span>Due {formatTaskDate(task.dueDate)}</span>
        {task.completedAt ? <span>Completed {formatTaskDate(task.completedAt)}</span> : null}
      </div>
    </li>
  )
}

type NormalizedBoardLaneSectionProps = {
  column: TodosWorkspaceOverviewPayload['normalizedBoard']['columns'][number]
  activeTaskId: string | null
  onLaneDrop?: (
    task: TodosWorkspaceTask,
    targetColumnId: TodosWorkspaceNormalizedBoardColumnId,
  ) => Promise<void>
}

const NormalizedBoardLaneSection = ({
  column,
  activeTaskId,
  onLaneDrop,
}: NormalizedBoardLaneSectionProps) => {
  const laneTasks = column.id === 'done' ? [] : (column.tasks ?? [])
  const sectionRef = useRef<HTMLElement | null>(null)
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    const element = sectionRef.current

    if (!element) {
      return
    }

    return dropTargetForElements({
      element,
      getData: () => ({ columnId: column.id }),
      canDrop: ({ source }) => Boolean(onLaneDrop) && isNormalizedBoardTaskDragData(source.data),
      getIsSticky: () => true,
      onDragEnter: () => {
        setIsOver(true)
      },
      onDragLeave: () => {
        setIsOver(false)
      },
      onDrop: async ({ source }) => {
        setIsOver(false)
        if (!onLaneDrop || !isNormalizedBoardTaskDragData(source.data)) {
          return
        }

        await onLaneDrop(source.data.task, column.id)
      },
    })
  }, [column.id, onLaneDrop])

  return (
    <section
      ref={sectionRef}
      data-lane-id={column.id}
      className={`rounded-2xl border bg-muted/20 p-3 transition-colors ${
        isOver ? 'border-primary bg-primary/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="font-heading text-sm font-medium">{column.label}</h4>
        </div>
        <Badge variant="outline">{column.taskCount}</Badge>
      </div>

      {laneTasks.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {laneTasks.map(task => (
            <NormalizedTaskCard
              key={task.id}
              task={task}
              isDragging={task.id === activeTaskId}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No tasks in this lane yet.</p>
      )}
    </section>
  )
}

const renderTaskList = (tasks: TodosWorkspaceTask[], emptyCopy: string) => {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyCopy}</p>
  }

  return (
    <ul className="space-y-3">
      {tasks.map(task => (
        <li key={task.id} className="rounded-xl border bg-background/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium leading-none">{task.title}</div>
              {task.description ? (
                <p className="text-sm text-muted-foreground">{task.description}</p>
              ) : null}
            </div>
            <Badge variant={task.columnId === 'blocked' ? 'destructive' : 'outline'}>
              {task.columnId.replace('_', ' ')}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{task.projectName}</Badge>
            <Badge variant="outline">{task.sourceCategory}</Badge>
            <span>Due {formatTaskDate(task.dueDate)}</span>
            {task.completedAt ? <span>Completed {formatTaskDate(task.completedAt)}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export const TodosOverview = ({
  overview,
  boardOnly = false,
  onMoveTask,
  showProjectSummary = true,
  showOverdue = true,
  showDueSoon = true,
}: TodosOverviewProps) => {
  const projectCount = overview.projects.length
  const totalTaskCount = overview.normalizedBoard.totalTaskCount
  const overdueCount = overview.overdueTasks.length
  const dueSoonCount = overview.dueSoonTasks.length
  const visibleNormalizedColumns = overview.normalizedBoard.columns
  const normalizedBoardGridStyle = {
    '--kanban-columns': String(visibleNormalizedColumns.length),
  } as CSSProperties
  const [actionError, setActionError] = useState('')
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => isNormalizedBoardTaskDragData(source.data),
      onDragStart: ({ source }) => {
        if (!isNormalizedBoardTaskDragData(source.data)) {
          return
        }

        setActionError('')
        setActiveTaskId(source.data.task.id)
      },
      onDrop: () => {
        setActiveTaskId(null)
      },
    })
  }, [])

  const handleLaneDrop = async (
    task: TodosWorkspaceTask,
    targetColumnId: TodosWorkspaceNormalizedBoardColumnId,
  ) => {
    if (!onMoveTask || task.columnId === targetColumnId) {
      return
    }

    setActionError('')

    try {
      await onMoveTask(task, targetColumnId)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update the task lane')
    }
  }

  const normalizedBoardCard = (
    <Card>
      <CardHeader>
        <h3 className="font-heading text-sm font-medium">Normalized board</h3>
        <CardDescription>Shared task totals across the dashboard workflow columns.</CardDescription>
      </CardHeader>
      <CardContent>
        {actionError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
        {visibleNormalizedColumns.length > 0 ? (
          <div
            data-testid="normalized-board-grid"
            className="grid gap-3 md:[grid-template-columns:repeat(var(--kanban-columns),minmax(0,1fr))]"
            style={normalizedBoardGridStyle}
          >
            {visibleNormalizedColumns.map(column => (
              <NormalizedBoardLaneSection
                key={column.id}
                column={column}
                activeTaskId={activeTaskId}
                onLaneDrop={onMoveTask ? handleLaneDrop : undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No board data available yet.</p>
        )}
      </CardContent>
    </Card>
  )

  if (boardOnly) {
    return normalizedBoardCard
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects" value={projectCount} tone="neutral" />
        <StatCard label="Board tasks" value={totalTaskCount} tone="neutral" />
        <StatCard label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'bad' : 'good'} />
        <StatCard label="Due soon" value={dueSoonCount} tone={dueSoonCount > 0 ? 'warn' : 'good'} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>{projectCount} projects discovered</span>
        <span>{totalTaskCount} tasks in the normalized board</span>
      </div>

      {showProjectSummary ? (
        <Card>
          <CardHeader>
            <h3 className="font-heading text-sm font-medium">Project summary</h3>
            <CardDescription>
              Dynamically discovered TickTick projects with workload and attention counts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.projects.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {overview.projects.map(renderProjectCard)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No projects discovered yet.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {normalizedBoardCard}

      {showOverdue || showDueSoon ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {showOverdue ? (
            <Card>
              <CardHeader>
                <h3 className="font-heading text-sm font-medium">Overdue</h3>
                <CardDescription>Tasks that have already crossed their due date.</CardDescription>
              </CardHeader>
              <CardContent>{renderTaskList(overview.overdueTasks, 'No overdue tasks right now.')}</CardContent>
            </Card>
          ) : null}

          {showDueSoon ? (
            <Card>
              <CardHeader>
                <h3 className="font-heading text-sm font-medium">Due soon</h3>
                <CardDescription>Tasks due in the next 7 days.</CardDescription>
              </CardHeader>
              <CardContent>{renderTaskList(overview.dueSoonTasks, 'No tasks due in the next 7 days.')}</CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">Last refreshed {formatDateTime(overview.generatedAt)}</p>
    </div>
  )
}
