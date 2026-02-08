import { Controller, Post, Request, Body, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { API_KEY_MISSING_MESSAGE, extractApiKey } from '../common/auth';

@Controller('locations')
export class LocationsController {
	constructor(private readonly locationsService: LocationsService) {}

	@Post()
	create(@Request() req, @Body() createLocationDto: CreateLocationDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: API_KEY_MISSING_MESSAGE };
		}
		return this.locationsService.create(createLocationDto, apiKey);
	}
}
