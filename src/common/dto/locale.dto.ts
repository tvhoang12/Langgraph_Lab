import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Locale } from '../enums/locale.enum';

export class LocaleDto {
  @ApiProperty({ enum: Locale, enumName: 'Locale' })
  @IsIn(Object.values(Locale))
  locale: Locale;
}
