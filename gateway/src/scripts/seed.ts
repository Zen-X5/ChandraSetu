import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../user/user.service';

async function runSeed() {
  console.log('[ChandraSetu Seeder] Initializing database connection...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);

  await userService.seedInitialAdmin();

  console.log('[ChandraSetu Seeder] Seeding process completed.');
  await app.close();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('[ChandraSetu Seeder] Seeding failed:', err);
  process.exit(1);
});
