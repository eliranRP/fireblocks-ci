import { app, wireEventListeners } from './src/app.js';
import { runMigrations } from './scripts/migrate.js';
import { config } from './src/config/index.js';
import { logger } from './src/libraries/logger/index.js';

runMigrations();
wireEventListeners();

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'CI server started');
});
