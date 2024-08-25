import {
  ApiProperty,
} from '@nestjs/swagger';


export class CreateShowDto {
  @ApiProperty()
  title: string

  @ApiProperty()
  date?: string

  @ApiProperty()
  seasonNumber?: number

  @ApiProperty()
  startDate?: string

  @ApiProperty()
  endDate?: string

  @ApiProperty()
  loved?: boolean
}
