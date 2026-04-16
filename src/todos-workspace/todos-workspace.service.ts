import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
	asTodosWorkspaceSourceCategory,
	asTodosWorkspaceSourceCategoryId,
	type TodosWorkspaceCompleteTaskRequest,
	type TodosWorkspaceCompleteTaskResponse,
	type TodosWorkspaceCompletedTasksPayload,
	type TodosWorkspaceBoardSummary,
	type TodosWorkspaceCreateTaskRequest,
	type TodosWorkspaceCreateTaskResponse,
	type TodosWorkspaceMoveTaskRequest,
	type TodosWorkspaceMoveTaskResponse,
	type TodosWorkspaceOverviewPayload,
	type TodosWorkspaceProjectDetailPayload,
	type TodosWorkspaceProjectListPayload,
	type TodosWorkspaceProjectSummary,
	type TodosWorkspaceTaskMutationResponse,
	type TodosWorkspaceUpdateTaskRequest,
	type TodosWorkspaceUpdateTaskResponse,
	type TodosWorkspaceTask,
} from './types';
import {
	isTodosWorkspaceStandardSourceCategory,
	mapTodosWorkspaceNormalizedBoard,
	mapTodosWorkspaceProjectBoard,
	mapTodosWorkspaceSourceCategoryToNormalizedColumn,
} from './kanban-mapper';
import { TodosUpstreamClient, type UpstreamTodoColumn, type UpstreamTodoProject, type UpstreamTodoProjectData, type UpstreamTodoTask } from './todos-upstream.client';

const OVERVIEW_DUE_SOON_WINDOW_DAYS = 7;
const OVERVIEW_DUE_SOON_WINDOW_MS = OVERVIEW_DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000;

interface OverviewProjectSnapshot {
	projectSummary: TodosWorkspaceProjectSummary;
	includeInWorkspaceNormalizedBoard: boolean;
	sourceColumns: {
		sourceCategoryId: ReturnType<typeof asTodosWorkspaceSourceCategoryId>;
		sourceCategory: ReturnType<typeof asTodosWorkspaceSourceCategory>;
		taskCount: number;
	}[];
	tasks: TodosWorkspaceTask[];
}

interface ResolvedTaskSnapshot {
	project: UpstreamTodoProject;
	task: TodosWorkspaceTask;
}

interface ResolvedSourceCategory {
	sourceCategoryId: ReturnType<typeof asTodosWorkspaceSourceCategoryId>;
	sourceCategory: ReturnType<typeof asTodosWorkspaceSourceCategory>;
}

