import { Module } from '@nestjs/common';
import { BlueskyClientService } from './bluesky-client.service';
import { ThreadsAuthService } from './threads-auth.service';
import { ThreadsClientService } from './threads-client.service';
import { UpdatesApiClient } from './updates-api.client';
import { UpdatesBridgeController } from './updates-bridge.controller';
import { UpdatesBridgeDbService } from './updates-bridge.db.service';
import { UpdatesBridgeOpsController } from './updates-bridge-ops.controller';
import { UpdatesBridgeRepository } from './updates-bridge.repository';
import { UpdatesBridgeScheduler } from './updates-bridge.scheduler';
import { UpdatesBridgeService } from './updates-bridge.service';

@Module({
	controllers: [UpdatesBridgeController, UpdatesBridgeOpsController],
	providers: [
		UpdatesBridgeDbService,
		UpdatesBridgeRepository,
		ThreadsClientService,
		BlueskyClientService,
		UpdatesApiClient,
		ThreadsAuthService,
		UpdatesBridgeService,
		UpdatesBridgeScheduler,
	],
})
export class UpdatesBridgeModule {}
