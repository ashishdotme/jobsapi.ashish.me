import { Controller, Get, Query, Req } from '@nestjs/common';
import { requireApiKey } from '../common/auth';
import { UpdatesBridgeService } from './updates-bridge.service';

@Controller('ops/updates')
export class UpdatesBridgeOpsController {
	constructor(private readonly updatesBridgeService: UpdatesBridgeService) {}

	@Get('overview')
	async getOverview(@Req() req: any) {
		requireApiKey(req);
		return this.updatesBridgeService.getOverview();
	}

	@Get('posts')
	async getRecentPosts(@Req() req: any, @Query('limit') limit?: string) {
		requireApiKey(req);
		const parsedLimit = Number.parseInt(limit ?? '20', 10);
		const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
		return this.updatesBridgeService.getRecentPosts(safeLimit);
	}
}