interface ProjectTaskView {
	project: UpstreamTodoProject;
	tasks: TodosWorkspaceTask[];
	openTasks: TodosWorkspaceTask[];
	completedTasks: TodosWorkspaceTask[];
	sourceColumns: {
		sourceCategoryId: ReturnType<typeof asTodosWorkspaceSourceCategoryId>;
		sourceCategory: ReturnType<typeof asTodosWorkspaceSourceCategory>;
		taskCount: number;
		taskIds?: string[];
	}[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isOptionalString = (value: unknown): value is string | undefined => value === undefined || typeof value === 'string';

@Injectable()
export class TodosWorkspaceService {
	constructor(private readonly todosUpstreamClient: TodosUpstreamClient) {}

	async getOverview(): Promise<TodosWorkspaceOverviewPayload> {
		const generatedAt = new Date().toISOString();
		const snapshots = await this.buildVisibleOverviewProjectSnapshots(generatedAt);
		const normalizedBoardSnapshots = snapshots.filter(snapshot => snapshot.includeInWorkspaceNormalizedBoard);

		const normalizedBoard = this.buildNormalizedBoard(
			normalizedBoardSnapshots.map(snapshot => ({
				columns: snapshot.sourceColumns,
			})),
			normalizedBoardSnapshots.flatMap(snapshot => snapshot.tasks),
		);
		const allTasks = snapshots.flatMap(snapshot => snapshot.tasks);
		const overdueTasks = this.sortTasks(this.getOverdueTasks(allTasks, generatedAt));
		const dueSoonTasks = this.sortTasks(this.getDueSoonTasks(allTasks, generatedAt));

		return {
			generatedAt,
			projects: snapshots.map(snapshot => snapshot.projectSummary),
			normalizedBoard,
			overdueTasks,
			dueSoonTasks,
		};
	}

	async getProjects(): Promise<TodosWorkspaceProjectListPayload> {
		const generatedAt = new Date().toISOString();
		const snapshots = await this.buildVisibleOverviewProjectSnapshots(generatedAt);

		return {
			projects: snapshots.map(snapshot => snapshot.projectSummary),
		};
	}

	async getProject(projectId: string): Promise<TodosWorkspaceProjectDetailPayload> {
		const generatedAt = new Date().toISOString();
		const view = await this.buildProjectTaskView(projectId, generatedAt, { notFoundAs404: true });

		return {
			project: this.buildProjectSummary(view.project, view.tasks, generatedAt),
			projectBoard: mapTodosWorkspaceProjectBoard(view.sourceColumns),
			normalizedBoard: this.buildNormalizedBoard([{ columns: view.sourceColumns }], view.openTasks),
			tasks: view.openTasks,
		};
	}

	async getProjectCompletedTasks(projectId: string): Promise<TodosWorkspaceCompletedTasksPayload> {
		const generatedAt = new Date().toISOString();
		const view = await this.buildProjectTaskView(projectId, generatedAt, { notFoundAs404: true });

		return {
			tasks: view.completedTasks,
		};
	}

	private async buildProjectTaskView(
		projectId: string,
		generatedAt: string,
		options?: {
			notFoundAs404?: boolean;
		},
	): Promise<ProjectTaskView> {
		const projectData = await this.getProjectOrThrow(projectId, options);
		const resolvedProject = {
			...projectData.project,
			name: projectData.project.name ?? projectData.project.id,
		};
		const tasks = this.mapProjectTasks(resolvedProject, projectData.tasks, projectData.columns, generatedAt);
		const openTasks = tasks.filter(task => !task.completed);
		const completedTasks = tasks.filter(task => task.completed);

		return {
			project: resolvedProject,
			tasks,
			openTasks,
			completedTasks,
			sourceColumns: this.buildProjectSourceColumns(resolvedProject.id, openTasks, projectData.columns),
		};
	}

	async createTask(request: TodosWorkspaceCreateTaskRequest): Promise<TodosWorkspaceCreateTaskResponse> {
		const syncedAt = new Date().toISOString();
		const projectId = this.requireNonEmptyString(request.projectId, 'projectId');
		const title = this.requireNonEmptyString(request.title, 'title');
		const sourceCategory = this.requireNonEmptyString(request.sourceCategory, 'sourceCategory');
		const description = this.normalizeNullableString(request.description);
		const dueDate = this.normalizeMutationDueDate(request.dueDate);
		const projectData = await this.getProjectOrThrow(projectId);
		const targetColumnId = this.resolveCreateColumnId(projectData.columns, request.sourceCategoryId);

		const createdTask = await this.todosUpstreamClient.createTask({
			content: title,
			...(description !== null ? { desc: description } : {}),
			projectId,
			category: sourceCategory,
			...(targetColumnId ? { columnId: targetColumnId } : {}),
			dueDate,
		});

		const createdTaskId = this.requirePositiveIntegerNumber(createdTask.id, 'created task id');
		const resolvedProject = {
			...projectData.project,
			name: projectData.project.name ?? projectId,
		};
		const task = this.findCreatedTask(resolvedProject, projectData.tasks, projectData.columns, createdTaskId, createdTask.todoId, syncedAt);

		return this.buildMutationResponse(task, syncedAt, String(createdTaskId));
	}

	async updateTask(taskId: string, request: TodosWorkspaceUpdateTaskRequest): Promise<TodosWorkspaceUpdateTaskResponse> {
		const syncedAt = new Date().toISOString();
		const normalizedTaskId = this.requireTaskId(taskId);
		const current = await this.resolveTaskByTaskId(normalizedTaskId, syncedAt);
		const hasTitleUpdate = request.title !== undefined;
		const hasDescriptionUpdate = request.description !== undefined;
		const hasDueDateUpdate = request.dueDate !== undefined;

		if (!hasTitleUpdate && !hasDescriptionUpdate && !hasDueDateUpdate) {
			throw new BadRequestException('No task changes provided');
		}

		const title = hasTitleUpdate ? this.requireNonEmptyString(request.title, 'title') : undefined;
		const description = hasDescriptionUpdate ? this.requireNonEmptyString(request.description, 'description') : undefined;
		const dueDate = this.normalizeMutationDueDate(request.dueDate);
		if (request.dueDate !== undefined && request.dueDate !== null && !dueDate) {
			throw new BadRequestException('Invalid due date');
		}

		await this.todosUpstreamClient.updateTask(normalizedTaskId, {
			...(title !== undefined ? { content: title } : {}),
			...(description !== undefined ? { desc: description } : {}),
			...(request.dueDate !== undefined && request.dueDate !== null ? { dueDate } : {}),
		});

		const refreshedTask = await this.resolveTaskInProject(current.project.id, normalizedTaskId, syncedAt);
		return this.buildMutationResponse(refreshedTask, syncedAt, normalizedTaskId);
	}

	async moveTask(taskId: string, request: TodosWorkspaceMoveTaskRequest): Promise<TodosWorkspaceMoveTaskResponse> {
		const syncedAt = new Date().toISOString();
		const normalizedTaskId = this.requireTaskId(taskId);
		const current = await this.resolveTaskByTaskId(normalizedTaskId, syncedAt);
		const targetProjectId = this.requireNonEmptyString(request.targetProjectId, 'targetProjectId');
		const targetSourceCategory = this.requireNonEmptyString(request.targetSourceCategory, 'targetSourceCategory');
		const targetColumnId = this.resolveTargetColumnId(targetProjectId, request.targetSourceCategoryId);

		await this.todosUpstreamClient.moveTask(normalizedTaskId, {
			projectId: targetProjectId,
			category: targetSourceCategory,
			...(targetColumnId ? { columnId: targetColumnId } : {}),
		});

		if (request.targetColumnId === 'done') {
			await this.todosUpstreamClient.completeTask(normalizedTaskId, current.task.todoId ?? undefined);
		}

		const refreshedTask = await this.resolveTaskInProject(targetProjectId, normalizedTaskId, syncedAt);
		return this.buildMutationResponse(refreshedTask, syncedAt, normalizedTaskId);
	}

	async completeTask(taskId: string, request: TodosWorkspaceCompleteTaskRequest): Promise<TodosWorkspaceCompleteTaskResponse> {
		const syncedAt = new Date().toISOString();
		const normalizedTaskId = this.requireTaskId(taskId);
		const completedAt = this.normalizeCompletedAt(request.completedAt, syncedAt);
		const current = await this.resolveTaskByTaskId(normalizedTaskId, syncedAt);
		await this.todosUpstreamClient.completeTask(normalizedTaskId, current.task.todoId ?? undefined);

		const projectData = await this.getProjectOrThrow(current.project.id);
		const refreshedProject = {
			...current.project,
			...projectData.project,
			name: projectData.project.name ?? current.project.name ?? current.project.id,
		};
		const refreshedTask = this.findTaskByTaskId(this.mapProjectTasks(refreshedProject, projectData.tasks, projectData.columns, syncedAt), normalizedTaskId);

		if (refreshedTask) {
			return this.buildMutationResponse(refreshedTask, syncedAt, normalizedTaskId);
		}

		return this.buildMutationResponse(
			{
				...current.task,
				completed: true,
				completedAt,
				sourceUpdatedAt: syncedAt,
			},
			syncedAt,
			normalizedTaskId,
		);
	}

	private async getProjectsOrThrow(): Promise<UpstreamTodoProject[]> {
		try {
			const projects = await this.todosUpstreamClient.getProjects();
			if (!Array.isArray(projects)) {
				throw new ServiceUnavailableException('Todos upstream unavailable');
			}
			if (projects.some(project => !isRecord(project) || !isNonEmptyString(project.id) || !isNonEmptyString(project.name))) {
				throw new ServiceUnavailableException('Todos upstream unavailable');
			}

			return projects;
		} catch {
			throw new ServiceUnavailableException('Todos upstream unavailable');
		}
	}

	private async getProjectOrThrow(
		projectId: string,
		options?: {
			notFoundAs404?: boolean;
		},
	): Promise<UpstreamTodoProjectData> {
		try {
			const projectData = await this.todosUpstreamClient.getProject(projectId);
			if (
				!projectData ||
				!isRecord(projectData.project) ||
				!isNonEmptyString(projectData.project.id) ||
				!isNonEmptyString(projectData.project.name) ||
				projectData.project.id !== projectId
			) {
				throw new ServiceUnavailableException('Todos upstream unavailable');
			}
			if (!Array.isArray(projectData.tasks)) {
				throw new ServiceUnavailableException('Todos upstream unavailable');
			}
			if (
				projectData.tasks.some(
					task =>
						!isRecord(task) ||
						(task.id !== undefined && !isNonEmptyString(task.id)) ||
						(task.projectId !== undefined && (!isNonEmptyString(task.projectId) || task.projectId !== projectId)) ||
						(task.title !== undefined && !isNonEmptyString(task.title)) ||
						!isOptionalString(task.category) ||
						!isOptionalString(task.columnId) ||
						!isOptionalString(task.content) ||
						!isOptionalString(task.desc) ||
						!isOptionalString(task.dueDate) ||
						!isOptionalString((task as { completedTime?: unknown }).completedTime) ||
						!this.isOptionalValidLocalTodoId(task) ||
						(task.status !== undefined && task.status !== 0 && task.status !== 1 && task.status !== 2),
				)
			) {
				throw new ServiceUnavailableException('Todos upstream unavailable');
			}
			if (this.hasDuplicateLocalTodoIds(projectData.tasks)) {
				throw new ServiceUnavailableException('Todos upstream unavailable');
			}

			return {
				project: projectData.project,
				tasks: projectData.tasks,
				columns: Array.isArray(projectData.columns) ? projectData.columns : [],
			};
		} catch (error) {
			if (options?.notFoundAs404 && this.isUpstreamNotFoundError(error)) {
				throw new NotFoundException('Todos project not found');
			}
			throw new ServiceUnavailableException('Todos upstream unavailable');
		}
	}

	private async buildOverviewProjectSnapshot(project: UpstreamTodoProject, generatedAt: string): Promise<OverviewProjectSnapshot | null> {
		const projectData = await this.getProjectOrThrow(project.id);
		if (!this.isVisibleProjectData(projectData)) {
			return null;
		}
		const resolvedProject = {
			...project,
			...projectData.project,
			name: projectData.project.name ?? project.name ?? project.id,
		};
		const tasks = this.mapProjectTasks(resolvedProject, projectData.tasks, projectData.columns, generatedAt);

		return {
			projectSummary: this.buildProjectSummary(resolvedProject, tasks, generatedAt),
			includeInWorkspaceNormalizedBoard: this.isWorkspaceNormalizedBoardProject(tasks),
			sourceColumns: this.buildOverviewSourceColumns(resolvedProject.id, tasks, projectData.columns),
			tasks,
		};
	}

	private async buildVisibleOverviewProjectSnapshots(generatedAt: string): Promise<OverviewProjectSnapshot[]> {
		const discoveredProjects = await this.getProjectsOrThrow();
		const snapshots = await Promise.all(discoveredProjects.map(project => this.buildOverviewProjectSnapshot(project, generatedAt)));

		return snapshots.filter((snapshot): snapshot is OverviewProjectSnapshot => snapshot !== null);
	}

	private isVisibleProjectData(projectData: UpstreamTodoProjectData): boolean {
		return projectData.columns.length > 1;
	}

	private buildProjectSummary(project: UpstreamTodoProject, tasks: TodosWorkspaceTask[], generatedAt: string): TodosWorkspaceProjectSummary {
		const openTasks = tasks.filter(task => !task.completed);
		const overdueTaskCount = openTasks.filter(task => this.isOverdue(task, generatedAt)).length;
		const dueSoonTaskCount = openTasks.filter(task => this.isDueSoon(task, generatedAt)).length;

		return {
			id: project.id,
			name: project.name ?? project.id,
			sourceProjectId: project.id,
			taskCount: tasks.length,
			openTaskCount: openTasks.length,
			overdueTaskCount,
			dueSoonTaskCount,
			updatedAt: generatedAt,
		};
	}

	private isWorkspaceNormalizedBoardProject(tasks: TodosWorkspaceTask[]): boolean {
		return tasks.every(task => isTodosWorkspaceStandardSourceCategory(asTodosWorkspaceSourceCategory(task.sourceCategory)));
	}

	private buildNormalizedBoard(
		projects: Array<{
			columns: {
				sourceCategoryId: ReturnType<typeof asTodosWorkspaceSourceCategoryId>;
				sourceCategory: ReturnType<typeof asTodosWorkspaceSourceCategory>;
				taskCount: number;
			}[];
		}>,
		tasks: TodosWorkspaceTask[],
	): TodosWorkspaceBoardSummary {
		const baseBoard = mapTodosWorkspaceNormalizedBoard(projects);
		const sortedTasks = this.sortNormalizedBoardTasks(tasks);
		const tasksByColumnId = new Map(baseBoard.columns.map(column => [column.id, [] as TodosWorkspaceTask[]]));

		for (const task of sortedTasks) {
			const bucket = tasksByColumnId.get(task.columnId);
			if (bucket) {
				bucket.push(task);
			}
		}

		return {
			columns: baseBoard.columns.map(column => ({
				...column,
				tasks: tasksByColumnId.get(column.id) ?? [],
			})),
			totalTaskCount: baseBoard.totalTaskCount,
		};
	}

	private mapProjectTasks(project: UpstreamTodoProject, tasks: UpstreamTodoTask[], columns: UpstreamTodoColumn[], generatedAt: string): TodosWorkspaceTask[] {
		const columnNameById = this.buildColumnNameById(columns);
		return tasks.map((task, index) => this.mapProjectTask(project, task, index, generatedAt, columnNameById));
	}

	private mapProjectTask(
		project: UpstreamTodoProject,
		task: UpstreamTodoTask,
		index: number,
		generatedAt: string,
		columnNameById: ReadonlyMap<string, string>,
	): TodosWorkspaceTask {
		const resolvedSourceCategory = this.resolveSourceCategory(project.id, task, columnNameById);
		const normalizedColumn = mapTodosWorkspaceSourceCategoryToNormalizedColumn(resolvedSourceCategory.sourceCategory);
		const todoId = this.resolveTaskId(task, project.id, index);
		const completedTime = this.getCompletedTime(task);
		const completedAt = this.parseDate(completedTime);
		const completed = this.isCompletedTask(task);

		return {
			id: `${project.id}:${todoId}`,
			todoId,
			title: task.title ?? 'Untitled task',
			projectId: project.id,
			projectName: project.name ?? project.id,
			sourceCategoryId: resolvedSourceCategory.sourceCategoryId,
			sourceCategory: resolvedSourceCategory.sourceCategory,
			columnId: normalizedColumn.normalizedColumnId,
			taskId: this.resolveLocalTodoId(task),
			completed,
			dueDate: this.normalizeNullableString(task.dueDate),
			completedAt: completedAt ? completedAt.toISOString() : null,
			sourceUpdatedAt: completedAt ? completedAt.toISOString() : generatedAt,
			description: this.normalizeNullableString(task.desc ?? task.content),
		};
	}

	private buildOverviewSourceColumns(
		projectId: string,
		tasks: TodosWorkspaceTask[],
		columns: UpstreamTodoColumn[],
	): {
		sourceCategoryId: ReturnType<typeof asTodosWorkspaceSourceCategoryId>;
		sourceCategory: ReturnType<typeof asTodosWorkspaceSourceCategory>;
		taskCount: number;
	}[] {
		const columnsByCategory = new Map<
			string,
			{
				sourceCategoryId: ReturnType<typeof asTodosWorkspaceSourceCategoryId>;
				sourceCategory: ReturnType<typeof asTodosWorkspaceSourceCategory>;
				taskCount: number;
			}
		>();

		for (const column of columns) {
			columnsByCategory.set(this.buildColumnSourceCategoryId(projectId, column.id), {
				sourceCategoryId: asTodosWorkspaceSourceCategoryId(this.buildColumnSourceCategoryId(projectId, column.id)),
				sourceCategory: asTodosWorkspaceSourceCategory(column.name),
				taskCount: 0,
			});
		}

		for (const task of tasks) {
			const categoryKey = task.sourceCategoryId;
			const existing = columnsByCategory.get(categoryKey);
			if (existing) {
				existing.taskCount += 1;
				continue;
			}

			columnsByCategory.set(task.sourceCategoryId, {
				sourceCategoryId: task.sourceCategoryId,
				sourceCategory: asTodosWorkspaceSourceCategory(task.sourceCategory),
				taskCount: 1,
			});
		}

		return Array.from(columnsByCategory.values());
	}

	private buildProjectSourceColumns(
		projectId: string,
		tasks: TodosWorkspaceTask[],
		columns: UpstreamTodoColumn[],
	): {
		sourceCategoryId: ReturnType<typeof asTodosWorkspaceSourceCategoryId>;
		sourceCategory: ReturnType<typeof asTodosWorkspaceSourceCategory>;
		taskCount: number;
		taskIds: string[];
	}[] {
		const columnsByCategory = new Map<
			string,
			{
				sourceCategoryId: ReturnType<typeof asTodosWorkspaceSourceCategoryId>;
				sourceCategory: ReturnType<typeof asTodosWorkspaceSourceCategory>;
				taskCount: number;
				taskIds: string[];
			}
		>();

		for (const column of columns) {
			const sourceCategoryId = asTodosWorkspaceSourceCategoryId(this.buildColumnSourceCategoryId(projectId, column.id));
			columnsByCategory.set(sourceCategoryId, {
				sourceCategoryId,
				sourceCategory: asTodosWorkspaceSourceCategory(column.name),
				taskCount: 0,
				taskIds: [],
			});
		}

		for (const task of tasks) {
			const categoryKey = task.sourceCategoryId;
			const existing = columnsByCategory.get(categoryKey);
			if (existing) {
				existing.taskCount += 1;
				existing.taskIds.push(task.todoId);
				continue;
			}

			columnsByCategory.set(task.sourceCategoryId, {
				sourceCategoryId: task.sourceCategoryId,
				sourceCategory: asTodosWorkspaceSourceCategory(task.sourceCategory),
				taskCount: 1,
				taskIds: [task.todoId],
			});
		}

		return Array.from(columnsByCategory.values());
	}

	private async resolveTaskByTaskId(taskId: string, generatedAt: string): Promise<ResolvedTaskSnapshot> {
		const discoveredProjects = await this.getProjectsOrThrow();
		let resolvedTask: ResolvedTaskSnapshot | undefined;

		for (const project of discoveredProjects) {
			const projectData = await this.getProjectOrThrow(project.id);
			const resolvedProject = {
				...project,
				...projectData.project,
				name: projectData.project.name ?? project.name ?? project.id,
			};
			const task = this.findTaskByTaskId(this.mapProjectTasks(resolvedProject, projectData.tasks, projectData.columns, generatedAt), taskId);
			if (task) {
				if (resolvedTask) {
					throw new ServiceUnavailableException('Todos upstream unavailable');
				}

				resolvedTask = {
					project: resolvedProject,
					task,
				};
			}
		}

		if (resolvedTask) {
			return resolvedTask;
		}

		throw new NotFoundException('Todos task not found');
	}

	private async resolveTaskInProject(projectId: string, taskId: string, generatedAt: string): Promise<TodosWorkspaceTask> {
		const projectData = await this.getProjectOrThrow(projectId);
		const resolvedProject = {
			...projectData.project,
			name: projectData.project.name ?? projectId,
		};
		const task = this.findTaskByTaskId(this.mapProjectTasks(resolvedProject, projectData.tasks, projectData.columns, generatedAt), taskId);

		if (!task) {
			throw new ServiceUnavailableException('Todos upstream unavailable');
		}

		return task;
	}

	private findCreatedTask(
		project: UpstreamTodoProject,
		tasks: UpstreamTodoTask[],
		columns: UpstreamTodoColumn[],
		createdTaskId: number,
		createdTodoId: string | null | undefined,
		generatedAt: string,
	): TodosWorkspaceTask {
		const mappedTasks = this.mapProjectTasks(project, tasks, columns, generatedAt);
		const createdTask =
			this.findTaskByTaskId(mappedTasks, String(createdTaskId)) ?? (isNonEmptyString(createdTodoId) ? mappedTasks.find(task => task.todoId === createdTodoId) : undefined);

		if (!createdTask) {
			throw new ServiceUnavailableException('Todos upstream unavailable');
		}

		return createdTask.taskId
			? createdTask
			: {
					...createdTask,
					taskId: String(createdTaskId),
				};
	}

	private findTaskByTaskId(tasks: TodosWorkspaceTask[], taskId: string): TodosWorkspaceTask | undefined {
		return tasks.find(task => task.taskId === taskId);
	}

	private buildMutationResponse(task: TodosWorkspaceTask, syncedAt: string, taskId?: string): TodosWorkspaceTaskMutationResponse {
		const normalizedTaskId = task.taskId ?? taskId;
		if (!isNonEmptyString(normalizedTaskId)) {
			throw new ServiceUnavailableException('Todos upstream unavailable');
		}

		return {
			taskId: normalizedTaskId,
			projectId: task.projectId,
			sourceCategoryId: task.sourceCategoryId,
			sourceCategory: task.sourceCategory,
			columnId: task.columnId,
			syncedAt,
			task: {
				...task,
				taskId: normalizedTaskId,
			},
		};
	}

	private requireTaskId(taskId: string): string {
		const parsedTaskId = Number(taskId);
		if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0) {
			throw new BadRequestException('Invalid task id');
		}

		return String(parsedTaskId);
	}

	private requireNonEmptyString(value: unknown, fieldName: string): string {
		if (!isNonEmptyString(value)) {
			throw new BadRequestException(`Invalid ${fieldName}`);
		}

		return value.trim();
	}

	private requirePositiveIntegerNumber(value: unknown, fieldName: string): number {
		if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
			throw new ServiceUnavailableException(`Invalid ${fieldName}`);
		}

		return value;
	}

