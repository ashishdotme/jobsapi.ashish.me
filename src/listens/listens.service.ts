import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CreateListenDto } from './dto/create-listen.dto';
import { sendEvent } from 'src/common/utils';

@Injectable()
export class ListensService {
  async create(createListenDto: any, apikey: string) {
    try {
      const payload = this.buildNewListenPayload(createListenDto);
      return await this.postNewListen(payload, apikey);
    } catch (e) {
      await sendEvent(
        'create_listen_failed',
        createListenDto.payload[0].track_metadata.track_name,
      );
      return { error: `Failed to create listen - ${e.message}` };
    }
  }

  private buildNewListenPayload(createListenDto: CreateListenDto): any {
    return {
      title: createListenDto.payload[0].track_metadata.track_name,
      album: createListenDto.payload[0].track_metadata.release_name,
      artist: createListenDto.payload[0].track_metadata.artist_name,
      listenDate: new Date(
        createListenDto.payload[0].listened_at * 1000,
      ).toISOString(),
    };
  }

  private async postNewListen(newListen: any, apikey: string): Promise<any> {
    const config = {
      headers: {
        apiKey: apikey,
      },
    };
    const response = await axios.post(
      'https://api.ashish.me/listens',
      newListen,
      config,
    );
    return response.data;
  }
}
