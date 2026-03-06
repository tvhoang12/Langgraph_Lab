import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';
import { LocaleDto } from './locale.dto';

export class DateDto extends LocaleDto {
  @ApiProperty()
  @IsDate({ message: 'INVALID_VALUE' })
  @Type(() => Date)
  date: Date;
}