	private normalizeMutationDueDate(value?: string | null): string | null | undefined {
		if (value === undefined || value === null) {
			return value;
		}

		const parsedDate = new Date(value);
		if (Number.isNaN(parsedDate.getTime())) {
			return undefined;
		}

		return value;
	}

	private normalizeCompletedAt(value: string | undefined, syncedAt: string): string {
		if (value === undefined) {
			return syncedAt;
		}

		const parsedDate = this.parseDate(value);
		if (!parsedDate) {
			throw new BadRequestException('Invalid completedAt');
		}

		return value;
	}

	private isCompletedTask(task: UpstreamTodoTask): boolean {
		return task.status === 2 || Boolean(this.getCompletedTime(task));
	}

	private isOverdue(task: TodosWorkspaceTask, generatedAt: string): boolean {
		if (task.completed || !task.dueDate) {
			return false;
		}

		const dueDate = this.parseDate(task.dueDate);
		if (!dueDate) {
			return false;
		}

		return dueDate.getTime() < this.parseDate(generatedAt)?.getTime();
	}

	private isDueSoon(task: TodosWorkspaceTask, generatedAt: string): boolean {
		if (task.completed || !task.dueDate) {
			return false;
		}

		const dueDate = this.parseDate(task.dueDate);
		const now = this.parseDate(generatedAt);
		if (!dueDate || !now) {
			return false;
		}

		const dueDateTime = dueDate.getTime();
		const nowTime = now.getTime();
		return dueDateTime >= nowTime && dueDateTime <= nowTime + OVERVIEW_DUE_SOON_WINDOW_MS;
	}

