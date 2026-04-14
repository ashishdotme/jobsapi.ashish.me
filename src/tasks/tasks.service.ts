import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import TickTick from './helpers/ticktick/ticktick';
import axios from 'axios';
import { Task } from './helpers/ticktick/task';
import { formatLogMessage, getErrorMessage, getErrorStack } from '../common/logging';

@Injectable()
export class TasksService {
	private readonly logger = new Logger(TasksService.name);
	private readonly ticktickApi = new TickTick(this.configService.get<string>('TICKTICK_TOKEN'));
	private readonly apiKey = this.configService.get<string>('ASHISHDOTME_TOKEN');

	constructor(private configService: ConfigService) {}

	@Interval(60000)
	async handleInterval() {
		if (!this.apiKey) {
			this.logger.warn(formatLogMessage('tasks.sync.skipped', { reason: 'missing_api_key' }));
			return;
		}

		try {
			const ticktickReponse = await this.ticktickApi.getTasks();
			const ticktickTasks: Task[] = ticktickReponse?.tasks ?? [];
			const todos = await axios.get('https://api.ashish.me/todos/incomplete', {
				headers: { apiKey: this.apiKey },
			});
			for (const ticktickTask of ticktickTasks) {
				try {
					const isCreated = todos.data.find(x => x.content === ticktickTask.title);
					if (isCreated) {
						continue;
					}
					const newTodo = {
						content: ticktickTask.title,
						todoId: ticktickTask.id,
					};
					await this.postTodo(newTodo, this.apiKey);
					this.logger.log(formatLogMessage('tasks.sync.created', { payload: newTodo }));
				} catch (error) {
					this.logger.error(formatLogMessage('tasks.sync.create_failed', { ticktickTask, errorMessage: getErrorMessage(error) }), getErrorStack(error));
				}
			}

			for (const todo of todos.data) {
				try {
					const ticktickTask = await this.ticktickApi.getTask(todo.todoId);
					if (!ticktickTask) {
						continue;
					}
					if (ticktickTask.status === 2 || (ticktickTask.items && ticktickTask.items[0].status) === 1) {
						await this.completeTodo(todo.id, this.apiKey);
						this.logger.log(formatLogMessage('tasks.sync.completed', { payload: todo }));
					}
				} catch (error) {
					this.logger.error(formatLogMessage('tasks.sync.complete_failed', { payload: todo, errorMessage: getErrorMessage(error) }), getErrorStack(error));
				}
			}
		} catch (error) {
			this.logger.error(formatLogMessage('tasks.sync.failed', { errorMessage: getErrorMessage(error) }), getErrorStack(error));
		}
	}

	private async postTodo(newTodo: any, apikey: string): Promise<any> {
		const config = {
			headers: {
				apiKey: apikey,
			},
		};
		const response = await axios.post('https://api.ashish.me/todos', newTodo, config);
		return response.data;
	}

	private async completeTodo(todoId: any, apikey: string): Promise<any> {
		const config = {
			headers: {
				apiKey: apikey,
			},
		};
		const response = await axios.post(`https://api.ashish.me/todos/${todoId}/completed`, null, config);
		return response.data;
	}
}
