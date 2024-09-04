import { Module } from '@nestjs/common';
import { ListensService } from './listens.service';
import { ListensController } from './listens.controller';

@Module({
  controllers: [ListensController],
  providers: [ListensService],
})
export class ListensModule {}
