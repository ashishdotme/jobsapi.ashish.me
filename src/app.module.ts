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

@Module({
	imports: [
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
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
