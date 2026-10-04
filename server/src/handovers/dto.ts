import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateHandoverDto {
  /** 可选：显式声明要办理的环节；与当前应办环节不符时按“交接顺序错误”拒绝 */
  @IsOptional()
  @IsIn(['SAMPLER_TO_COURIER', 'COURIER_TO_LAB', 'LAB_RECEIVE'])
  type?: string;

  @IsInt({ message: '接收人 toUserId 必须是整数' })
  toUserId: number;

  @IsBoolean({ message: '必须确认封签是否完好（sealIntact）' })
  sealIntact: boolean;

  @IsOptional()
  @IsBoolean()
  coldChainOk?: boolean;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
