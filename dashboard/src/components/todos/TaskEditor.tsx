import { useEffect, useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  TodosWorkspaceCreateTaskPayload,
  TodosWorkspaceProjectBoardColumn,
  TodosWorkspaceProjectDetailPayload,
  TodosWorkspaceTask,
  TodosWorkspaceUpdateTaskPayload,
} from '../../types'

type TaskEditorMode = 'create' | 'edit'
type TaskEditorCreatePayload = Omit<TodosWorkspaceCreateTaskPayload, 'apiKey'>

export type TaskEditorRequest =
  | {
      type: 'create'
      sourceCategoryId?: string
    }
  | {
      type: 'edit'
      taskId: string
    }
  | null

type TaskEditorProps = {
  detail: TodosWorkspaceProjectDetailPayload
  request: TaskEditorRequest
  onRequestHandled?: () => void
  onCreate: (payload: TaskEditorCreatePayload) => Promise<void>
  onEdit: (taskId: string, payload: TodosWorkspaceUpdateTaskPayload) => Promise<void>
}

const getMovableColumns = (columns: TodosWorkspaceProjectBoardColumn[]) =>
  columns.filter(column => column.normalizedColumnId !== 'done')

const getDefaultCreateColumn = (columns: TodosWorkspaceProjectBoardColumn[]) =>
  getMovableColumns(columns)[0] ?? null

const findColumn = (columns: TodosWorkspaceProjectBoardColumn[], sourceCategoryId: string) =>
  columns.find(column => column.sourceCategoryId === sourceCategoryId) ?? null

