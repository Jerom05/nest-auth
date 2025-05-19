import { Exclude } from 'class-transformer';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserSession } from './user-session.entity';
import { Role } from '../../common/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  @Exclude()
  password: string;

  @Column({ default: 'user' })
  role: Role;

  @Column({ name: 'google_id', nullable: true, unique: true })
  googleId: string;

  @Column({ name: 'display_name', nullable: true })
  displayName: string;

  @Column({ name: 'profile_image', nullable: true })
  profileImage: string;

  @Column({ default: false })
  isVerified: boolean;

  @OneToMany(() => UserSession, (session) => session.user)
  sessions: UserSession[];
}
