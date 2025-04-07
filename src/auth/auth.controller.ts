import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MerchantAuthDto } from './dto/merchant-auth.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Authenticate merchant and get JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Returns JWT token for authenticated merchant',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid merchant credentials' })
  @HttpCode(200)
  @Post('login')
  async login(@Body() authDto: MerchantAuthDto) {
    return this.authService.login(authDto.merchantId, authDto.merchantKey);
  }
}
