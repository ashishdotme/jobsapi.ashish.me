import { Controller, Post, Body, Query, Request, Get, HttpCode } from '@nestjs/common';
import { ListensService } from './listens.service';
// import { CreateListenDto } from './dto/create-listen.dto';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';
import { ok } from 'assert';

@Controller('/1')
@ApiTags('listens')
@ApiSecurity('apiKey')
export class ListensController {
  constructor(private readonly listensService: ListensService) {}

  @Get("validate-token")
  @HttpCode(200)
  validateToken(
    @Request() req,
    @Body() createListeDto: any,
    @Query('apikey') apiKeyParam: string,
  ) {
    return {
			code: 200,
			message: 'Token valid',
			valid: true
		}
  }

  @Post("submit-listens")
  create(
    @Request() req,
    @Body() createListeDto: any,
    @Query('apikey') apiKeyParam: string,
  ) {
    console.log(createListeDto)
  }
}
