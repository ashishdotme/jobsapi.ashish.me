import { asTodosWorkspaceSourceCategory, asTodosWorkspaceSourceCategoryId, type TodosWorkspaceBoardSummary, type TodosWorkspaceProjectBoard } from './types';
import { mapTodosWorkspaceNormalizedBoard, mapTodosWorkspaceProjectBoardColumns, mapTodosWorkspaceSourceCategoryToNormalizedColumn } from './kanban-mapper';

describe('todos workspace kanban mapper', () => {
	it.each([
		['Backlog', 'backlog', 'Backlog'],
		['Now', 'in_progress', 'In Progress'],
		['Blocked', 'blocked', 'Blocked'],
		['Done', 'done', 'Done'],
	] as const)('maps %s to %s', (sourceCategory, expectedColumnId, expectedLabel) => {
		expect(mapTodosWorkspaceSourceCategoryToNormalizedColumn(asTodosWorkspaceSourceCategory(sourceCategory))).toEqual({
			normalizedColumnId: expectedColumnId,
			normalizedColumnLabel: expectedLabel,
		});
	});

	it('defaults unknown categories to backlog', () => {
		expect(mapTodosWorkspaceSourceCategoryToNormalizedColumn(asTodosWorkspaceSourceCategory('Archived'))).toEqual({
			normalizedColumnId: 'backlog',
			normalizedColumnLabel: 'Backlog',
		});
	});

	it('preserves the raw project category in mapped project-board metadata', () => {
		const projectBoard = mapTodosWorkspaceProjectBoardColumns([
			{
				sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-now'),
				sourceCategory: asTodosWorkspaceSourceCategory('Now'),
				taskCount: 3,
				taskIds: ['todo-1', 'todo-2', 'todo-3'],
			},
		]);

		expect(projectBoard).toEqual([
			{
				sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-now'),
				sourceCategory: asTodosWorkspaceSourceCategory('Now'),
				normalizedColumnId: 'in_progress',
				normalizedColumnLabel: 'In Progress',
				taskCount: 3,
				taskIds: ['todo-1', 'todo-2', 'todo-3'],
			},
		]);
	});

	it('aggregates normalized counts across projects', () => {
		const normalizedBoard = mapTodosWorkspaceNormalizedBoard([
			{
				columns: [
					{
						sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-backlog'),
						sourceCategory: asTodosWorkspaceSourceCategory('Backlog'),
						taskCount: 2,
					},
					{
						sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-now'),
						sourceCategory: asTodosWorkspaceSourceCategory('Now'),
						taskCount: 3,
					},
				],
			},
			{
				columns: [
					{
						sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-unknown'),
						sourceCategory: asTodosWorkspaceSourceCategory('Archived'),
						taskCount: 4,
					},
					{
						sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-done'),
						sourceCategory: asTodosWorkspaceSourceCategory('Done'),
						taskCount: 5,
					},
				],
			},
		]);

		expect(normalizedBoard).toEqual({
			columns: [
				{ id: 'backlog', label: 'Backlog', taskCount: 6 },
				{ id: 'in_progress', label: 'In Progress', taskCount: 3 },
				{ id: 'blocked', label: 'Blocked', taskCount: 0 },
				{ id: 'done', label: 'Done', taskCount: 5 },
			],
			totalTaskCount: 14,
		} satisfies TodosWorkspaceBoardSummary);
	});

	it('can be used with project boards as mapper input', () => {
		const projectBoard = {
			columns: [
				{
					sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-now'),
					sourceCategory: asTodosWorkspaceSourceCategory('Now'),
					normalizedColumnId: 'in_progress',
					normalizedColumnLabel: 'In Progress',
					taskCount: 3,
					taskIds: ['todo-1'],
				},
			],
			totalTaskCount: 3,
		} satisfies TodosWorkspaceProjectBoard;

		expect(projectBoard.columns[0]?.normalizedColumnId).toBe('in_progress');
	});
});
