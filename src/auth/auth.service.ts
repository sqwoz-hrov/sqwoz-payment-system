import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MerchantsService } from '../merchants/merchants.service';

type TokenPayload = {
  merchantId: string;
  merchantKey: string;
  name: string;
};
@Injectable()
export class AuthService {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly jwtService: JwtService,
  ) {}

  async validateMerchant(merchantId: string, merchantKey: string) {
    const merchant = await this.merchantsService.findByIdAndKey(
      merchantId,
      merchantKey,
    );

    if (!merchant) {
      throw new UnauthorizedException('Invalid merchant credentials');
    }

    return merchant;
  }

  async login(merchantId: string, merchantKey: string) {
    // Validate the merchant credentials
    const merchant = await this.validateMerchant(merchantId, merchantKey);

    // Generate JWT payload
    const payload = {
      merchantId: merchant.id,
      merchantKey: merchant.key,
      name: merchant.name,
    };

    // Generate and return the JWT token
    return {
      access_token: this.jwtService.sign(payload),
      merchant: {
        id: merchant.id,
        name: merchant.name,
      },
    };
  }

  validateToken(token: string) {
    try {
      const payload: TokenPayload = this.jwtService.verify(token);
      return payload;
    } catch (error: any) {
      console.log('Token validation error:', error.message);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
