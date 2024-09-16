import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CreateWikiDto {
	@ApiProperty()
	@IsNotEmpty()
	memo: any;
}
