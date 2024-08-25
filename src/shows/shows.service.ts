import { Injectable } from '@nestjs/common';
import { CreateShowDto } from './dto/create-show.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class ShowsService {
  constructor(private configService: ConfigService) {}

  randomDate(start, end) {
    end = end ? new Date(end) : new Date();
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
  }

  private async fetchShowDetails(title: string): Promise<any> {
    try {
      const response = await axios.get(
        `http://www.omdbapi.com/?t=${title}&apikey=${this.configService.get<string>('OMDB')}`,
      );
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch show details');
    }
  }

  private buildNewShow(createShowDto: CreateShowDto, showDetails: any, viewingDate: Date): any {
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
      showDetails = await this.fetchShowDetails(createShowDto.title);
    } catch (error) {
      await this.logEvent('create_show_failed', createShowDto.title);
      return { error: error.message };
    }
    if (!createShowDto.date && createShowDto.startDate) {
      viewingDate = this.randomDate(new Date(createShowDto.startDate), createShowDto.endDate);
    }

    const newShow = this.buildNewShow(createShowDto, showDetails, viewingDate);

    try {
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
    } catch (error) {
      await this.logEvent('create_show_failed', createShowDto.title);
      return { error: `Failed to create show - ${error.message}` };
    }
  }

  private async logEvent(type: string, message: string): Promise<void> {
    await axios.post('https://systemapi.prod.ashish.me/events', {
      type,
      message,
    });
  }
}
