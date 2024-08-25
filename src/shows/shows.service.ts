import { Injectable } from '@nestjs/common';
import { CreateShowDto } from './dto/create-show.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { sendEvent, fetchDetailsFromOmdb} from '../common/utils'

@Injectable()
export class ShowsService {
  constructor(private configService: ConfigService) {}

  randomDate(start, end) {
    end = end ? new Date(end) : new Date();
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
  }


  private buildShowPayload(createShowDto: CreateShowDto, showDetails: any, viewingDate: Date): any {
    return {
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
      imdbRating: Number(showDetails.Ratings?.[0]?.Value?.split('/')[0] ?? 0),
      imdbId: showDetails.imdbID,
      loved: createShowDto.loved || true,
    };
  }

  async create(createShowDto: CreateShowDto, headers: any) {
    if (!createShowDto.title) {
      return { error: 'Title cannot be blank' };
    }
    let viewingDate = createShowDto.date ? new Date(createShowDto.date) : new Date();
    let showDetails: any;

    try {
      showDetails = await fetchDetailsFromOmdb(createShowDto.title);
    } catch (error) {
      await sendEvent('create_show_failed', createShowDto.title);
      return { error: error.message };
    }
    if (!createShowDto.date && createShowDto.startDate) {
      viewingDate = this.randomDate(new Date(createShowDto.startDate), createShowDto.endDate);
    }

    const shoywPayload = this.buildShowPayload(createShowDto, showDetails, viewingDate);

    try {
      const config = {
        headers: {
          apiKey: headers.apikey,
        },
      };
      const showCreated = await axios.post(
        'https://api.ashish.me/shows',
        shoywPayload,
        config,
      );
      return showCreated.data;
    } catch (error) {
      await sendEvent('create_show_failed', createShowDto.title);
    }
  }


}
