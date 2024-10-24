import { HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { format } from 'date-fns';
import { CreateStepDto } from './dto/create-step.dto';

@Injectable()
export class StepsService {
	async create(createStepDto: CreateStepDto, apiKey: string) {
		const steps = createStepDto.data.metrics.find(data => data.name === 'step_count');
		for (const step of steps.data) {
			const newStep = {
				stepCount: step.qty.toFixed(),
				date: format(new Date(step.date), 'M/D/YY'),
				fullDate: new Date(step.date),
			};
			await this.postSteps(newStep, apiKey);
		}
		return HttpStatus.OK;
	}
	private async postSteps(newMovie: any, apikey: string): Promise<any> {
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
