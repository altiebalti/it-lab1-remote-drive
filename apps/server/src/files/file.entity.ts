import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('files')
@Index(['ownerId', 'path'], { unique: true })
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, (user) => user.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  path: string;

  @Column()
  name: string;

  @Column()
  ext: string;

  @Column({ type: 'bigint' })
  size: string;

  @Column()
  mimeType: string;

  @Column({ unique: true })
  storageKey: string;

  @Column()
  contentHash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column()
  uploadedById: string;

  @ManyToOne(() => User, { nullable: false, eager: true })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @Column({ nullable: true, type: 'uuid' })
  editedById: string | null;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'editedById' })
  editedBy: User | null;
}
