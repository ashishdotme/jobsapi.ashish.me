import { Controller, Request, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiSecurity } from '@nestjs/swagger';

@Controller('movies')
@ApiTags('movies')
@ApiSecurity('apiKey')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  create(
    @Request() req,
    @Body() createMovieDto: CreateMovieDto,
    @Query('apikey') apiKeyParam: string,
  ) {
    const apiKey = apiKeyParam || req.headers.apikey;
    if(!apiKey){
      return { error: 'Apikey cannot be blank' };
    }
    return this.moviesService.create(createMovieDto, apiKey);
  }
}
