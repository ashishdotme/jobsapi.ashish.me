import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ListensService } from './listens.service';
import { CreateListenDto } from './dto/create-listen.dto';
import { GetUserListensDto } from './dto/get-user-listens.dto';
import { ApiTags } from '@nestjs/swagger';

@Controller('/1')
@ApiTags('listens')
export class ListensController {
	constructor(private readonly listensService: ListensService) {}

	@Get('validate-token')
	@HttpCode(200)
	validateToken() {
		return {
			code: 200,
			message: 'Token valid',
			valid: true,
		};
	}

	@Post('submit-listens')
	create(@Body() createListenDto: CreateListenDto) {
		return this.listensService.create(createListenDto);
	}

	@Get('user/:user/listens')
	getUserListens(@Param('user') user: string, @Query() query: GetUserListensDto) {
		return this.listensService.getUserListens(user, query);
	}
}
