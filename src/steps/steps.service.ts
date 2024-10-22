import { HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { format } from 'date-fns';
import { CreateStepDto } from './dto/create-step.dto';

@Injectable()
export class StepsService {
	async create(createStepDto: CreateStepDto, apiKey: string) {
		const newStep = {
			stepCount: createStepDto.data.metrics[0].data[0].qty,
			date: format(new Date(createStepDto.data.metrics[0].data[0].date), 'M/d/yy'),
			fullDate: new Date(createStepDto.data.metrics[0].data[0].date),
		};
		await this.postSteps(newStep, apiKey);
		return HttpStatus.OK;
	}
	private async postSteps(newMovie: any, apikey: string): Promise<any> {
		const config = {
			headers: {
				apikey: apikey,
			},
		};
		const response = await axios.post('https://api.ashish.me/steps', newMovie, config);
		return response.data;
	}
}
