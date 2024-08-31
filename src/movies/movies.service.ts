import { Injectable } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import * as _ from 'lodash';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { sendEvent, fetchDetailsFromOmdb, fetchDetailsFromImdb } from '../common/utils';

@Injectable()
export class MoviesService {
  private OMDB_APIKEY: string = this.configService.get<string>('OMDB');

  constructor(private configService: ConfigService) {}

  randomDate(start, end) {
    end = _.isUndefined(end) ? new Date() : new Date(end);
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
  }

  async create(createMovieDto: CreateMovieDto, apikey: string): Promise<any> {
    if (_.isEmpty(createMovieDto.title)) {
      return { error: 'Title cannot be blank' };
    }

    const viewingDate = this.calculateViewingDate(createMovieDto);
    try {

      let movieDetails = await fetchDetailsFromImdb(
        createMovieDto.title
      );
      let moviePayload = {}


      if(!movieDetails){
        movieDetails = await fetchDetailsFromOmdb(
          createMovieDto.title,
          this.OMDB_APIKEY,
        );
        moviePayload = this.buildNewMoviePayloadFromOmdb(
          createMovieDto,
          movieDetails,
          viewingDate,
        );
      } else {
        moviePayload = this.buildNewMoviePayloadFromImdb(
          createMovieDto,
          movieDetails,
          viewingDate,
        );
      }


      if (!movieDetails) {
        await sendEvent('create_movie_failed', createMovieDto.title);
        return { error: `Failed to create movie - Movie not found` };
      }

      console.log(moviePayload)
      return await this.postNewMovie(moviePayload, apikey);
    } catch (e) {
      await sendEvent('create_movie_failed', createMovieDto.title);
      return { error: `Failed to create movie - ${e.message}` };
    }
  }

  private calculateViewingDate(createMovieDto: CreateMovieDto): Date {
    let viewingDate = new Date(
      createMovieDto.date || createMovieDto.startDate || Date.now(),
    );
    if (
      !_.isEmpty(createMovieDto.startDate) &&
      _.isEmpty(createMovieDto.date)
    ) {
      viewingDate = this.randomDate(
        new Date(createMovieDto.startDate),
        createMovieDto.endDate,
      );
    }
    return viewingDate;
  }

  private buildNewMoviePayloadFromOmdb(
    createMovieDto: CreateMovieDto,
    movieDetails: any,
    viewingDate: Date,
  ): any {
    return {
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
  }

  private buildNewMoviePayloadFromImdb(
    createMovieDto: CreateMovieDto,
    movieDetails: any,
    viewingDate: Date,
  ): any {
    return {
      title: movieDetails.title,
      description: movieDetails.plot,
      language: movieDetails.spokenLanguages[0].language,
      year: Number(movieDetails.year),
      genre: movieDetails.genre.join(", "),
      viewingDate: viewingDate,
      imdbRating: Number(movieDetails.rating.star),
      imdbId: movieDetails.id,
      loved: createMovieDto.loved || true,
    };
  }

  private async postNewMovie(newMovie: any, apikey: string): Promise<any> {
    const config = {
      headers: {
        apiKey: apikey,
      },
    };
    const response = await axios.post(
      'https://api.ashish.me/movies',
      newMovie,
      config,
    );
    return response.data;
  }
}
