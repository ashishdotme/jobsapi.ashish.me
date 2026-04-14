import { Controller, Post, Request, Body, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { requireApiKey } from '../common/auth';

@Controller('locations')
export class LocationsController {
	constructor(private readonly locationsService: LocationsService) {}

	@Post()
	create(@Request() req, @Body() createLocationDto: CreateLocationDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = requireApiKey(req, apiKeyParam);
		return this.locationsService.create(createLocationDto, apiKey);
	}
}
