import { Controller, Request, Post, Body, Query } from '@nestjs/common';
import { WikiService } from './wiki.service';
import { CreateWikiDto } from './dto/create-wiki.dto';
import { requireApiKey } from '../common/auth';

@Controller('wiki')
export class WikiController {
	constructor(private readonly wikiService: WikiService) {}

	@Post()
	create(@Request() req, @Body() createWikiDto: CreateWikiDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = requireApiKey(req, apiKeyParam);
		return this.wikiService.create(createWikiDto, apiKey);
	}
}
