import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TodosWorkspaceController } from './todos-workspace.controller';
import { TodosUpstreamClient } from './todos-upstream.client';
import { TodosWorkspaceService } from './todos-workspace.service';

@Module({
	imports: [ConfigModule],
	controllers: [TodosWorkspaceController],
	providers: [TodosWorkspaceService, TodosUpstreamClient],
	exports: [TodosUpstreamClient],
})
export class TodosWorkspaceModule {}
