import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { format } from 'date-fns';
import { CreateMetricDto } from './dto/create-metric.dto';

interface StepMetric {
	stepCount: string;
	date: string;
	fullDate: Date;
}

interface SleepMetric {
	sleep: number;
	date: string;
	fullDate: Date;
	sleepStart: string;
	sleepEnd: string;
}

@Injectable()
export class MetricsService {
	private readonly logger = new Logger(MetricsService.name);
	private readonly API_BASE_URL = 'https://api.ashish.me';

	async create(createMetricDto: CreateMetricDto, apiKey: string): Promise<HttpStatus> {
		try {
			await this.processStepMetrics(createMetricDto, apiKey);
			await this.processSleepMetrics(createMetricDto, apiKey);
			return HttpStatus.OK;
		} catch (error) {
			this.logger.error(`Failed to process metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw new HttpException('Failed to process metrics', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	private async processStepMetrics(createMetricDto: CreateMetricDto, apiKey: string): Promise<void> {
		const stepsMetrics = createMetricDto.data.metrics.find(data => data.name === 'step_count');
		if (!stepsMetrics) return;

		for (const step of stepsMetrics.data) {
			if (typeof step.qty !== 'number') {
				continue;
			}

			const newMetric: StepMetric = {
				stepCount: step.qty.toFixed(),
				date: this.formatDate(step.date),
				fullDate: new Date(step.date.split(' ')[0]),
			};
			this.logger.log(`Posting step metric: ${JSON.stringify(newMetric)}`);
			await this.postData('/steps', newMetric, apiKey);
		}
	}

	private async processSleepMetrics(createMetricDto: CreateMetricDto, apiKey: string): Promise<void> {
		const sleepMetrics = createMetricDto.data.metrics.find(data => data.name === 'sleep_analysis');
		if (!sleepMetrics) return;

		for (const sleep of sleepMetrics.data) {
			if (!sleep.sleepStart || !sleep.sleepEnd) {
				continue;
			}

			const sleepStartDate = new Date(sleep.sleepStart);
			const sleepEndDate = new Date(sleep.sleepEnd);
			const sleepHours = (sleepEndDate.getTime() - sleepStartDate.getTime()) / (1000 * 60 * 60); // difference in hours
			const newMetric: SleepMetric = {
				sleep: Number(sleepHours.toFixed(2)),
				date: this.formatDate(sleep.date),
				fullDate: new Date(sleep.date.split(' ')[0]),
				sleepStart: sleep.sleepStart,
				sleepEnd: sleep.sleepEnd,
			};
			this.logger.log(`Posting sleep metric: ${JSON.stringify(newMetric)}`);
			await this.postData('/sleep', newMetric, apiKey);
		}
	}

	private formatDate(dateString: string): string {
		return format(new Date(dateString.split(' ')[0]), 'M/d/yy');
	}

	private async postData<T>(endpoint: string, data: T, apiKey: string): Promise<any> {
		try {
			const config: AxiosRequestConfig = {
				headers: {
					apikey: apiKey,
				},
			};
			const response = await axios.post(`${this.API_BASE_URL}${endpoint}`, data, config);
			return response.data;
		} catch (error) {
			const errorMessage = error?.response?.data || error?.message || 'Unknown error';
			this.logger.error(`API request failed: ${errorMessage}`);
			throw error;
		}
	}
}
