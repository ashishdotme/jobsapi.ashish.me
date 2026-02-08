import { Controller, Request, Post, Body, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiSecurity } from '@nestjs/swagger';
import { API_KEY_MISSING_MESSAGE, extractApiKey } from '../common/auth';

@Controller('movies')
@ApiTags('movies')
@ApiSecurity('apiKey')
export class MoviesController {
	constructor(private readonly moviesService: MoviesService) {}

	@Post()
	create(@Request() req, @Body() createMovieDto: CreateMovieDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: API_KEY_MISSING_MESSAGE };
		}
		return this.moviesService.create(createMovieDto, apiKey);
	}
}
