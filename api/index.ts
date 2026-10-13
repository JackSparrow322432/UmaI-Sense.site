// ВРЕМЕННО: точка входа для Vercel на период до запуска в Yandex Cloud KZ.
// После переезда (DEPLOY_YANDEX_CLOUD_KZ.md) удалить этот файл и vercel.json.
import { createApp } from '../umaisense-back-main/src/createApp';

const app = createApp();

export default app;
