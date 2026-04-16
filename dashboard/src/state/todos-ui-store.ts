import { create } from 'zustand'

type TodosUiStoreState = {
  selectedProjectId: string | null
  completedTasksVisibleByProjectId: Record<string, boolean>
  setSelectedProjectId: (projectId: string | null) => void
  setCompletedTasksVisible: (projectId: string, visible: boolean) => void
  toggleCompletedTasksVisible: (projectId: string) => void
}

export const selectSelectedProjectId = (state: TodosUiStoreState) => state.selectedProjectId
export const selectCompletedTasksVisibleByProjectId = (state: TodosUiStoreState) =>
  state.completedTasksVisibleByProjectId

export const useTodosUiStore = create<TodosUiStoreState>()(set => ({
  selectedProjectId: null,
  completedTasksVisibleByProjectId: {},
  setSelectedProjectId: projectId => {
    set({ selectedProjectId: projectId })
  },
  setCompletedTasksVisible: (projectId, visible) => {
    set(state => ({
      completedTasksVisibleByProjectId: {
        ...state.completedTasksVisibleByProjectId,
        [projectId]: visible,
      },
    }))
  },
  toggleCompletedTasksVisible: projectId => {
    set(state => ({
      completedTasksVisibleByProjectId: {
        ...state.completedTasksVisibleByProjectId,
        [projectId]: !state.completedTasksVisibleByProjectId[projectId],
      },
    }))
  },
}))
