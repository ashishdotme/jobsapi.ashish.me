import { Controller, Post, Request, Body, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
	constructor(private readonly metricsService: MetricsService) {}

	@Post()
	create(@Request() req, @Body() createStepDto: any, @Query('apikey') apiKeyParam: string) {
		const apiKey = apiKeyParam || req.headers.apikey;
		if (!apiKey) {
			return { error: 'Apikey cannot be blank' };
		}
		console.log(JSON.stringify(createStepDto));
		return this.metricsService.create(createStepDto, apiKey);
	}
}
