import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MoviesModule } from './movies/movies.module';
import { ShowsModule } from './shows/shows.module';
import { ConfigModule } from '@nestjs/config';
import { ListensModule } from './listens/listens.module';

@Module({
  imports: [
    MoviesModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ShowsModule,
    ListensModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
