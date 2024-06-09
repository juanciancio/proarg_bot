import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Bet } from '../entity/bet.entity.js';
import { User } from '../entity/user.entity.js';

let dataSource: DataSource;

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '15658298',
  database: 'proarg',
  entities: [User, Bet],
  synchronize: true,
  logging: false,
});

AppDataSource.initialize()
  .then(() => {
    dataSource = AppDataSource;
  })
  .catch((error) => console.log(error));

export { dataSource };
