import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MoviesModule } from './movies/movies.module';
import { ShowsModule } from './shows/shows.module';
import { ConfigModule } from '@nestjs/config';
import { ListensModule } from './listens/listens.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WikiModule } from './wiki/wiki.module';
import { MetricsModule } from './metrics/metrics.module';
import { LocationsModule } from './locations/locations.module';
import { TasksModule } from './tasks/tasks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BulkImportModule } from './bulk-import/bulk-import.module';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoHttpConfig } from './logging/logger.config';
import { UpdatesBridgeModule } from './updates-bridge/updates-bridge.module';
import { TodosWorkspaceModule } from './todos-workspace/todos-workspace.module';

@Module({
	imports: [
		LoggerModule.forRoot({
			pinoHttp: buildPinoHttpConfig({
				nodeEnv: process.env.NODE_ENV || 'development',
				logLevel: process.env.LOG_LEVEL || 'info',
				serviceName: process.env.SERVICE_NAME || 'jobsapi.ashish.me',
			}),
		}),
		MoviesModule,
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		ScheduleModule.forRoot(),
		ShowsModule,
		ListensModule,
		TransactionsModule,
		WikiModule,
		MetricsModule,
		LocationsModule,
		TasksModule,
		BulkImportModule,
		UpdatesBridgeModule,
		TodosWorkspaceModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
