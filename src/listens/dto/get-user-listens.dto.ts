import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

const toOptionalInt = ({ value }: { value: unknown }) => {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	return Number(value);
};

export class GetUserListensDto {
	@IsOptional()
	@Transform(toOptionalInt)
	@IsInt()
	@Min(1)
	count?: number;

	@IsOptional()
	@Transform(toOptionalInt)
	@IsInt()
	@Min(0)
	min_ts?: number;

	@IsOptional()
	@Transform(toOptionalInt)
	@IsInt()
	@Min(0)
	max_ts?: number;
}
