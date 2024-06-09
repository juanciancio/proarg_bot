import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number = -1;

  @Column()
  name: string = '';

  @Column()
  birthdate: string = '';

  @Column()
  telegramAlias: string = '';

  @Column({ type: 'bigint' })
  telegramId: number = 0;

  @Column()
  state: string = '';
}
