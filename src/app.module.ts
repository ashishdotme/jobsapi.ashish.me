import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MoviesModule } from './movies/movies.module';
import { ShowsModule } from './shows/shows.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [MoviesModule, ConfigModule.forRoot({
    isGlobal: true,
  }), ShowsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
