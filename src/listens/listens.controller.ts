import { Controller, Post, Body, Request, Get, HttpCode } from '@nestjs/common';
import { ListensService } from './listens.service';
import { CreateListenDto } from './dto/create-listen.dto';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';
import { API_KEY_MISSING_MESSAGE, extractTokenApiKey } from '../common/auth';

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
		const apiKey = extractTokenApiKey(req);
		if (!apiKey) {
			return { error: API_KEY_MISSING_MESSAGE };
		}
		return this.listensService.create(createListenDto, apiKey);
	}
}
