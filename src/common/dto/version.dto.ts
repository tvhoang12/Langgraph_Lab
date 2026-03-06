import { Version } from '../enums/version.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { LocaleDto } from './locale.dto';

export class VersionDto {
  @ApiProperty({ enum: Version, enumName: 'Version' })
  @IsIn(Object.values(Version))
  version: Version;
}

export class VersionLocaleDto extends LocaleDto {
  @ApiProperty({ enum: Version, enumName: 'Version' })
  @IsIn(Object.values(Version))
  version: Version;
}
