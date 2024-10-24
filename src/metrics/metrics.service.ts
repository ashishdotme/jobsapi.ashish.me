import { HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { format } from 'date-fns';
import { CreateMetricDto } from './dto/create-metric.dto';

@Injectable()
export class MetricsService {
	async create(createMetricDto: CreateMetricDto, apiKey: string) {
		const metrics = createMetricDto.data.metrics.find(data => data.name === 'step_count');
		for (const step of metrics.data) {
			const newMetric = {
				stepCount: step.qty.toFixed(),
				date: format(step.date.split(' ')[0], 'M/d/yy'),
				fullDate: new Date(step.date.split(' ')[0]),
			};
			await this.postMetrics(newMetric, apiKey);
		}
		return HttpStatus.OK;
	}
	private async postMetrics(newMovie: any, apikey: string): Promise<any> {
		// use try catch block to handle errors
		try {
			const config = {
				headers: {
					apikey: apikey,
				},
			};
			const response = await axios.post('https://api.ashish.me/steps', newMovie, config);
			return response.data;
		} catch (error) {
			console.error(error.response.data);
		}
	}
}
