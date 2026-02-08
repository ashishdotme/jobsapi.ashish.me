import { Controller, Post, Request, Body, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { API_KEY_MISSING_MESSAGE, extractApiKey } from '../common/auth';

@Controller('metrics')
export class MetricsController {
	constructor(private readonly metricsService: MetricsService) {}

	@Post()
	create(@Request() req, @Body() createStepDto: any, @Query('apikey') apiKeyParam: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: API_KEY_MISSING_MESSAGE };
		}
		return this.metricsService.create(createStepDto, apiKey);
	}
}
