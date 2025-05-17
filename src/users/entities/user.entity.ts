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

  @Column()
  @Exclude()
  password: string;

  @Column({ default: 'user' })
  role: Role;

  @OneToMany(() => UserSession, (session) => session.user)
  sessions: UserSession[];
}
