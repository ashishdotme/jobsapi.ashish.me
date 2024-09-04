import { Controller, Post, Body, Query, Request } from '@nestjs/common';
import { ListensService } from './listens.service';
// import { CreateListenDto } from './dto/create-listen.dto';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';

@Controller('/apis/listenbrainz')
@ApiTags('listens')
@ApiSecurity('apiKey')
export class ListensController {
  constructor(private readonly listensService: ListensService) {}

  @Post()
  create(
    @Request() req,
    @Body() createListeDto: any,
    @Query('apikey') apiKeyParam: string,
  ) {
    const apiKey = apiKeyParam || req.headers.apikey;
    if (!apiKey) {
      return { error: 'Apikey cannot be blank' };
    }
    return this.listensService.create(createListeDto, apiKey);
  }
}
