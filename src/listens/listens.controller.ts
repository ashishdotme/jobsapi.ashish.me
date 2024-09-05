import { Controller, Post, Body, Request, Get, HttpCode } from '@nestjs/common';
import { ListensService } from './listens.service';
import { CreateListenDto } from './dto/create-listen.dto';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';

@Controller('/1')
@ApiTags('listens')
@ApiSecurity('apiKey')
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
	create(@Request() req, @Body() createListenDto: CreateListenDto) {
		if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Token') {
			const apiKey = req.headers.authorization.split(' ')[1];
			return this.listensService.create(createListenDto, apiKey);
		}
	}
}
