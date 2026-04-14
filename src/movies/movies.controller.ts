import { Controller, Request, Post, Body, Query, Get } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiSecurity } from '@nestjs/swagger';
import { requireApiKey } from '../common/auth';

@Controller('movies')
@ApiTags('movies')
@ApiSecurity('apiKey')
export class MoviesController {
	constructor(private readonly moviesService: MoviesService) {}

	@Get()
	list(@Request() req, @Query('apikey') apiKeyParam: string) {
		const apiKey = requireApiKey(req, apiKeyParam);
		return this.moviesService.list(apiKey);
	}

	@Post()
	create(@Request() req, @Body() createMovieDto: CreateMovieDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = requireApiKey(req, apiKeyParam);
		return this.moviesService.create(createMovieDto, apiKey);
	}
}
