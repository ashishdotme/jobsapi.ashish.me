import { Controller, Request, Post, Body } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import {
  ApiTags,
} from '@nestjs/swagger';
import { ApiSecurity } from '@nestjs/swagger';

@Controller('movies')
@ApiTags('movies')
@ApiSecurity('apiKey')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  create(@Request() req, @Body() createMovieDto: CreateMovieDto, ) {
    console.log(req.headers)
    console.log(req.headers.apikey)
    return this.moviesService.create(createMovieDto, req.headers);
  }
}
