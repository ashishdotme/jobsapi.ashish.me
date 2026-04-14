import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { requireApiKey } from '../common/auth';
import { ThreadsAuthService } from './threads-auth.service';

@Controller('auth/threads')
export class UpdatesBridgeController {
	constructor(private readonly threadsAuthService: ThreadsAuthService) {}

	@Post('start')
	async startThreadsAuth(@Req() req: any, @Body('returnTo') returnTo?: string) {
		requireApiKey(req);
		const authorizationUrl = await this.threadsAuthService.createAuthorizationUrl(returnTo);
		return { authorizationUrl };
	}

	@Get('callback')
	async handleThreadsCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
		const redirectUrl = await this.threadsAuthService.handleCallback(code, state);
		return res.redirect(redirectUrl);
	}
}
