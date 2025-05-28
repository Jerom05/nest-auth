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
import { User } from 'src/users/entities/user.entity';

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
    return this.generateToken(user);
  }

  async signin(data: SignInDto) {
    const { email, password } = data;
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    return this.generateToken(user);
  }

  async validateOAuthLogin(profile: any) {
    let user = await this.usersService.findByGoogleId(profile.id);

    if (!user) {
      user = await this.usersService.createGoogleUser({
        googleId: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
      });
    }
    return user;
  }

  async refreshToken(refresh_token: string) {
    const payload = this.jwtService.verify(refresh_token, {
      secret: this.configService.get<string>('SECRET_KEY'),
    });
    const sessions = await this.userSessionsRepository.find({
      where: { user: { id: payload.userId } },
      relations: ['user'],
    });

    const session = sessions.find((s) =>
      bcrypt.compareSync(refresh_token, s.hashedRefreshToken),
    );
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    payload.sessionId = session.id;
    return { access_token: this.createToken(payload, '15m') };
  }

  createToken(payload, expiresIn) {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('SECRET_KEY'),
      expiresIn,
    });
  }

  async generateToken(user: User) {
    const { id: userId, email, role } = user || {};
    const payload = { userId, email, role };

    const refresh_token = this.createToken(payload, '7d');

    const hashed = await bcrypt.hash(refresh_token, 10);
    const userSession = await this.userSessionsRepository.save({
      user,
      hashedRefreshToken: hashed,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    (payload as any).sesssionId = userSession.id;

    const access_token = this.createToken(payload, '15m');
    return { access_token, refresh_token };
  }
}
