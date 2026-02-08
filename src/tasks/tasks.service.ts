import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import TickTick from './helpers/ticktick/ticktick';
import axios from 'axios';
import { Task } from './helpers/ticktick/task';

@Injectable()
export class TasksService {
	private readonly logger = new Logger(TasksService.name);
	private readonly ticktickApi = new TickTick(this.configService.get<string>('TICKTICK_TOKEN'));
	private readonly apiKey = this.configService.get<string>('ASHISHDOTME_TOKEN');

	constructor(private configService: ConfigService) {}

	@Interval(60000)
	async handleInterval() {
		if (!this.apiKey) {
			this.logger.warn('Skipping TickTick sync: ASHISHDOTME_TOKEN is not configured');
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
					this.logger.log('Successfully created task from TickTick to api.ashish.me');
				} catch (error) {
					this.logger.error(`Failed to create new task: ${error.message}`);
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
						this.logger.log('Successfully completed task');
					}
				} catch (error) {
					this.logger.error(`Failed to complete task: ${error.message}`);
				}
			}
		} catch (error) {
			this.logger.error(`TickTick sync iteration failed: ${error.message}`);
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
