import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  async login(loginDto: any) {
    throw new NotImplementedException('Login not implemented');
  }

  async signup(signupDto: any) {
    throw new NotImplementedException('Signup not implemented');
  }

  async requestOtp(otpRequestDto: any) {
    throw new NotImplementedException('OTP request not implemented');
  }

  async requestPasswordReset(resetDto: any) {
    throw new NotImplementedException('Password reset request not implemented');
  }
}
