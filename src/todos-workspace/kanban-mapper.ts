import {
	TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS,
	type TodosWorkspaceBoardSummary,
	type TodosWorkspaceNormalizedBoardColumnId,
	type TodosWorkspaceProjectBoard,
	type TodosWorkspaceProjectBoardColumn,
	type TodosWorkspaceSourceCategory,
	type TodosWorkspaceSourceCategoryId,
} from './types';

export interface TodosWorkspaceKanbanSourceColumn {
	sourceCategoryId: TodosWorkspaceSourceCategoryId;
	sourceCategory: TodosWorkspaceSourceCategory;
	taskCount: number;
	taskIds?: string[];
}

export interface TodosWorkspaceKanbanSourceProject {
	columns: TodosWorkspaceKanbanSourceColumn[];
}

const NORMALIZED_COLUMN_IDS = TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS.map(column => column.id) as TodosWorkspaceNormalizedBoardColumnId[];

const SOURCE_CATEGORY_TO_NORMALIZED_COLUMN_ID: Record<string, TodosWorkspaceNormalizedBoardColumnId> = {
	backlog: 'backlog',
	todo: 'backlog',
	'to do': 'backlog',
	later: 'backlog',
	someday: 'backlog',
	now: 'in_progress',
	'to process': 'in_progress',
	doing: 'in_progress',
	'in progress': 'in_progress',
	active: 'in_progress',
	blocked: 'blocked',
	blocker: 'blocked',
	waiting: 'blocked',
	done: 'done',
	complete: 'done',
	completed: 'done',
	finished: 'done',
	closed: 'done',
};

export function isTodosWorkspaceStandardSourceCategory(sourceCategory: TodosWorkspaceSourceCategory): boolean {
	return Object.prototype.hasOwnProperty.call(SOURCE_CATEGORY_TO_NORMALIZED_COLUMN_ID, sourceCategory.trim().toLowerCase());
}

export function mapTodosWorkspaceSourceCategoryToNormalizedColumn(sourceCategory: TodosWorkspaceSourceCategory): {
	normalizedColumnId: TodosWorkspaceNormalizedBoardColumnId;
	normalizedColumnLabel: string;
} {
	const normalizedKey = sourceCategory.trim().toLowerCase();
	const normalizedColumnId = SOURCE_CATEGORY_TO_NORMALIZED_COLUMN_ID[normalizedKey] ?? 'backlog';
	const normalizedColumn = TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS.find(column => column.id === normalizedColumnId);

	return {
		normalizedColumnId,
		normalizedColumnLabel: normalizedColumn?.label ?? 'Backlog',
	};
}

export function mapTodosWorkspaceProjectBoardColumns(sourceColumns: TodosWorkspaceKanbanSourceColumn[]): TodosWorkspaceProjectBoardColumn[] {
	return sourceColumns.map(sourceColumn => {
		const normalizedColumn = mapTodosWorkspaceSourceCategoryToNormalizedColumn(sourceColumn.sourceCategory);

		return {
			sourceCategoryId: sourceColumn.sourceCategoryId,
			sourceCategory: sourceColumn.sourceCategory,
			normalizedColumnId: normalizedColumn.normalizedColumnId,
			normalizedColumnLabel: normalizedColumn.normalizedColumnLabel,
			taskCount: sourceColumn.taskCount,
			taskIds: sourceColumn.taskIds ?? [],
		};
	});
}

export function mapTodosWorkspaceNormalizedBoard(projects: TodosWorkspaceKanbanSourceProject[]): TodosWorkspaceBoardSummary {
	const columnsById = new Map<TodosWorkspaceNormalizedBoardColumnId, number>(NORMALIZED_COLUMN_IDS.map(columnId => [columnId, 0]));

	for (const project of projects) {
		for (const sourceColumn of project.columns) {
			const normalizedColumn = mapTodosWorkspaceSourceCategoryToNormalizedColumn(sourceColumn.sourceCategory);
			columnsById.set(normalizedColumn.normalizedColumnId, (columnsById.get(normalizedColumn.normalizedColumnId) ?? 0) + sourceColumn.taskCount);
		}
	}

	return {
		columns: TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS.map(column => ({
			...column,
			taskCount: columnsById.get(column.id) ?? 0,
		})),
		totalTaskCount: Array.from(columnsById.values()).reduce((total, taskCount) => total + taskCount, 0),
	};
}

export function mapTodosWorkspaceProjectBoard(sourceColumns: TodosWorkspaceKanbanSourceColumn[]): TodosWorkspaceProjectBoard {
	return {
		columns: mapTodosWorkspaceProjectBoardColumns(sourceColumns),
		totalTaskCount: sourceColumns.reduce((total, sourceColumn) => total + sourceColumn.taskCount, 0),
	};
}
