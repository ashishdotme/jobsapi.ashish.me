import { Module } from '@nestjs/common';
import { MoviesModule } from '../movies/movies.module';
import { BulkImportController, OpsJobsController } from './bulk-import.controller';
import { BulkImportDbService } from './bulk-import.db.service';
import { BulkImportRepository } from './bulk-import.repository';
import { BulkImportService } from './bulk-import.service';

@Module({
	imports: [MoviesModule],
	controllers: [BulkImportController, OpsJobsController],
	providers: [BulkImportDbService, BulkImportRepository, BulkImportService],
})
export class BulkImportModule {}
