import { Injectable } from '@nestjs/common';
import { CreateShowDto } from './dto/create-show.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as _ from 'lodash';

@Injectable()
export class ShowsService {
  constructor(private configService: ConfigService) {}

  randomDate(start, end) {
    end = _.isUndefined(end) ? new Date() : new Date(end);
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
  }

  async create(createShowDto: CreateShowDto, headers: any) {
    if (_.isEmpty(createShowDto.title)) {
      return { error: 'Title cannot be blank' };
    }
    let newShow = {};
    let viewingDate = new Date();
    let showDetails: any = await axios.get(
      `http://www.omdbapi.com/?t=${
        createShowDto.title
      }&apikey=${this.configService.get<string>('OMDB')}`,
    );
    if (!_.isEmpty(createShowDto.date)) {
      viewingDate = new Date(createShowDto.date);
    } else if (!_.isEmpty(createShowDto.startDate)) {
      viewingDate = this.randomDate(
        new Date(createShowDto.startDate),
        createShowDto.endDate,
      );
    }
    if (showDetails) {
      try {
        showDetails = showDetails.data;
        newShow = {
          title: `${showDetails.Title} Season ${createShowDto.seasonNumber}`,
          seasonNumber: createShowDto.seasonNumber,
          showName: showDetails.Title,
          description: showDetails.Plot,
          language: 'English',
          year: Number(
            showDetails.Year.includes('–')
              ? showDetails.Year.split('–')[0]
              : showDetails.Year,
          ),
          genre: showDetails.Genre,
          startedDate: viewingDate,
          status: 'Started',
          imdbRating: Number(
            _.get(showDetails.Ratings[0], 'Value').split('/')[0],
          ),
          imdbId: showDetails.imdbID,
          loved: createShowDto.loved || true,
        };
        console.log(newShow);
        const config = {
          headers: {
            authorization: headers.authorization,
          },
        };
        const showCreated = await axios.post(
          'https://systemapi.prod.ashish.me/shows',
          newShow,
          config,
        );
        return showCreated.data;
      } catch (e) {
        await axios.post('https://systemapi.prod.ashish.me/events', {
          type: 'create_show_failed',
          message: createShowDto.title,
        });
        return { error: `Failed to create show - ${e}` };
      }
    } else {
      await axios.post('https://systemapi.prod.ashish.me/events', {
        type: 'create_show_failed',
        message: createShowDto.title,
      });
      return { error: 'Show not found' };
    }
  }
}
