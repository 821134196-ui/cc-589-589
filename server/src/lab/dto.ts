import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class LabResultDto {
  @IsInt()
  sampleId: number;

  @IsObject({ message: 'parameters 必须是对象，如 {"pH":"7.2"}' })
  parameters: Record<string, unknown>;

  @IsIn(['NORMAL', 'ABNORMAL'], { message: 'conclusion 只能是 NORMAL 或 ABNORMAL' })
  conclusion: 'NORMAL' | 'ABNORMAL';

  @IsOptional()
  @IsString()
  operator?: string;
}

export class LabRejectDto {
  @IsInt()
  sampleId: number;

  @IsString()
  @IsNotEmpty({ message: '退样必须填写原因' })
  reason: string;
}

export class LabCorrectDto {
  @IsObject()
  parameters: Record<string, unknown>;

  @IsIn(['NORMAL', 'ABNORMAL'])
  conclusion: 'NORMAL' | 'ABNORMAL';

  @IsString()
  @IsNotEmpty({ message: '更正必须填写说明' })
  note: string;
}
