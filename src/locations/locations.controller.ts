import { Controller, Post, Request, Body, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';

@Controller('locations')
export class LocationsController {
	constructor(private readonly locationsService: LocationsService) {}

	@Post()
	create(@Request() req, @Body() createLocationDto: CreateLocationDto, @Query('apikey') apiKeyParam: string) {
    const apiKey = apiKeyParam || req.headers.apikey;
		if (!apiKey) {
			return { error: 'Apikey cannot be blank' };
		}
		console.log(JSON.stringify(createLocationDto));
		return this.locationsService.create(createLocationDto, apiKey);
	}
}
