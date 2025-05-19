// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSession } from 'src/users/entities/user-session.entity';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserSession)
    private userSessionsRepository: Repository<UserSession>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(data: SignUpDto) {
    const user = await this.usersService.create(data);
    const tokens = this.generateToken(user.id, user.email, user.role);
    const hashed = await bcrypt.hash(tokens.refresh_token, 10);
    await this.userSessionsRepository.save({
      user,
      hashedRefreshToken: hashed,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return tokens;
  }

  async signin(data: SignInDto) {
    const { email, password } = data;
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.generateToken(user.id, user.email, user.role);
    const hashed = await bcrypt.hash(tokens.refresh_token, 10);
    await this.userSessionsRepository.save({
      user,
      hashedRefreshToken: hashed,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return tokens;
  }

  async validateOAuthLogin(profile: any) {
    console.log('profile', profile);
    let user = await this.usersService.findByGoogleId(profile.id);

    if (!user) {
      user = await this.usersService.createGoogleUser({
        googleId: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
      });
    }
    return this.generateToken(user.id, user.email, user.role);
  }

  async refreshToken(refresh_token: string) {
    const payload = this.jwtService.verify(refresh_token, {
      secret: this.configService.get<string>('SECRET_KEY'),
    });
    const sessions = await this.userSessionsRepository.find({
      where: { user: { id: payload.sub } },
      relations: ['user'],
    });

    const session = sessions.find((s) =>
      bcrypt.compareSync(refresh_token, s.hashedRefreshToken),
    );
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.generateToken(
      payload.sub,
      payload.email,
      payload.role,
    );
    session.hashedRefreshToken = await bcrypt.hash(tokens.refresh_token, 10);
    await this.userSessionsRepository.save(session);

    return tokens;
  }

  private generateToken(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('SECRET_KEY'),
      expiresIn: '1h',
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('SECRET_KEY'),
      expiresIn: '7d',
    });
    return { access_token, refresh_token };
  }
}
