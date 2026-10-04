import { IsIn, IsOptional, IsString } from 'class-validator';

export class DecisionDto {
  @IsIn(['PUBLISH', 'RETEST', 'ARCHIVE'])
  type!: 'PUBLISH' | 'RETEST' | 'ARCHIVE';

  @IsString()
  @IsOptional()
  reason?: string;
}
