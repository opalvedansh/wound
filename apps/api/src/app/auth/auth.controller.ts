import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login user with email and password' })
  @ApiResponse({ status: 200, description: 'Return auth token.' })
  async login(@Body() loginDto: any) {
    return this.authService.login(loginDto);
  }

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  async signup(@Body() signupDto: any) {
    return this.authService.signup(signupDto);
  }

  @Post('otp/request')
  @ApiOperation({ summary: 'Request an OTP for login' })
  @ApiResponse({ status: 200, description: 'OTP sent.' })
  async requestOtp(@Body() otpRequestDto: any) {
    return this.authService.requestOtp(otpRequestDto);
  }

  @Post('password-reset/request')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset link sent.' })
  async requestPasswordReset(@Body() resetDto: any) {
    return this.authService.requestPasswordReset(resetDto);
  }
}
