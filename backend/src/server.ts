import { createApp } from './app.js';
import { env } from './config/env.js';
import { matchingJobRunner } from './modules/matching/matching-job.runner.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`🚀 CVMikiri Backend API đang chạy tại: http://localhost:${env.PORT}`);
  console.log(`🔗 Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`📂 Môi trường: ${env.NODE_ENV} | Model AI: ${env.GEMINI_MODEL}`);
  void matchingJobRunner.resumePending().catch((err) => {
    console.error('Không thể khôi phục hàng đợi matching:', err);
  });
});
