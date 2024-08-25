import { Injectable } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import * as _ from 'lodash';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MoviesService {
  constructor(private configService: ConfigService) {}

  randomDate(start, end) {
    end = _.isUndefined(end) ? new Date() : new Date(end);
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
  }

  async create(createMovieDto: CreateMovieDto, headers: any) {
    if (_.isEmpty(createMovieDto.title)) {
      return { error: 'Title cannot be blank' };
    }

    let viewingDate = new Date(createMovieDto.date || createMovieDto.startDate || Date.now());
    if (!_.isEmpty(createMovieDto.startDate) && _.isEmpty(createMovieDto.date)) {
      viewingDate = this.randomDate(new Date(createMovieDto.startDate), createMovieDto.endDate);
    }

    try {
      const movieDetailsResponse = await axios.get(
        `http://www.omdbapi.com/?t=${createMovieDto.title}&apikey=${this.configService.get<string>('OMDB')}`
      );

      const movieDetails = movieDetailsResponse.data;
      const newMovie = {
        title: movieDetails.Title,
        description: movieDetails.Plot,
        language: 'English',
        year: Number(movieDetails.Year),
        genre: movieDetails.Genre,
        viewingDate: viewingDate,
        imdbRating: Number(_.get(movieDetails.Ratings[0], 'Value').split('/')[0]),
        imdbId: movieDetails.imdbID,
        loved: createMovieDto.loved || true,
      };

      const config = {
        headers: {
          apiKey: headers.apikey,
        },
      };

      const movieCreated = await axios.post('https://api.ashish.me/movies', newMovie, config);
      return movieCreated.data;
    } catch (e) {
      await axios.post('https://api.ashish.me/events', {
        type: 'create_movie_failed',
        message: createMovieDto.title,
      });
      return { error: `Failed to create movie - ${e.message}` };
    }
  }
}
