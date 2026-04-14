import { Controller, Post, Body, Request, Query, Get } from '@nestjs/common';
import { ShowsService } from './shows.service';
import { CreateShowDto } from './dto/create-show.dto';
import { requireApiKey } from '../common/auth';

@Controller('shows')
export class ShowsController {
	constructor(private readonly showsService: ShowsService) {}

	@Get()
	list(@Request() req, @Query('apikey') apiKeyParam: string) {
		const apiKey = requireApiKey(req, apiKeyParam);
		return this.showsService.list(apiKey);
	}

	@Post()
	create(@Body() createShowDto: CreateShowDto, @Request() req, @Query('apikey') apiKeyParam: string) {
		const apiKey = requireApiKey(req, apiKeyParam);
		return this.showsService.create(createShowDto, apiKey);
	}
}
