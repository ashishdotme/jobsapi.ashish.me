import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { requireApiKey } from '../common/auth';
import { type TodosWorkspaceCompleteTaskRequest, type TodosWorkspaceCreateTaskRequest, type TodosWorkspaceMoveTaskRequest, type TodosWorkspaceUpdateTaskRequest } from './types';
import { TodosWorkspaceService } from './todos-workspace.service';

@Controller('ops/todos')
export class TodosWorkspaceController {
	constructor(private readonly todosWorkspaceService: TodosWorkspaceService) {}

	@Get('overview')
	async getOverview(@Req() req: any) {
		requireApiKey(req);
		return this.todosWorkspaceService.getOverview();
	}

	@Get('projects')
	async getProjects(@Req() req: any) {
		requireApiKey(req);
		return this.todosWorkspaceService.getProjects();
	}

	@Get('projects/:projectId/completed')
	async getProjectCompletedTasks(@Req() req: any, @Param('projectId') projectId: string) {
		requireApiKey(req);
		return this.todosWorkspaceService.getProjectCompletedTasks(projectId);
	}

	@Get('projects/:projectId')
	async getProject(@Req() req: any, @Param('projectId') projectId: string) {
		requireApiKey(req);
		return this.todosWorkspaceService.getProject(projectId);
	}

	@Post()
	@HttpCode(HttpStatus.OK)
	async createTask(@Req() req: any, @Body() body: TodosWorkspaceCreateTaskRequest) {
		requireApiKey(req);
		return this.todosWorkspaceService.createTask(body);
	}

	@Patch(':taskId')
	async updateTask(@Req() req: any, @Param('taskId') taskId: string, @Body() body: TodosWorkspaceUpdateTaskRequest) {
		requireApiKey(req);
		return this.todosWorkspaceService.updateTask(this.parseTaskId(taskId), body);
	}

	@Post(':taskId/move')
	@HttpCode(HttpStatus.OK)
	async moveTask(@Req() req: any, @Param('taskId') taskId: string, @Body() body: TodosWorkspaceMoveTaskRequest) {
		requireApiKey(req);
		return this.todosWorkspaceService.moveTask(this.parseTaskId(taskId), body);
	}

	@Post(':taskId/complete')
	@HttpCode(HttpStatus.OK)
	async completeTask(@Req() req: any, @Param('taskId') taskId: string, @Body() body: TodosWorkspaceCompleteTaskRequest) {
		requireApiKey(req);
		return this.todosWorkspaceService.completeTask(this.parseTaskId(taskId), body);
	}

	private parseTaskId(taskId: string): string {
		if (!/^[1-9]\d*$/.test(taskId)) {
			throw new BadRequestException('Invalid task id');
		}

		return taskId;
	}
}
