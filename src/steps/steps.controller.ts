import { Controller, Post, Request, Body, Query } from '@nestjs/common';
import { StepsService } from './steps.service';
import { CreateStepDto } from './dto/create-step.dto';

@Controller('steps')
export class StepsController {
	constructor(private readonly stepsService: StepsService) {}

	@Post()
	create(@Request() req, @Body() createStepDto: any, @Query('apikey') apiKeyParam: string) {
		const apiKey = apiKeyParam || req.headers.apikey;
		if (!apiKey) {
			return { error: 'Apikey cannot be blank' };
		}
		console.log(JSON.stringify(createStepDto));
		return this.stepsService.create(createStepDto, apiKey);
	}
}
