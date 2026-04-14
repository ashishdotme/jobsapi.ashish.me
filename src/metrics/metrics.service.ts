import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { format } from 'date-fns';
import { CreateMetricDto } from './dto/create-metric.dto';
import { formatLogMessage, getErrorMessage, getErrorStack } from '../common/logging';

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

export type MetricType = 'steps' | 'sleep';
export type MetricAction = 'created' | 'updated' | 'skipped' | 'failed' | 'invalid';

export interface MetricStatus {
	ok: boolean;
	metricType: MetricType;
	action: MetricAction;
	date: string;
	message: string;
	previousValue?: number;
	nextValue?: number;
	upstreamStatusCode?: number;
}

export interface MetricsResponse {
	ok: true;
	message: string;
	totals: {
		received: number;
		processed: number;
		created: number;
		updated: number;
		skipped: number;
		failed: number;
		invalid: number;
	};
	statuses: MetricStatus[];
}

@Injectable()
export class MetricsService {
	private readonly logger = new Logger(MetricsService.name);
	private readonly API_BASE_URL = 'https://api.ashish.me';

	async create(createMetricDto: CreateMetricDto, apiKey: string): Promise<MetricsResponse> {
		const startedAt = Date.now();
		this.logger.log(formatLogMessage('metrics.batch.received'));

		const statuses: MetricStatus[] = [];
		statuses.push(...(await this.processStepMetrics(createMetricDto, apiKey)));
		statuses.push(...(await this.processSleepMetrics(createMetricDto, apiKey)));

		const totals = {
			received: statuses.length,
			processed: statuses.length,
			created: statuses.filter(status => status.action === 'created').length,
			updated: statuses.filter(status => status.action === 'updated').length,
			skipped: statuses.filter(status => status.action === 'skipped').length,
			failed: statuses.filter(status => status.action === 'failed').length,
			invalid: statuses.filter(status => status.action === 'invalid').length,
		};

		this.logger.log(
			formatLogMessage('metrics.batch.completed', {
				...totals,
				durationMs: Date.now() - startedAt,
			}),
		);

		return {
			ok: true,
			message: 'Processed metrics batch.',
			totals,
			statuses,
		};
	}

	private async processStepMetrics(createMetricDto: CreateMetricDto, apiKey: string): Promise<MetricStatus[]> {
		const stepsMetrics = createMetricDto.data.metrics.find(data => data.name === 'step_count');
		if (!stepsMetrics) return [];

		const statuses: MetricStatus[] = [];

		for (const step of stepsMetrics.data) {
			try {
				if (typeof step.qty !== 'number') {
					statuses.push({
						ok: false,
						metricType: 'steps',
						action: 'invalid',
						date: this.safeFormatDate(step.date),
						message: 'Step metric is missing qty.',
					});
					continue;
				}

				const newMetric: StepMetric = {
					stepCount: step.qty.toFixed(),
					date: this.formatDate(step.date),
					fullDate: new Date(step.date.split(' ')[0]),
				};
				statuses.push(await this.postData('/steps', newMetric, apiKey, 'steps'));
			} catch (error) {
				statuses.push(this.buildLocalFailureStatus('steps', step.date, error));
			}
		}

		return statuses;
	}

	private async processSleepMetrics(createMetricDto: CreateMetricDto, apiKey: string): Promise<MetricStatus[]> {
		const sleepMetrics = createMetricDto.data.metrics.find(data => data.name === 'sleep_analysis');
		if (!sleepMetrics) return [];

		const statuses: MetricStatus[] = [];

		for (const sleep of sleepMetrics.data) {
			try {
				if (!sleep.sleepStart || !sleep.sleepEnd) {
					statuses.push({
						ok: false,
						metricType: 'sleep',
						action: 'invalid',
						date: this.safeFormatDate(sleep.date),
						message: 'Sleep metric is missing sleepStart or sleepEnd.',
					});
					continue;
				}

				const sleepStartDate = new Date(sleep.sleepStart);
				const sleepEndDate = new Date(sleep.sleepEnd);
				const sleepHours = (sleepEndDate.getTime() - sleepStartDate.getTime()) / (1000 * 60 * 60);
				const newMetric: SleepMetric = {
					sleep: Number(sleepHours.toFixed(2)),
					date: this.formatDate(sleep.date),
					fullDate: new Date(sleep.date.split(' ')[0]),
					sleepStart: sleep.sleepStart,
					sleepEnd: sleep.sleepEnd,
				};
				statuses.push(await this.postData('/sleep', newMetric, apiKey, 'sleep'));
			} catch (error) {
				statuses.push(this.buildLocalFailureStatus('sleep', sleep.date, error));
			}
		}

		return statuses;
	}

	private formatDate(dateString: string): string {
		return format(new Date(dateString.split(' ')[0]), 'M/d/yy');
	}

	private safeFormatDate(dateString: string): string {
		try {
			return this.formatDate(dateString);
		} catch {
			return dateString?.split(' ')[0] || 'unknown';
		}
	}

	private buildLocalFailureStatus(metricType: MetricType, rawDate: string, error: unknown): MetricStatus {
		const status: MetricStatus = {
			ok: false,
			metricType,
			action: 'failed',
			date: this.safeFormatDate(rawDate),
			message: getErrorMessage(error),
		};
		this.logger.error(
			formatLogMessage('metrics.item.failed', {
				metricType,
				date: status.date,
				errorMessage: status.message,
			}),
			getErrorStack(error),
		);
		return status;
	}

	private async postData<T extends { date: string }>(endpoint: string, data: T, apiKey: string, metricType: MetricType): Promise<MetricStatus> {
		try {
			const config: AxiosRequestConfig = {
				headers: {
					apikey: apiKey,
				},
			};
			const response = await axios.post(`${this.API_BASE_URL}${endpoint}`, data, config);
			return response.data as MetricStatus;
		} catch (error) {
			const responseBody = error?.response?.data;
			const upstreamMessage = typeof responseBody?.message === 'string' ? responseBody.message : typeof responseBody === 'string' ? responseBody : getErrorMessage(error);
			const status: MetricStatus = {
				ok: false,
				metricType,
				action: 'failed',
				date: data.date,
				message: upstreamMessage,
				upstreamStatusCode: error?.response?.status,
			};
			this.logger.error(
				formatLogMessage('metrics.item.failed', {
					endpoint,
					metricType,
					date: data.date,
					payload: data,
					errorMessage: upstreamMessage,
					upstreamStatusCode: error?.response?.status,
				}),
				getErrorStack(error),
			);
			return status;
		}
	}
}