	private getOverdueTasks(tasks: TodosWorkspaceTask[], generatedAt: string): TodosWorkspaceTask[] {
		return tasks.filter(task => this.isOverdue(task, generatedAt));
	}

	private getDueSoonTasks(tasks: TodosWorkspaceTask[], generatedAt: string): TodosWorkspaceTask[] {
		return tasks.filter(task => this.isDueSoon(task, generatedAt));
	}

	private sortTasks(tasks: TodosWorkspaceTask[]): TodosWorkspaceTask[] {
		return [...tasks].sort((left, right) => {
			const leftDue = this.parseDate(left.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
			const rightDue = this.parseDate(right.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
			if (leftDue !== rightDue) {
				return leftDue - rightDue;
			}

			if (left.projectId !== right.projectId) {
				return left.projectId.localeCompare(right.projectId);
			}

			if (left.title !== right.title) {
				return left.title.localeCompare(right.title);
			}

			return left.id.localeCompare(right.id);
		});
	}

	private sortNormalizedBoardTasks(tasks: TodosWorkspaceTask[]): TodosWorkspaceTask[] {
		return [...tasks].sort((left, right) => {
			if (left.completed !== right.completed) {
				return left.completed ? 1 : -1;
			}

			const leftDue = this.parseDate(left.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
			const rightDue = this.parseDate(right.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
			if (leftDue !== rightDue) {
				return leftDue - rightDue;
			}

			if (left.projectName !== right.projectName) {
				return left.projectName.localeCompare(right.projectName);
			}

			if (left.title !== right.title) {
				return left.title.localeCompare(right.title);
			}

			return left.id.localeCompare(right.id);
		});
	}

	private buildColumnNameById(columns: UpstreamTodoColumn[]): ReadonlyMap<string, string> {
		return new Map(columns.filter(column => isNonEmptyString(column.id) && isNonEmptyString(column.name)).map(column => [column.id.trim(), column.name.trim()] as const));
	}

	private buildColumnSourceCategoryId(projectId: string, columnId: string): string {
		return `${projectId}:${columnId.trim()}`;
	}

	private resolveCreateColumnId(columns: UpstreamTodoColumn[], sourceCategoryId: string): string | undefined {
		const sourceCategoryIdParts = sourceCategoryId.split(':');
		const columnId = sourceCategoryIdParts.slice(1).join(':').trim();
		if (!columnId) {
			return undefined;
		}

		return columns.some(column => column.id.trim() === columnId) ? columnId : undefined;
	}

	private resolveTargetColumnId(projectId: string, sourceCategoryId: string): string | undefined {
		const normalizedProjectId = projectId.trim();
		const prefix = `${normalizedProjectId}:`;
		if (!sourceCategoryId.startsWith(prefix)) {
			return undefined;
		}

		const columnId = sourceCategoryId.slice(prefix.length).trim();
		return columnId || undefined;
	}

	private resolveSourceCategory(projectId: string, task: UpstreamTodoTask, columnNameById: ReadonlyMap<string, string>): ResolvedSourceCategory {
		const columnId = task.columnId?.trim();
		if (columnId && columnNameById.has(columnId)) {
			return {
				sourceCategoryId: asTodosWorkspaceSourceCategoryId(this.buildColumnSourceCategoryId(projectId, columnId)),
				sourceCategory: asTodosWorkspaceSourceCategory(columnNameById.get(columnId) ?? columnId),
			};
		}

		const category = task.category?.trim();
		if (category) {
			const matchingColumnIds = [...columnNameById.entries()]
				.filter(([, columnName]) => columnName.localeCompare(category, undefined, { sensitivity: 'accent' }) === 0)
				.map(([matchedColumnId]) => matchedColumnId);
			if (matchingColumnIds.length === 1) {
				return {
					sourceCategoryId: asTodosWorkspaceSourceCategoryId(this.buildColumnSourceCategoryId(projectId, matchingColumnIds[0])),
					sourceCategory: asTodosWorkspaceSourceCategory(category),
				};
			}

			return {
				sourceCategoryId: asTodosWorkspaceSourceCategoryId(`${projectId}:${category.trim().toLowerCase() || 'backlog'}`),
				sourceCategory: asTodosWorkspaceSourceCategory(category),
			};
		}

		if (columnId) {
			return {
				sourceCategoryId: asTodosWorkspaceSourceCategoryId(this.buildColumnSourceCategoryId(projectId, columnId)),
				sourceCategory: asTodosWorkspaceSourceCategory(columnId),
			};
		}

		return {
			sourceCategoryId: asTodosWorkspaceSourceCategoryId(`${projectId}:backlog`),
			sourceCategory: asTodosWorkspaceSourceCategory('Backlog'),
		};
	}

	private resolveTaskId(task: UpstreamTodoTask, projectId: string, index: number): string {
		const candidate = task.id?.trim();
		if (candidate) {
			return candidate;
		}

		return `${projectId}-task-${index + 1}`;
	}

	private resolveLocalTodoId(task: UpstreamTodoTask): string | null {
		return this.isValidLocalTodoId(task.localTodoId) ? String(task.localTodoId) : null;
	}

	private isOptionalValidLocalTodoId(task: UpstreamTodoTask): boolean {
		return task.localTodoId === undefined || this.isValidLocalTodoId(task.localTodoId);
	}

	private isValidLocalTodoId(value: unknown): value is number {
		return typeof value === 'number' && Number.isInteger(value) && value > 0;
	}

	private hasDuplicateLocalTodoIds(tasks: UpstreamTodoTask[]): boolean {
		const seenLocalTodoIds = new Set<number>();

		for (const task of tasks) {
			if (!this.isValidLocalTodoId(task.localTodoId)) {
				continue;
			}

			if (seenLocalTodoIds.has(task.localTodoId)) {
				return true;
			}

			seenLocalTodoIds.add(task.localTodoId);
		}

		return false;
	}

	private normalizeNullableString(value?: string | null): string | null {
		if (typeof value !== 'string') {
			return null;
		}

		const trimmed = value.trim();
		return trimmed ? trimmed : null;
	}

	private parseDate(value?: string | null): Date | null {
		if (!value) {
			return null;
		}

		const normalizedValue = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
		const parsedDate = new Date(normalizedValue);
		return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
	}

	private getCompletedTime(task: UpstreamTodoTask): string | undefined {
		return (task as UpstreamTodoTask & { completedTime?: string }).completedTime;
	}

	private isUpstreamNotFoundError(error: unknown): boolean {
		if (!isRecord(error)) {
			return false;
		}

		if (error.status === 404) {
			return true;
		}

		if (!isRecord(error.response)) {
			return false;
		}

		return error.response.status === 404;
	}
}
