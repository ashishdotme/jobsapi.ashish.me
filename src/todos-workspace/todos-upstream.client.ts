import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const TODOS_API_BASE_URL = 'https://api.ashish.me/todos';

export interface UpstreamTodoProject {
	id: string;
	name: string;
	color?: string;
	sortOrder?: number;
	closed?: boolean;
	groupId?: string;
	viewMode?: string;
	permission?: string;
	kind?: string;
}

export interface UpstreamTodoTask {
	id: string;
	projectId: string;
	title: string;
	content?: string;
	desc?: string;
	localTodoId?: number;
	dueDate?: string;
	priority?: 0 | 1 | 3 | 5;
	status?: 0 | 1 | 2;
	category?: string;
	columnId?: string;
	taskUrl?: string;
}

export interface UpstreamTodoColumn {
	id: string;
	projectId: string;
	name: string;
	sortOrder?: number;
}

export interface UpstreamTodoProjectData {
	project: UpstreamTodoProject;
	tasks: UpstreamTodoTask[];
	columns: UpstreamTodoColumn[];
}

export interface UpstreamTodoRecord {
	id: number;
	content?: string;
	category?: string | null;
	projectId?: string | null;
	todoId?: string | null;
	completed?: boolean;
	completedDate?: string | null;
	dueDate?: string;
	createdAt?: string;
	updatedAt?: string;
}

export type UpstreamCreateTaskPayload = {
	content: string;
	desc?: string;
	projectId: string;
	category?: string;
	columnId?: string;
	dueDate?: string | null;
	todoId?: string;
	completed?: boolean;
	completedDate?: string | null;
};

export type UpstreamUpdateTaskPayload = {
	content?: string;
	desc?: string;
	projectId?: string;
	category?: string;
	dueDate?: string | null;
};

export type UpstreamMoveTaskPayload = {
	projectId?: string;
	category?: string;
	columnId?: string;
};

@Injectable()
export class TodosUpstreamClient {
	constructor(private readonly configService: ConfigService) {}

	async getProjects(): Promise<UpstreamTodoProject[]> {
		const response = await axios.get(`${this.getBaseUrl()}/projects`, this.getRequestConfig());
		return response.data;
	}

	async getProject(projectId: string): Promise<UpstreamTodoProjectData> {
		const response = await axios.get(`${this.getBaseUrl()}/projects/${projectId}`, this.getRequestConfig());
		return response.data;
	}

	async createTask(payload: UpstreamCreateTaskPayload): Promise<UpstreamTodoRecord> {
		const response = await axios.post(this.getBaseUrl(), payload, this.getRequestConfig());
		return response.data;
	}

	async updateTask(id: string, payload: UpstreamUpdateTaskPayload): Promise<UpstreamTodoRecord> {
		const response = await axios.patch(`${this.getBaseUrl()}/${id}/dashboard`, payload, this.getRequestConfig());
		return response.data;
	}

	async moveTask(id: string, payload: UpstreamMoveTaskPayload): Promise<void> {
		await axios.post(`${this.getBaseUrl()}/${id}/move`, payload, this.getRequestConfig());
	}

	async completeTask(id: string, todoId?: string): Promise<void> {
		const path = todoId ? `${this.getBaseUrl()}/${id}/completed/${todoId}` : `${this.getBaseUrl()}/${id}/completed`;
		const response = await axios.post(path, null, this.getRequestConfig());
		return response.data;
	}

	private getBaseUrl(): string {
		const configuredBaseUrl = this.configService.get<string>('TODOS_API_BASE_URL') ?? TODOS_API_BASE_URL;
		return configuredBaseUrl.replace(/\/+$/, '');
	}

	private getRequestConfig() {
		return {
			headers: {
				apiKey: this.getUpstreamApiKey(),
			},
		};
	}

	private getUpstreamApiKey(): string | undefined {
		const configuredApiKeys = this.configService.get<string>('ASHISHDOTME_TOKEN') ?? '';
		return configuredApiKeys
			.split(',')
			.map(key => key.trim())
			.find(Boolean);
	}
}
