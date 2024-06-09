import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Bet {
  @PrimaryGeneratedColumn()
  id: number = -1;

  @Column({ type: 'bigint' })
  telegramId: number = 0;

  @Column()
  date: string = '';
}
