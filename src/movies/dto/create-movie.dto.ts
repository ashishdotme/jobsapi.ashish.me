import { ApiProperty } from "@nestjs/swagger";

export class CreateMovieDto {
	@ApiProperty()
	title: string;

	@ApiProperty()
	date?: string;

	@ApiProperty()
	startDate?: string;

	@ApiProperty()
	endDate?: string;

	@ApiProperty()
	loved?: boolean;
}
