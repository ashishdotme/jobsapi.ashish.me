import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UpdatesBridgeService } from './updates-bridge.service';

@Injectable()
export class UpdatesBridgeScheduler {
	constructor(private readonly updatesBridgeService: UpdatesBridgeService) {}

	@Cron('*/5 * * * *')
	async handleCron() {
		await this.updatesBridgeService.runScheduledSync();
	}
}
