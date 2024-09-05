import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional } from "@nestjs/class-validator";

export class CreateTransactionDto {
	@ApiProperty()
	@IsNotEmpty()
	transaction: string;

	@ApiProperty()
	@IsOptional()
	readonly date?: Date;
}
