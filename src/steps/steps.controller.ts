import { Controller, Post, Request, Body, Query } from '@nestjs/common';
import { StepsService } from './steps.service';
import { CreateStepDto } from './dto/create-step.dto';

@Controller('steps')
export class StepsController {
	constructor(private readonly stepsService: StepsService) {}

	@Post()
	create(@Request() req, @Body() createStepDto: CreateStepDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = apiKeyParam || req.headers.apikey;
		if (!apiKey) {
			return { error: 'Apikey cannot be blank' };
		}
		return this.stepsService.create(createStepDto, apiKey);
	}
}
