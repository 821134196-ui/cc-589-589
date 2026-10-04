import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/** 负责人审核决定 */
export class DecisionDto {
  @IsIn(['RETEST', 'ARCHIVE'], { message: 'action 只能是 RETEST 或 ARCHIVE' })
  action: 'RETEST' | 'ARCHIVE';

  @IsOptional()
  @IsString()
  note?: string;
}

/** 样品列表查询 */
export class SampleQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  wellId?: number;
}
