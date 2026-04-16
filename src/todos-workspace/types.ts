export const TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS = [
	{ id: 'backlog', label: 'Backlog' },
	{ id: 'in_progress', label: 'In Progress' },
	{ id: 'blocked', label: 'Blocked' },
	{ id: 'done', label: 'Done' },
] as const;

export type TodosWorkspaceNormalizedBoardColumnId = (typeof TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS)[number]['id'];

declare const TODOS_WORKSPACE_SOURCE_CATEGORY_ID_BRAND: unique symbol;
declare const TODOS_WORKSPACE_SOURCE_CATEGORY_BRAND: unique symbol;

export type TodosWorkspaceSourceCategoryId = string & {
	readonly [TODOS_WORKSPACE_SOURCE_CATEGORY_ID_BRAND]: 'TodosWorkspaceSourceCategoryId';
};

export type TodosWorkspaceSourceCategory = string & {
	readonly [TODOS_WORKSPACE_SOURCE_CATEGORY_BRAND]: 'TodosWorkspaceSourceCategory';
};

export const asTodosWorkspaceSourceCategoryId = (value: string): TodosWorkspaceSourceCategoryId => value as TodosWorkspaceSourceCategoryId;

export const asTodosWorkspaceSourceCategory = (value: string): TodosWorkspaceSourceCategory => value as TodosWorkspaceSourceCategory;

export interface TodosWorkspaceSourceCategoryRef {
	sourceCategoryId: TodosWorkspaceSourceCategoryId;
	sourceCategory: TodosWorkspaceSourceCategory;
}

export interface TodosWorkspaceNormalizedBoardColumn {
	id: TodosWorkspaceNormalizedBoardColumnId;
	label: string;
	taskCount: number;
	tasks?: TodosWorkspaceTask[];
}

export interface TodosWorkspaceProjectSummary {
	id: string;
	name: string;
	sourceProjectId: string;
	taskCount: number;
	openTaskCount: number;
	overdueTaskCount: number;
	dueSoonTaskCount: number;
	updatedAt: string;
}

export interface TodosWorkspaceBoardSummary {
	columns: TodosWorkspaceNormalizedBoardColumn[];
	totalTaskCount: number;
}

export interface TodosWorkspaceTask {
	id: string;
	todoId: string;
	taskId: string | null;
	title: string;
	projectId: string;
	projectName: string;
	sourceCategoryId: TodosWorkspaceSourceCategoryId;
	sourceCategory: TodosWorkspaceSourceCategory;
	columnId: TodosWorkspaceNormalizedBoardColumnId;
	completed: boolean;
	dueDate: string | null;
	completedAt: string | null;
	sourceUpdatedAt: string;
	description?: string | null;
}

export interface TodosWorkspaceOverviewPayload {
	generatedAt: string;
	projects: TodosWorkspaceProjectSummary[];
	normalizedBoard: TodosWorkspaceBoardSummary;
	overdueTasks: TodosWorkspaceTask[];
	dueSoonTasks: TodosWorkspaceTask[];
}

export interface TodosWorkspaceProjectListPayload {
	projects: TodosWorkspaceProjectSummary[];
}

export interface TodosWorkspaceProjectBoardColumn {
	sourceCategoryId: TodosWorkspaceSourceCategoryId;
	sourceCategory: TodosWorkspaceSourceCategory;
	normalizedColumnId: TodosWorkspaceNormalizedBoardColumnId;
	normalizedColumnLabel: string;
	taskCount: number;
	taskIds: string[];
}

export interface TodosWorkspaceProjectBoard {
	columns: TodosWorkspaceProjectBoardColumn[];
	totalTaskCount: number;
}

export interface TodosWorkspaceProjectDetailPayload {
	project: TodosWorkspaceProjectSummary;
	projectBoard: TodosWorkspaceProjectBoard;
	normalizedBoard: TodosWorkspaceBoardSummary;
	tasks: TodosWorkspaceTask[];
}

export interface TodosWorkspaceCompletedTasksPayload {
	tasks: TodosWorkspaceTask[];
}

export interface TodosWorkspaceCreateTaskRequest {
	projectId: string;
	sourceCategoryId: TodosWorkspaceSourceCategoryId;
	sourceCategory: TodosWorkspaceSourceCategory;
	columnId: TodosWorkspaceNormalizedBoardColumnId;
	title: string;
	description?: string | null;
	dueDate?: string | null;
}

export interface TodosWorkspaceUpdateTaskRequest {
	taskId: string;
	title?: string;
	description?: string | null;
	dueDate?: string | null;
}

export interface TodosWorkspaceMoveTaskRequest {
	taskId: string;
	targetProjectId: string;
	targetSourceCategoryId: TodosWorkspaceSourceCategoryId;
	targetSourceCategory: TodosWorkspaceSourceCategory;
	targetColumnId: TodosWorkspaceNormalizedBoardColumnId;
}

export interface TodosWorkspaceCompleteTaskRequest {
	taskId: string;
	completedAt?: string;
}

export interface TodosWorkspaceTaskMutationResponse {
	taskId: string;
	projectId: string;
	sourceCategoryId: TodosWorkspaceSourceCategoryId;
	sourceCategory: TodosWorkspaceSourceCategory;
	columnId: TodosWorkspaceNormalizedBoardColumnId;
	syncedAt: string;
	task: TodosWorkspaceTask;
}

export type TodosWorkspaceCreateTaskResponse = TodosWorkspaceTaskMutationResponse;

export type TodosWorkspaceUpdateTaskResponse = TodosWorkspaceTaskMutationResponse;

export type TodosWorkspaceMoveTaskResponse = TodosWorkspaceTaskMutationResponse;

export type TodosWorkspaceCompleteTaskResponse = TodosWorkspaceTaskMutationResponse;
