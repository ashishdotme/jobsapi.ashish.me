import { Controller, Post, Body, Request } from '@nestjs/common';
import { ShowsService } from './shows.service';
import { CreateShowDto } from './dto/create-show.dto';

@Controller('shows')
export class ShowsController {
  constructor(private readonly showsService: ShowsService) {}

  @Post()
  create(@Body() createShowDto: CreateShowDto, @Request() req) {
    return this.showsService.create(createShowDto, req.headers);
  }
}
