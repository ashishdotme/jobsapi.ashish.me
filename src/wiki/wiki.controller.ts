import { Controller, Request, Post, Body, Query } from '@nestjs/common';
import { WikiService } from './wiki.service';
import { CreateWikiDto } from './dto/create-wiki.dto';

@Controller('wiki')
export class WikiController {
	constructor(private readonly wikiService: WikiService) {}

	@Post()
	create(@Request() req, @Body() createWikiDto: CreateWikiDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = apiKeyParam || req.headers.apikey;
		if (!apiKey) {
			return { error: 'Apikey cannot be blank' };
		}
		return this.wikiService.create(createWikiDto, apiKey);
	}
}
