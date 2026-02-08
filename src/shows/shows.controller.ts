import { Controller, Post, Body, Request, Query } from '@nestjs/common';
import { ShowsService } from './shows.service';
import { CreateShowDto } from './dto/create-show.dto';
import { API_KEY_MISSING_MESSAGE, extractApiKey } from '../common/auth';

@Controller('shows')
export class ShowsController {
	constructor(private readonly showsService: ShowsService) {}

	@Post()
	create(@Body() createShowDto: CreateShowDto, @Request() req, @Query('apikey') apiKeyParam: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: API_KEY_MISSING_MESSAGE };
		}

		return this.showsService.create(createShowDto, apiKey);
	}
}
