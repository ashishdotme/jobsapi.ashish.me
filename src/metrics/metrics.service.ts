import { HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { format } from 'date-fns';
import { CreateMetricDto } from './dto/create-metric.dto';

@Injectable()
export class MetricsService {
	async create(createMetricDto: CreateMetricDto, apiKey: string) {
		const stepsMetrics = createMetricDto.data.metrics.find(data => data.name === 'step_count');
		for (const step of stepsMetrics.data) {
			const newMetric = {
				stepCount: step.qty.toFixed(),
				date: format(step.date.split(' ')[0], 'M/d/yy'),
				fullDate: new Date(step.date.split(' ')[0]),
			};
			await this.postSteps(newMetric, apiKey);
		}
		const sleepMetrics = createMetricDto.data.metrics.find(data => data.name === 'sleep_analysis');
		for (const sleep of sleepMetrics.data) {
			const newMetric = {
				sleep: sleep.inBed,
				date: format(sleep.date.split(' ')[0], 'M/d/yy'),
				fullDate: new Date(sleep.date.split(' ')[0]),
				sleepStart: sleep.sleepStart,
				sleepEnd: sleep.sleepEnd,
			};
			await this.postSleep(newMetric, apiKey);
		}
		return HttpStatus.OK;
	}
	private async postSteps(newStep: any, apikey: string): Promise<any> {
		try {
			const config = {
				headers: {
					apikey: apikey,
				},
			};
			const response = await axios.post('https://api.ashish.me/steps', newStep, config);
			return response.data;
		} catch (error) {
			console.error(error.response.data);
		}
	}

	private async postSleep(newSleep: any, apikey: string): Promise<any> {
		try {
			const config = {
				headers: {
					apikey: apikey,
				},
			};
			const response = await axios.post('https://api.ashish.me/sleep', newSleep, config);
			return response.data;
		} catch (error) {
			console.error(error.response.data);
		}
	}
}