const buildDueDateValue = (value: string | null) => value ?? ''
const buildDefaultCreateDueDate = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const TaskEditor = ({
  detail,
  request,
  onRequestHandled,
  onCreate,
  onEdit,
}: TaskEditorProps) => {
  const [mode, setMode] = useState<TaskEditorMode | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState(detail.tasks[0]?.id ?? '')
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createDueDate, setCreateDueDate] = useState('')
  const [createColumnId, setCreateColumnId] = useState(detail.projectBoard.columns[0]?.sourceCategoryId ?? '')
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')

  const selectedTask = useMemo<TodosWorkspaceTask | null>(() => {
    if (detail.tasks.length === 0) {
      return null
    }

    return detail.tasks.find(task => task.id === selectedTaskId) ?? detail.tasks[0] ?? null
  }, [detail.tasks, selectedTaskId])

  const createColumns = useMemo(
    () => getMovableColumns(detail.projectBoard.columns),
    [detail.projectBoard.columns],
  )

  const selectedCreateColumn = useMemo(() => {
    return (
      findColumn(detail.projectBoard.columns, createColumnId) ??
      getDefaultCreateColumn(detail.projectBoard.columns)
    )
  }, [createColumnId, detail.projectBoard.columns])

  useEffect(() => {
    if (detail.tasks.length === 0) {
      setSelectedTaskId('')
      return
    }

    if (!detail.tasks.some(task => task.id === selectedTaskId)) {
      setSelectedTaskId(detail.tasks[0].id)
    }
  }, [detail.tasks, selectedTaskId])

  useEffect(() => {
    setCreateColumnId(current => {
      const fallback = getDefaultCreateColumn(detail.projectBoard.columns)
      if (!fallback) {
        return ''
      }

      if (detail.projectBoard.columns.some(column => column.sourceCategoryId === current)) {
        return current
      }

      return fallback.sourceCategoryId
    })
  }, [detail.projectBoard.columns])

  useEffect(() => {
    if (!request) {
      return
    }

    setActionError('')

    if (request.type === 'create') {
      const requestedColumn = request.sourceCategoryId
        ? findColumn(detail.projectBoard.columns, request.sourceCategoryId)
        : null
      const defaultColumn = requestedColumn ?? getDefaultCreateColumn(detail.projectBoard.columns)

      setMode('create')
      setDialogOpen(true)
      setCreateTitle('')
      setCreateDescription('')
      setCreateDueDate(buildDefaultCreateDueDate())
      setCreateColumnId(defaultColumn?.sourceCategoryId ?? '')
    }

    if (request.type === 'edit') {
      const task = detail.tasks.find(currentTask => currentTask.id === request.taskId) ?? null
      if (task) {
        setSelectedTaskId(task.id)
        setMode('edit')
        setDialogOpen(true)
        setEditTitle(task.title)
        setEditDescription(task.description ?? '')
        setEditDueDate(buildDueDateValue(task.dueDate))
      }
    }

    onRequestHandled?.()
  }, [detail.projectBoard.columns, detail.tasks, onRequestHandled, request])

  const closeDialog = () => {
    if (submitting) {
      return
    }

    setDialogOpen(false)
    setMode(null)
    setActionError('')
  }

  const submitCreate = async () => {
    if (!selectedCreateColumn) {
      setActionError('Select a lane before creating a task')
      return
    }

    setSubmitting(true)
    setActionError('')

    try {
      await onCreate({
        projectId: detail.project.id,
        sourceCategoryId: selectedCreateColumn.sourceCategoryId,
        sourceCategory: selectedCreateColumn.sourceCategory,
        columnId: selectedCreateColumn.normalizedColumnId,
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        dueDate: createDueDate.trim() || null,
      })
      setDialogOpen(false)
      setMode(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const submitEdit = async () => {
    if (!selectedTask?.taskId) {
      setActionError('Select a task with a TickTick task id before editing')
      return
    }

    const normalizedEditDueDate = editDueDate.trim()

    setSubmitting(true)
    setActionError('')

    try {
      await onEdit(selectedTask.taskId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        ...(normalizedEditDueDate ? { dueDate: normalizedEditDueDate } : {}),
      })
      setDialogOpen(false)
      setMode(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update task')
    } finally {
      setSubmitting(false)
    }
  }

  const submitDisabled =
    submitting ||
    mode === null ||
    (mode === 'create' && !selectedCreateColumn) ||
    (mode === 'edit' && !selectedTask)

  return (
    <Dialog open={dialogOpen} onOpenChange={nextOpen => (nextOpen ? setDialogOpen(true) : closeDialog())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create task' : 'Edit task'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? `Create a task for ${detail.project.name}.`
              : selectedTask
                ? `Update ${selectedTask.title} without leaving the project view.`
                : 'Update the selected task.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'create' ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground" htmlFor="task-title">
                Title
              </label>
              <Input id="task-title" value={createTitle} onChange={event => setCreateTitle(event.target.value)} />
            </div>

            <div className="space-y-1">
              <label
                className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                htmlFor="task-description"
              >
                Description
              </label>
              <Input
                id="task-description"
                value={createDescription}
                onChange={event => setCreateDescription(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground" htmlFor="task-due-date">
                Due date
              </label>
              <Input
                id="task-due-date"
                type="date"
                value={createDueDate}
                onChange={event => setCreateDueDate(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground" htmlFor="task-lane">
                Lane
              </label>
              <Select value={createColumnId} onValueChange={setCreateColumnId}>
                <SelectTrigger id="task-lane" className="w-full">
                  <SelectValue placeholder="Choose a lane" />
                </SelectTrigger>
                <SelectContent>
                  {createColumns.map(column => (
                    <SelectItem key={column.sourceCategoryId} value={column.sourceCategoryId}>
                      {column.sourceCategory} ({column.normalizedColumnLabel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : selectedTask ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground" htmlFor="edit-title">
                Title
              </label>
              <Input id="edit-title" value={editTitle} onChange={event => setEditTitle(event.target.value)} />
            </div>

            <div className="space-y-1">
              <label
                className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                htmlFor="edit-description"
              >
                Description
              </label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={event => setEditDescription(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground" htmlFor="edit-due-date">
                Due date
              </label>
              <Input
                id="edit-due-date"
                type="date"
                value={editDueDate}
                onChange={event => setEditDueDate(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {actionError ? (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={mode === 'create' ? submitCreate : submitEdit} disabled={submitDisabled}>
            Save task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
