import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import type { TodosWorkspaceProjectDetailPayload, TodosWorkspaceTask } from '../../types'
import {
  appendSyntheticDoneLane,
  resolveProjectBoardDropAction,
  type ProjectBoardLane,
} from './project-board-dnd'

type ProjectBoardProps = {
  detail: TodosWorkspaceProjectDetailPayload
  disabled?: boolean
  onCreateTask?: (lane: ProjectBoardLane) => void
  onEditTask?: (task: TodosWorkspaceTask) => void
  onMoveTask?: (taskId: string, payload: {
    targetProjectId: string
    targetSourceCategoryId: string
    targetSourceCategory: string
    targetColumnId: 'backlog' | 'in_progress' | 'blocked' | 'done'
  }) => Promise<void>
  onCompleteTask?: (taskId: string, payload?: { completedAt: string }) => Promise<void>
}

type TaskDragData = {
  kind: 'project-board-task'
  task: TodosWorkspaceTask
}

const isTaskDragData = (value: Record<string | symbol, unknown> | null | undefined): value is TaskDragData =>
  value?.kind === 'project-board-task' && typeof value.task === 'object' && value.task !== null

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

const matchesLane = (columnTaskIds: string[], task: TodosWorkspaceTask) => columnTaskIds.includes(task.todoId)

type ProjectBoardTaskCardProps = {
  task: TodosWorkspaceTask
  disabled?: boolean
  isDragging: boolean
  onEditTask?: (task: TodosWorkspaceTask) => void
}

const ProjectBoardTaskCard = ({
  task,
  disabled = false,
  isDragging,
  onEditTask,
}: ProjectBoardTaskCardProps) => {
  const cardRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    const element = cardRef.current

    if (!element || !task.taskId || disabled) {
      return
    }

    return draggable({
      element,
      getInitialData: () => ({
        kind: 'project-board-task',
        task,
      }),
    })
  }, [disabled, task])

  return (
    <li
      ref={cardRef}
      className="rounded-xl border bg-background/90 p-3 shadow-sm transition-opacity"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className={`min-w-0 flex-1 space-y-1 text-left ${
            disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
          }`}
          aria-label={`Drag ${task.title}`}
          disabled={disabled}
        >
          <div className="font-medium leading-tight">{task.title}</div>
          {task.description ? (
            <p className="text-xs text-muted-foreground">{task.description}</p>
          ) : null}
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={`Edit ${task.title}`}
          onClick={() => onEditTask?.(task)}
          disabled={disabled || !task.taskId}
        >
          <Pencil />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant={task.completed ? 'secondary' : 'outline'}>
          {task.completed ? 'Done' : 'Open'}
        </Badge>
        <span>Due {formatTaskDate(task.dueDate)}</span>
      </div>
    </li>
  )
}

type ProjectBoardLaneSectionProps = {
  lane: ProjectBoardLane
  laneTasks: TodosWorkspaceTask[]
  activeTaskId: string | null
  disabled?: boolean
  onCreateTask?: (lane: ProjectBoardLane) => void
  onEditTask?: (task: TodosWorkspaceTask) => void
  onLaneDrop: (task: TodosWorkspaceTask, lane: ProjectBoardLane) => void
}

const ProjectBoardLaneSection = ({
  lane,
  laneTasks,
  activeTaskId,
  disabled = false,
  onCreateTask,
  onEditTask,
  onLaneDrop,
}: ProjectBoardLaneSectionProps) => {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    const element = sectionRef.current

    if (!element || disabled) {
      return
    }

    return dropTargetForElements({
      element,
      getData: () => ({ lane }),
      canDrop: ({ source }) => isTaskDragData(source.data),
      getIsSticky: () => true,
      onDragEnter: () => {
        setIsOver(true)
      },
      onDragLeave: () => {
        setIsOver(false)
      },
      onDrop: ({ source }) => {
        setIsOver(false)
        if (!isTaskDragData(source.data)) {
          return
        }

        onLaneDrop(source.data.task, lane)
      },
    })
  }, [disabled, lane, onLaneDrop])

  return (
    <section
      ref={sectionRef}
      data-lane-id={lane.sourceCategoryId}
      className={`min-h-64 rounded-2xl border bg-muted/20 p-3 transition-colors ${
        isOver ? 'border-primary bg-primary/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="font-heading text-sm font-medium tracking-tight">
            {lane.sourceCategory}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {lane.normalizedColumnId === 'backlog' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Add task to ${lane.sourceCategory}`}
              onClick={() => onCreateTask?.(lane)}
              disabled={disabled}
            >
              <Plus />
            </Button>
          ) : null}
          <Badge variant="secondary">{lane.taskCount}</Badge>
        </div>
      </div>

      {laneTasks.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {laneTasks.map(task => (
            <ProjectBoardTaskCard
              key={task.id}
              task={task}
              disabled={disabled}
              isDragging={task.id === activeTaskId}
              onEditTask={onEditTask}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No tasks in this lane.</p>
      )}
    </section>
  )
}

export const ProjectBoard = ({
  detail,
  disabled = false,
  onCreateTask,
  onEditTask,
  onMoveTask,
  onCompleteTask,
}: ProjectBoardProps) => {
  const visibleColumns = useMemo(
    () => appendSyntheticDoneLane(detail.project.id, detail.projectBoard.columns),
    [detail.project.id, detail.projectBoard.columns],
  )
  const hasLanes = visibleColumns.length > 0
  const openTasks = useMemo(
    () => detail.tasks.filter(task => !task.completed),
    [detail.tasks],
  )
  const [actionError, setActionError] = useState('')
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const projectBoardGridStyle = {
    '--kanban-columns': String(visibleColumns.length),
  } as CSSProperties

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) =>
        !disabled &&
        isTaskDragData(source.data) &&
        source.data.task.projectId === detail.project.id,
      onDragStart: ({ source }) => {
        if (!isTaskDragData(source.data)) {
          return
        }

        setActionError('')
        setActiveTaskId(source.data.task.id)
      },
      onDrop: () => {
        setActiveTaskId(null)
      },
    })
  }, [detail.project.id, disabled])

  const handleLaneDrop = async (task: TodosWorkspaceTask, lane: ProjectBoardLane) => {
    if (disabled) {
      return
    }

    const action = resolveProjectBoardDropAction(task, lane)

    if (action.type === 'noop') {
      return
    }

    setActionError('')

    try {
      if (action.type === 'move' && onMoveTask) {
        await onMoveTask(action.payload.taskId, action.payload)
      }

      if (action.type === 'complete' && onCompleteTask) {
        await onCompleteTask(action.payload.taskId, {
          completedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update the task lane')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <h3 className="font-heading text-lg font-semibold tracking-tight">{detail.project.name}</h3>
          <CardDescription>{detail.project.openTaskCount} open</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {actionError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        {hasLanes ? (
          <div
            data-testid="project-board-grid"
            className="grid gap-4 md:[grid-template-columns:repeat(var(--kanban-columns),minmax(0,1fr))]"
            style={projectBoardGridStyle}
          >
            {visibleColumns.map(column => {
              const laneTasks =
                column.normalizedColumnId === 'done'
                  ? []
                  : openTasks.filter(task => matchesLane(column.taskIds, task))

              return (
                <ProjectBoardLaneSection
                  key={column.sourceCategoryId}
                  lane={column}
                  laneTasks={laneTasks}
                  activeTaskId={activeTaskId}
                  disabled={disabled}
                  onCreateTask={onCreateTask}
                  onEditTask={onEditTask}
                  onLaneDrop={handleLaneDrop}
                />
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
            No tasks yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
