import { Body, Controller, HttpCode, Query, Request, Post } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { requireApiKey } from '../common/auth';
import { CreateMetricDto } from './dto/create-metric.dto';

@Controller('metrics')
export class MetricsController {
	constructor(private readonly metricsService: MetricsService) {}

	@Post()
	@HttpCode(200)
	create(@Request() req, @Body() createStepDto: CreateMetricDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = requireApiKey(req, apiKeyParam);
		return this.metricsService.create(createStepDto, apiKey);
	}
}
