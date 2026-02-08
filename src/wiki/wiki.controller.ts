import { Controller, Request, Post, Body, Query } from '@nestjs/common';
import { WikiService } from './wiki.service';
import { CreateWikiDto } from './dto/create-wiki.dto';
import { API_KEY_MISSING_MESSAGE, extractApiKey } from '../common/auth';

@Controller('wiki')
export class WikiController {
	constructor(private readonly wikiService: WikiService) {}

	@Post()
	create(@Request() req, @Body() createWikiDto: CreateWikiDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: API_KEY_MISSING_MESSAGE };
		}
		return this.wikiService.create(createWikiDto, apiKey);
	}
}
