import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MoviesModule } from './movies/movies.module';
import { ShowsModule } from './shows/shows.module';
import { ConfigModule } from '@nestjs/config';
import { ListensModule } from './listens/listens.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WikiModule } from './wiki/wiki.module';

@Module({
	imports: [
		MoviesModule,
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		ShowsModule,
		ListensModule,
		TransactionsModule,
		WikiModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
