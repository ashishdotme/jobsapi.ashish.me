import { Injectable } from '@nestjs/common';
// import { CreateListenDto } from './dto/create-listen.dto';

@Injectable()
export class ListensService {
  create(createListenDto: any, apikey: string) {
    console.log(createListenDto, apikey);
  }
}
