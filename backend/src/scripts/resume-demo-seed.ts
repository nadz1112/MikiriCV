import 'dotenv/config';
import crypto from 'crypto';
import { MatchingItemStatus, MatchingJobStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { evaluateCandidateWithAi } from '../modules/matching/evaluate-candidate.js';
import { geminiMatchingProvider } from '../modules/matching/ai-matching-provider.js';
import { vietnamDay } from '../services/admin-dashboard.service.js';
import { vietnamMonth } from '../services/subscription.service.js';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: resume-demo-seed.ts must not run in production.');
  process.exit(1);
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const COOLDOWN_MS = 16_000;

function daysAgoDate(d: number, hourOffset = 2): Date {
  return new Date(Date.now() - d * DAY_MS - hourOffset * HOUR_MS);
}

function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * DAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupFailedReservationArtifact(operationKey: string, candidateId: string, jobId: string) {
  const prior = await prisma.tokenReservation.findUnique({ where: { operationKey } });
  if (!prior) return;
  const [priorUsage, existingMatch] = await Promise.all([
    prisma.aiUsage.findUnique({ where: { reservationId: prior.id } }),
    prisma.matchResult.findUnique({
      where: { candidateId_jobDescriptionId: { candidateId, jobDescriptionId: jobId } },
    }),
  ]);
  if (existingMatch && priorUsage?.succeeded) return;

  await prisma.$transaction(async (tx) => {
    if (prior.status === 'SETTLED' && priorUsage?.totalTokens && priorUsage.totalTokens > 0) {
      await tx.tokenWallet.update({
        where: { id: prior.walletId },
        data: { used: { decrement: priorUsage.totalTokens } },
      });
    } else if (['HELD', 'STARTED', 'UNKNOWN'].includes(prior.status)) {
      await tx.tokenWallet.update({
        where: { id: prior.walletId },
        data: { reserved: { decrement: prior.amount } },
      });
    }
    await tx.aiUsage.deleteMany({ where: { reservationId: prior.id } });
    await tx.tokenLedger.deleteMany({
      where: {
        operationKey: { in: [`reserve:${prior.id}`, `settle:${prior.id}`, `release:${prior.id}`] },
      },
    });
    await tx.tokenReservation.delete({ where: { id: prior.id } });
  });
}

async function backdateEvaluationTimestamps(
  reservationOperationKey: string,
  candidateId: string,
  jobId: string,
  targetDate: Date,
) {
  const day = vietnamDay(targetDate);
  const reservation = await prisma.tokenReservation.findUnique({ where: { operationKey: reservationOperationKey } });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "match_results"
      SET "createdAt" = ${targetDate}, "updatedAt" = ${targetDate}
      WHERE "candidateId" = ${candidateId} AND "jobDescriptionId" = ${jobId}
    `;
    if (reservation) {
      await tx.$executeRaw`
        UPDATE "token_reservations"
        SET "createdAt" = ${targetDate}, "updatedAt" = ${targetDate}
        WHERE "id" = ${reservation.id}
      `;
      await tx.$executeRaw`
        UPDATE "token_ledger"
        SET "createdAt" = ${targetDate}
        WHERE "operationKey" IN (${`reserve:${reservation.id}`}, ${`settle:${reservation.id}`}, ${`release:${reservation.id}`})
      `;
      await tx.$executeRaw`
        UPDATE "ai_usage"
        SET "createdAt" = ${targetDate}, "day" = ${day}::date
        WHERE "reservationId" = ${reservation.id}
      `;
    }
  });
}

function isRateLimitError(error: unknown): boolean {
  const err = error as { status?: number; code?: string };
  return err?.status === 429 || err?.code === 'AI_RATE_LIMIT' || err?.code === 'AI_RATE_LIMITED';
}

function isTransientError(error: unknown): boolean {
  const err = error as { status?: number; code?: string };
  const retryableCodes = new Set(['AI_SERVICE_UNAVAILABLE', 'AI_TIMEOUT', 'AI_INVALID_RESPONSE', 'AI_PROVIDER_ERROR']);
  return [502, 503, 504].includes(err?.status ?? 0) || (err?.code ? retryableCodes.has(err.code) : false);
}

type EvalTaskSpec =
  | {
      kind: 'primary-item';
      label: string;
      ownerId: string;
      companyId: string;
      plan: 'PLUS';
      jobId: string;
      candidateFileName: string;
      targetDate: Date;
    }
  | {
      kind: 'secondary-job';
      label: string;
      ownerId: string;
      companyId: string;
      plan: 'PLUS';
      jobTitle: string;
      candidateFileName: string;
      targetDate: Date;
    }
  | {
      kind: 'secondary-free';
      label: string;
      ownerId: string;
      companyId: string;
      plan: 'FREE';
      jobTitle: string;
      candidateFileName: string;
      targetDate: Date;
    };

async function main() {
  console.info('🔄 Tiếp tục hoàn tất dữ liệu demo từ trạng thái PostgreSQL hiện tại...');

  // 1. Clean up RELEASED reservations from interrupted run (not historical RELEASED ones)
  const staleReleased = await prisma.tokenReservation.findMany({
    where: {
      status: 'RELEASED',
      NOT: { operationKey: { startsWith: 'hist:' } },
    },
    select: { id: true, operationKey: true },
  });
  if (staleReleased.length > 0) {
    console.info(`🧹 Dọn ${staleReleased.length} reservation RELEASED sót lại từ lần chạy bị ngắt...`);
    await prisma.$transaction(async (tx) => {
      const ids = staleReleased.map((r) => r.id);
      const opKeys = ids.flatMap((id) => [`reserve:${id}`, `settle:${id}`, `release:${id}`]);
      await tx.aiUsage.deleteMany({ where: { reservationId: { in: ids } } });
      await tx.tokenLedger.deleteMany({ where: { operationKey: { in: opKeys } } });
      await tx.tokenReservation.deleteMany({ where: { id: { in: ids } } });
    });
  }

  // 2. Load existing DB records
  const adminUser = await prisma.user.findFirstOrThrow({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });

  const requireCompany = (key: string) =>
    prisma.company.findUniqueOrThrow({ where: { key } });
  const requireUser = (email: string) =>
    prisma.user.findUniqueOrThrow({ where: { email } });

  const [mikiri, novatech, vietretail, saigonlogistics, buildaxis, eduspring, finora] = await Promise.all([
    requireCompany('mikiri talent hub'),
    requireCompany('novatech solutions'),
    requireCompany('vietretail group'),
    requireCompany('saigon logistics jsc'),
    requireCompany('buildaxis engineering'),
    requireCompany('eduspring academy'),
    requireCompany('finora capital'),
  ]);

  const [hrMain, hrSupport, hrNova, hrNovaRecruiter, hrRetail, hrLogistics, hrBuild, hrEdu, hrFinora] =
    await Promise.all([
      requireUser('hr.main@mikiricv.vn'),
      requireUser('hr.support@mikiricv.vn'),
      requireUser('hr@novatech.vn'),
      requireUser('recruiter@novatech.vn'),
      requireUser('hr@vietretail.vn'),
      requireUser('hr@saigonlogistics.vn'),
      requireUser('hr@buildaxis.vn'),
      requireUser('hr@eduspring.vn'),
      requireUser('hr@finora.vn'),
    ]);

  const allJobs = await prisma.jobDescription.findMany();
  const jobByOwnerAndTitle = new Map(allJobs.map((j) => [`${j.ownerId}::${j.title}`, j]));

  const allCandidates = await prisma.candidate.findMany();
  const candidateByFileName = new Map(allCandidates.map((c) => [c.fileName, c]));

  const primaryJobs = await prisma.matchingJob.findMany({
    where: { ownerId: hrMain.id, status: { not: 'CANCELLED' } },
    include: { jobDescription: true, items: { include: { candidate: true } } },
  });
  const pendingPrimaryItemByKey = new Map<string, { itemId: string; matchingJobId: string }>();
  for (const mJob of primaryJobs) {
    for (const item of mJob.items) {
      pendingPrimaryItemByKey.set(`${mJob.jobDescriptionId}::${item.candidate.fileName}`, {
        itemId: item.id,
        matchingJobId: mJob.id,
      });
    }
  }

  const jdIdByTitle = (ownerId: string, title: string): string => {
    const found = jobByOwnerAndTitle.get(`${ownerId}::${title}`);
    if (!found) throw new Error(`Không tìm thấy JD "${title}" cho user ${ownerId}`);
    return found.id;
  };

  // 3. Breadth-first Wave 1 (7 calls) + Wave 2 (10 calls)
  const remainingQueue: EvalTaskSpec[] = [
    // Wave 1: cover all remaining JDs (JD05, JD06, JD07) + all secondary companies (FREE & PLUS)
    {
      kind: 'primary-item',
      label: 'JD05 × TranBichNgoc_HarborLink_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Nhân viên logistics – chứng từ xuất nhập khẩu'),
      candidateFileName: 'TranBichNgoc_HarborLink_cv.pdf',
      targetDate: daysAgoDate(7, 3),
    },
    {
      kind: 'primary-item',
      label: 'JD06 × DangHoaiNam_BuildAxis_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Kỹ sư xây dựng – giám sát thi công'),
      candidateFileName: 'DangHoaiNam_BuildAxis_cv.pdf',
      targetDate: daysAgoDate(4, 3),
    },
    {
      kind: 'primary-item',
      label: 'JD07 × LeMinhChau_EduSpring_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Giáo viên tiếng Anh'),
      candidateFileName: 'LeMinhChau_EduSpring_cv.pdf',
      targetDate: daysAgoDate(1, 3),
    },
    {
      kind: 'secondary-free',
      label: 'VietRetail (FREE) × TranNgocHan_Marketing_cv.pdf',
      ownerId: hrRetail.id,
      companyId: vietretail.id,
      plan: 'FREE',
      jobTitle: 'Chuyên viên Performance Marketing (Bán lẻ)',
      candidateFileName: 'TranNgocHan_Marketing_cv.pdf',
      targetDate: daysAgoDate(6, 5),
    },
    {
      kind: 'secondary-job',
      label: 'NovaTech (PLUS) × PhamHuuKhang_Backend_cv.pdf',
      ownerId: hrNova.id,
      companyId: novatech.id,
      plan: 'PLUS',
      jobTitle: 'Node.js & TypeScript Backend Engineer',
      candidateFileName: 'PhamHuuKhang_Backend_cv.pdf',
      targetDate: daysAgoDate(8, 4),
    },
    {
      kind: 'secondary-free',
      label: 'BuildAxis (FREE) × DoVanHung_Civil_cv.pdf',
      ownerId: hrBuild.id,
      companyId: buildaxis.id,
      plan: 'FREE',
      jobTitle: 'Kỹ sư Hiện trường Kết cấu Dân dụng',
      candidateFileName: 'DoVanHung_Civil_cv.pdf',
      targetDate: daysAgoDate(4, 5),
    },
    {
      kind: 'secondary-job',
      label: 'SaigonLogistics (PLUS) × VuThiMinhThu_Logistics_cv.pdf',
      ownerId: hrLogistics.id,
      companyId: saigonlogistics.id,
      plan: 'PLUS',
      jobTitle: 'Chuyên viên Điều phối Xuất nhập khẩu Đường biển',
      candidateFileName: 'VuThiMinhThu_Logistics_cv.pdf',
      targetDate: daysAgoDate(3, 4),
    },
    // Wave 2: remaining 10 evaluations
    {
      kind: 'primary-item',
      label: 'JD04 × PhamQuocBao_OceanStay_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Chuyên viên hành chính nhân sự tổng hợp'),
      candidateFileName: 'PhamQuocBao_OceanStay_cv.pdf',
      targetDate: daysAgoDate(9, 2),
    },
    {
      kind: 'primary-item',
      label: 'JD05 × PhanAnhThu_SupplyNest_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Nhân viên logistics – chứng từ xuất nhập khẩu'),
      candidateFileName: 'PhanAnhThu_SupplyNest_cv.pdf',
      targetDate: daysAgoDate(7, 2),
    },
    {
      kind: 'primary-item',
      label: 'JD06 × VuNhatMinh_VoltField_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Kỹ sư xây dựng – giám sát thi công'),
      candidateFileName: 'VuNhatMinh_VoltField_cv.pdf',
      targetDate: daysAgoDate(4, 2),
    },
    {
      kind: 'primary-item',
      label: 'JD07 × DinhThaoVy_TravelCove_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Giáo viên tiếng Anh'),
      candidateFileName: 'DinhThaoVy_TravelCove_cv.pdf',
      targetDate: daysAgoDate(1, 2),
    },
    {
      kind: 'secondary-free',
      label: 'VietRetail (FREE) × LeMinhTuan_Sales_cv.pdf',
      ownerId: hrRetail.id,
      companyId: vietretail.id,
      plan: 'FREE',
      jobTitle: 'Chuyên viên Performance Marketing (Bán lẻ)',
      candidateFileName: 'LeMinhTuan_Sales_cv.pdf',
      targetDate: daysAgoDate(2, 5),
    },
    {
      kind: 'secondary-job',
      label: 'NovaTech (PLUS) × NguyenThaoNhi_QA_cv.pdf',
      ownerId: hrNova.id,
      companyId: novatech.id,
      plan: 'PLUS',
      jobTitle: 'Node.js & TypeScript Backend Engineer',
      candidateFileName: 'NguyenThaoNhi_QA_cv.pdf',
      targetDate: daysAgoDate(5, 4),
    },
    {
      kind: 'primary-item',
      label: 'JD05 × TruongDucHoa_AgriVista_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Nhân viên logistics – chứng từ xuất nhập khẩu'),
      candidateFileName: 'TruongDucHoa_AgriVista_cv.pdf',
      targetDate: daysAgoDate(7, 1),
    },
    {
      kind: 'primary-item',
      label: 'JD06 × TruongDucHoa_AgriVista_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Kỹ sư xây dựng – giám sát thi công'),
      candidateFileName: 'TruongDucHoa_AgriVista_cv.pdf',
      targetDate: daysAgoDate(4, 1),
    },
    {
      kind: 'primary-item',
      label: 'JD07 × PhamQuocBao_OceanStay_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Giáo viên tiếng Anh'),
      candidateFileName: 'PhamQuocBao_OceanStay_cv.pdf',
      targetDate: daysAgoDate(1, 1),
    },
    {
      kind: 'primary-item',
      label: 'JD05 × MaiTuanKiet_MotionWorks_cv.pdf',
      ownerId: hrMain.id,
      companyId: mikiri.id,
      plan: 'PLUS',
      jobId: jdIdByTitle(hrMain.id, 'Nhân viên logistics – chứng từ xuất nhập khẩu'),
      candidateFileName: 'MaiTuanKiet_MotionWorks_cv.pdf',
      targetDate: daysAgoDate(7, 0),
    },
  ];

  const currentMonth = vietnamMonth();
  let newSuccess = 0;
  let quotaExhausted = false;

  console.info(`🤖 Bắt đầu chạy tối đa ${remainingQueue.length} lượt Gemini còn lại (tuần tự, nghỉ ${COOLDOWN_MS / 1000}s giữa các lượt)...`);

  for (let i = 0; i < remainingQueue.length; i++) {
    const task = remainingQueue[i];
    const job =
      task.kind === 'primary-item'
        ? allJobs.find((j) => j.id === task.jobId)!
        : jobByOwnerAndTitle.get(`${task.ownerId}::${task.jobTitle}`)!;
    const candidate = candidateByFileName.get(task.candidateFileName);
    if (!job || !candidate) {
      console.warn(`⚠️ Bỏ qua ${task.label} vì thiếu JD/CV trong DB.`);
      continue;
    }

    const existingMatch = await prisma.matchResult.findUnique({
      where: { candidateId_jobDescriptionId: { candidateId: candidate.id, jobDescriptionId: job.id } },
    });
    if (existingMatch) {
      console.info(`  ⏭ [${i + 1}/${remainingQueue.length}] Đã có kết quả cho ${task.label}, bỏ qua.`);
      continue;
    }

    let opKey = '';
    let primaryItemId: string | undefined;
    let secondaryJobId: string | undefined;
    let secondaryItemId: string | undefined;
    let reqKey: string | undefined;

    if (task.kind === 'primary-item') {
      const pending = pendingPrimaryItemByKey.get(`${job.id}::${candidate.fileName}`);
      if (!pending) {
        console.warn(`⚠️ Không tìm thấy matching_job_item cho ${task.label}, bỏ qua.`);
        continue;
      }
      primaryItemId = pending.itemId;
      opKey = `item:${pending.itemId}`;
    } else if (task.kind === 'secondary-job') {
      const mJob = await prisma.matchingJob.create({
        data: {
          jobDescriptionId: job.id,
          ownerId: task.ownerId,
          companyId: task.companyId,
          planName: 'PLUS',
          quotaMonth: currentMonth,
          status: MatchingJobStatus.QUEUED,
          total: 1,
          processed: 0,
          failed: 0,
          createdAt: task.targetDate,
          startedAt: task.targetDate,
        },
      });
      const item = await prisma.matchingJobItem.create({
        data: { jobId: mJob.id, candidateId: candidate.id, status: MatchingItemStatus.PENDING },
      });
      secondaryJobId = mJob.id;
      secondaryItemId = item.id;
      opKey = `item:${item.id}`;
    } else {
      reqKey = `${task.ownerId}:/run:${crypto.randomUUID()}`;
      opKey = `${reqKey}:${candidate.id}`;
    }

    const cleanupSecondaryPending = async () => {
      if (secondaryJobId) {
        await prisma.matchingJob.delete({ where: { id: secondaryJobId } }).catch(() => undefined);
      }
    };

    const attemptOnce = () =>
      evaluateCandidateWithAi(job, candidate, geminiMatchingProvider, task.ownerId, task.plan, task.companyId, opKey);

    let result: Awaited<ReturnType<typeof evaluateCandidateWithAi>> | null = null;
    try {
      await cleanupFailedReservationArtifact(opKey, candidate.id, job.id);
      result = await attemptOnce();
    } catch (firstErr) {
      await cleanupFailedReservationArtifact(opKey, candidate.id, job.id);
      if (isRateLimitError(firstErr)) {
        console.warn(`  ⏳ [${i + 1}/${remainingQueue.length}] Gặp 429 trên ${task.label}, đợi 65s rồi thử lại 1 lần...`);
        await sleep(65_000);
        try {
          result = await attemptOnce();
        } catch (secondErr) {
          await cleanupFailedReservationArtifact(opKey, candidate.id, job.id);
          await cleanupSecondaryPending();
          if (isRateLimitError(secondErr)) {
            console.warn('⚠️ Đã chạm hạn mức ngày (RPD) của Gemini Free Tier — dừng gọi thêm và hoàn tất các bảng còn lại.');
            quotaExhausted = true;
            break;
          }
          console.warn(`  ⚠️ Thất bại sau retry cho ${task.label} (${(secondErr as Error).message}), chuyển sang cặp tiếp theo.`);
          continue;
        }
      } else if (isTransientError(firstErr)) {
        console.warn(`  ⏳ [${i + 1}/${remainingQueue.length}] Lỗi tạm thời trên ${task.label}, đợi 15s rồi thử lại 1 lần...`);
        await sleep(15_000);
        try {
          result = await attemptOnce();
        } catch (secondErr) {
          await cleanupFailedReservationArtifact(opKey, candidate.id, job.id);
          await cleanupSecondaryPending();
          if (isRateLimitError(secondErr)) {
            console.warn('⚠️ Đã chạm hạn mức ngày (RPD) của Gemini Free Tier — dừng gọi thêm và hoàn tất các bảng còn lại.');
            quotaExhausted = true;
            break;
          }
          console.warn(`  ⚠️ Thất bại sau retry cho ${task.label} (${(secondErr as Error).message}), chuyển sang cặp tiếp theo.`);
          continue;
        }
      } else {
        await cleanupSecondaryPending();
        throw firstErr;
      }
    }

    if (result) {
      if (reqKey) {
        await prisma.matchingRequest.create({
          data: {
            key: reqKey,
            hash: crypto.createHash('sha256').update(reqKey).digest('hex'),
            statusCode: 200,
            response: { success: true, data: [{ jobDescriptionId: job.id, candidateId: candidate.id }] },
            createdAt: task.targetDate,
          },
        });
      }
      await backdateEvaluationTimestamps(opKey, candidate.id, job.id, task.targetDate);

      if (primaryItemId) {
        await prisma.matchingJobItem.update({
          where: { id: primaryItemId },
          data: { status: MatchingItemStatus.DONE, attempts: 1, finishedAt: task.targetDate },
        });
      } else if (secondaryItemId && secondaryJobId) {
        await prisma.matchingJobItem.update({
          where: { id: secondaryItemId },
          data: { status: MatchingItemStatus.DONE, attempts: 1, finishedAt: task.targetDate },
        });
        await prisma.matchingJob.update({
          where: { id: secondaryJobId },
          data: {
            status: MatchingJobStatus.COMPLETED,
            total: 1,
            processed: 1,
            finishedAt: new Date(task.targetDate.getTime() + 60_000),
          },
        });
      }

      newSuccess++;
      console.info(`  ✓ [mới +${newSuccess}] ${task.label} => ${result.score}/100 (${task.plan})`);

      if (i < remainingQueue.length - 1) {
        await sleep(COOLDOWN_MS);
      }
    }
  }

  // 4. Finalize the 7 primary MatchingJobs cleanly (drop PENDING items if RPD stopped early)
  const freshPrimaryJobs = await prisma.matchingJob.findMany({
    where: { ownerId: hrMain.id, status: { not: 'CANCELLED' } },
    include: { items: true },
  });
  for (const mJob of freshPrimaryJobs) {
    const pendingIds = mJob.items.filter((it) => it.status === 'PENDING').map((it) => it.id);
    if (pendingIds.length > 0) {
      await prisma.matchingJobItem.deleteMany({ where: { id: { in: pendingIds } } });
    }
    const doneItems = mJob.items.filter((it) => it.status === 'DONE');
    const latestFinish =
      doneItems
        .map((it) => it.finishedAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date(mJob.createdAt.getTime() + 120_000);

    await prisma.matchingJob.update({
      where: { id: mJob.id },
      data: {
        status: MatchingJobStatus.COMPLETED,
        total: doneItems.length,
        processed: doneItems.length,
        failed: 0,
        finishedAt: latestFinish,
      },
    });
  }

  // 5. Idempotently add 3 edge-case MatchingJobs (CANCELLED, SKIPPED failed CV, FAILED job)
  const jd01 = jobByOwnerAndTitle.get(`${hrMain.id}::Java Backend Developer`)!;
  const hasCancelledJob = await prisma.matchingJob.findFirst({
    where: { ownerId: hrMain.id, status: MatchingJobStatus.CANCELLED },
  });
  if (!hasCancelledJob) {
    const cancelTime = daysAgoDate(6, 7);
    const cancelledJob = await prisma.matchingJob.create({
      data: {
        jobDescriptionId: jd01.id,
        ownerId: hrMain.id,
        companyId: mikiri.id,
        planName: 'PLUS',
        quotaMonth: currentMonth,
        status: MatchingJobStatus.CANCELLED,
        total: 2,
        processed: 2,
        failed: 0,
        cancelRequested: true,
        errorMessage: null,
        createdAt: cancelTime,
        startedAt: cancelTime,
        finishedAt: new Date(cancelTime.getTime() + 45_000),
      },
    });
    await prisma.matchingJobItem.createMany({
      data: [
        {
          jobId: cancelledJob.id,
          candidateId: candidateByFileName.get('DangHoaiNam_BuildAxis_cv.pdf')!.id,
          status: MatchingItemStatus.SKIPPED,
          attempts: 0,
          errorCode: 'JOB_CANCELLED',
          errorMessage: 'Đã hủy theo yêu cầu',
          finishedAt: new Date(cancelTime.getTime() + 45_000),
        },
        {
          jobId: cancelledJob.id,
          candidateId: candidateByFileName.get('LeMinhChau_EduSpring_cv.pdf')!.id,
          status: MatchingItemStatus.SKIPPED,
          attempts: 0,
          errorCode: 'JOB_CANCELLED',
          errorMessage: 'Đã hủy theo yêu cầu',
          finishedAt: new Date(cancelTime.getTime() + 45_000),
        },
      ],
    });
  }

  const hasEduSkipJob = await prisma.matchingJob.findFirst({ where: { ownerId: hrEdu.id } });
  if (!hasEduSkipJob) {
    const eduTeacher = jobByOwnerAndTitle.get(`${hrEdu.id}::Giáo viên Tiếng Anh Giao tiếp Thiếu niên`)!;
    const eduFailed = candidateByFileName.get('Scan_Teacher_CV_01.pdf')!;
    const skipJobTime = daysAgoDate(5, 3);
    const eduSkipJob = await prisma.matchingJob.create({
      data: {
        jobDescriptionId: eduTeacher.id,
        ownerId: hrEdu.id,
        companyId: eduspring.id,
        planName: 'PLUS',
        quotaMonth: currentMonth,
        status: MatchingJobStatus.COMPLETED,
        total: 1,
        processed: 1,
        failed: 0,
        createdAt: skipJobTime,
        finishedAt: skipJobTime,
      },
    });
    await prisma.matchingJobItem.create({
      data: {
        jobId: eduSkipJob.id,
        candidateId: eduFailed.id,
        status: MatchingItemStatus.SKIPPED,
        attempts: 0,
        errorCode: 'CANDIDATE_NOT_READABLE',
        errorMessage: 'CV chưa đọc được nội dung nên không thể chấm điểm',
        finishedAt: skipJobTime,
      },
    });
  }

  const hasNovaFailedJob = await prisma.matchingJob.findFirst({
    where: { ownerId: hrNova.id, status: MatchingJobStatus.FAILED },
  });
  if (!hasNovaFailedJob) {
    const novaBackend = jobByOwnerAndTitle.get(`${hrNova.id}::Node.js & TypeScript Backend Engineer`)!;
    const nova2 = candidateByFileName.get('NguyenThaoNhi_QA_cv.pdf')!;
    const failedJobTime = daysAgoDate(2, 6);
    const failedJob = await prisma.matchingJob.create({
      data: {
        jobDescriptionId: novaBackend.id,
        ownerId: hrNova.id,
        companyId: novatech.id,
        planName: 'PLUS',
        quotaMonth: currentMonth,
        status: MatchingJobStatus.FAILED,
        total: 1,
        processed: 1,
        failed: 1,
        errorMessage: 'Có hồ sơ chấm điểm thất bại do giới hạn tần suất tạm thời của nhà cung cấp AI',
        createdAt: failedJobTime,
        startedAt: failedJobTime,
        finishedAt: new Date(failedJobTime.getTime() + 20_000),
      },
    });
    await prisma.matchingJobItem.create({
      data: {
        jobId: failedJob.id,
        candidateId: nova2.id,
        status: MatchingItemStatus.FAILED,
        attempts: 2,
        errorCode: 'AI_RATE_LIMITED',
        errorMessage: 'Nhà cung cấp AI đang quá tải, vui lòng thử lại sau ít phút.',
        finishedAt: new Date(failedJobTime.getTime() + 20_000),
      },
    });
  }

  // 6. Idempotently add historical usage + RELEASED + UNKNOWN reservations + previous cycle usage
  console.info('📊 Đang đồng bộ lịch sử token 30 ngày, đối soát UNKNOWN và audit log...');
  const activeWallets = await prisma.tokenWallet.findMany({
    where: { periodEnd: { gt: new Date() } },
    orderBy: { periodStart: 'desc' },
  });
  const activeWalletByUser = new Map<string, (typeof activeWallets)[number]>();
  for (const w of activeWallets) {
    if (!activeWalletByUser.has(w.userId)) activeWalletByUser.set(w.userId, w);
  }

  const freeTierSnapshot: Prisma.InputJsonValue = {
    model: env.GEMINI_MODEL,
    currency: 'USD',
    unit: 1000000,
    input: '0',
    output: '0',
    thinking: '0',
    billingMode: 'FREE',
    source: 'FREE_TIER',
  };

  const hasHistorical = await prisma.tokenReservation.findFirst({
    where: { operationKey: { startsWith: 'hist:settled:' } },
  });
  if (!hasHistorical) {
    const historicalSettledSpecs = [
      { userId: hrSupport.id, companyId: mikiri.id, daysAgo: 19, input: 1620, output: 1180, thinking: 320 },
      { userId: hrSupport.id, companyId: mikiri.id, daysAgo: 15, input: 1710, output: 1240, thinking: 290 },
      { userId: hrNovaRecruiter.id, companyId: novatech.id, daysAgo: 17, input: 1540, output: 1120, thinking: 260 },
      { userId: hrNova.id, companyId: novatech.id, daysAgo: 14, input: 1850, output: 1310, thinking: 340 },
      { userId: hrLogistics.id, companyId: saigonlogistics.id, daysAgo: 18, input: 1480, output: 1090, thinking: 220 },
      { userId: hrLogistics.id, companyId: saigonlogistics.id, daysAgo: 11, input: 1590, output: 1150, thinking: 280 },
      { userId: hrEdu.id, companyId: eduspring.id, daysAgo: 16, input: 1680, output: 1210, thinking: 310 },
      { userId: hrEdu.id, companyId: eduspring.id, daysAgo: 9, input: 1740, output: 1290, thinking: 350 },
      { userId: hrRetail.id, companyId: vietretail.id, daysAgo: 17, input: 1120, output: 460, thinking: 0 },
      { userId: hrBuild.id, companyId: buildaxis.id, daysAgo: 15, input: 1180, output: 490, thinking: 0 },
      { userId: hrFinora.id, companyId: finora.id, daysAgo: 19, input: 1610, output: 1140, thinking: 240 },
      { userId: hrFinora.id, companyId: finora.id, daysAgo: 14, input: 1690, output: 1200, thinking: 270 },
    ];
    for (let idx = 0; idx < historicalSettledSpecs.length; idx++) {
      const h = historicalSettledSpecs[idx];
      const wallet = activeWalletByUser.get(h.userId)!;
      const t = daysAgoDate(h.daysAgo, 4);
      const total = h.input + h.output + h.thinking;
      const holdAmount = total + 6000;
      const res = await prisma.tokenReservation.create({
        data: {
          operationKey: `hist:settled:${idx + 1}:${crypto.randomUUID()}`,
          walletId: wallet.id,
          amount: holdAmount,
          status: 'SETTLED',
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          createdAt: t,
          updatedAt: t,
        },
      });
      await prisma.tokenWallet.update({
        where: { id: wallet.id },
        data: { used: { increment: total } },
      });
      await prisma.tokenLedger.createMany({
        data: [
          { walletId: wallet.id, kind: 'RESERVE', amount: holdAmount, operationKey: `reserve:${res.id}`, reason: 'Tạm giữ trước khi gọi AI', createdAt: t },
          { walletId: wallet.id, kind: 'SETTLE', amount: total, operationKey: `settle:${res.id}`, reason: 'Quyết toán token thực tế do provider trả về', createdAt: t },
          { walletId: wallet.id, kind: 'RELEASE', amount: holdAmount, operationKey: `release:${res.id}`, reason: 'Giải phóng tạm giữ sau quyết toán', createdAt: t },
        ],
      });
      await prisma.aiUsage.create({
        data: {
          reservationId: res.id,
          enterpriseId: h.userId,
          companyId: h.companyId,
          model: env.GEMINI_MODEL,
          inputTokens: h.input,
          outputTokens: h.output,
          thinkingTokens: h.thinking,
          totalTokens: total,
          actualCostUsd: new Prisma.Decimal(0),
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          succeeded: true,
          createdAt: t,
          day: vietnamDay(t),
        },
      });
    }
  }

  const hasHistReleased = await prisma.tokenReservation.findFirst({
    where: { operationKey: { startsWith: 'hist:released:' } },
  });
  if (!hasHistReleased) {
    for (const userId of [hrMain.id, hrNova.id]) {
      const wallet = activeWalletByUser.get(userId)!;
      const t = daysAgoDate(3, 6);
      const res = await prisma.tokenReservation.create({
        data: {
          operationKey: `hist:released:${userId}:${crypto.randomUUID()}`,
          walletId: wallet.id,
          amount: 9500,
          status: 'RELEASED',
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          createdAt: t,
          updatedAt: t,
        },
      });
      await prisma.tokenLedger.createMany({
        data: [
          { walletId: wallet.id, kind: 'RESERVE', amount: 9500, operationKey: `reserve:${res.id}`, reason: 'Tạm giữ trước khi gọi AI', createdAt: t },
          { walletId: wallet.id, kind: 'RELEASE', amount: 9500, operationKey: `release:${res.id}`, reason: 'Provider từ chối yêu cầu trước khi tạo nội dung', createdAt: t },
        ],
      });
    }
  }

  const hasHistUnknown = await prisma.tokenReservation.findFirst({
    where: { operationKey: { startsWith: 'hist:unknown:' } },
  });
  if (!hasHistUnknown) {
    for (const entry of [
      { userId: hrNova.id, companyId: novatech.id, amount: 9800, minutesAgo: 35 },
      { userId: hrLogistics.id, companyId: saigonlogistics.id, amount: 9600, minutesAgo: 25 },
    ]) {
      const wallet = activeWalletByUser.get(entry.userId)!;
      const t = new Date(Date.now() - entry.minutesAgo * 60_000);
      const res = await prisma.tokenReservation.create({
        data: {
          operationKey: `hist:unknown:${entry.userId}:${crypto.randomUUID()}`,
          walletId: wallet.id,
          amount: entry.amount,
          status: 'UNKNOWN',
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          createdAt: t,
          updatedAt: t,
        },
      });
      await prisma.tokenWallet.update({
        where: { id: wallet.id },
        data: { reserved: { increment: entry.amount } },
      });
      await prisma.tokenLedger.create({
        data: {
          walletId: wallet.id,
          kind: 'RESERVE',
          amount: entry.amount,
          operationKey: `reserve:${res.id}`,
          reason: 'Tạm giữ trước khi gọi AI',
          createdAt: t,
        },
      });
      await prisma.aiUsage.create({
        data: {
          reservationId: res.id,
          enterpriseId: entry.userId,
          companyId: entry.companyId,
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          succeeded: false,
          createdAt: t,
          day: vietnamDay(t),
        },
      });
    }
  }

  const hasPrevCycle = await prisma.tokenReservation.findFirst({
    where: { operationKey: { startsWith: 'hist:prevcycle:' } },
  });
  if (!hasPrevCycle) {
    const closedWallets = await prisma.tokenWallet.findMany({
      where: { periodEnd: { lte: new Date() } },
    });
    const closedByUser = new Map(closedWallets.map((w) => [w.userId, w]));
    const oldCycleSpecs = [
      { walletId: closedByUser.get(hrMain.id)!.id, userId: hrMain.id, companyId: mikiri.id, daysAgo: 28, input: 1820, output: 1350, thinking: 410 },
      { walletId: closedByUser.get(hrMain.id)!.id, userId: hrMain.id, companyId: mikiri.id, daysAgo: 25, input: 1940, output: 1410, thinking: 380 },
      { walletId: closedByUser.get(hrNova.id)!.id, userId: hrNova.id, companyId: novatech.id, daysAgo: 26, input: 1710, output: 1220, thinking: 320 },
    ];
    for (let i = 0; i < oldCycleSpecs.length; i++) {
      const o = oldCycleSpecs[i];
      const t = daysAgoDate(o.daysAgo, 3);
      const res = await prisma.tokenReservation.create({
        data: {
          operationKey: `hist:prevcycle:${i + 1}:${crypto.randomUUID()}`,
          walletId: o.walletId,
          amount: 10000,
          status: 'SETTLED',
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          createdAt: t,
          updatedAt: t,
        },
      });
      await prisma.aiUsage.create({
        data: {
          reservationId: res.id,
          enterpriseId: o.userId,
          companyId: o.companyId,
          model: env.GEMINI_MODEL,
          inputTokens: o.input,
          outputTokens: o.output,
          thinkingTokens: o.thinking,
          totalTokens: o.input + o.output + o.thinking,
          actualCostUsd: new Prisma.Decimal(0),
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          succeeded: true,
          createdAt: t,
          day: vietnamDay(t),
        },
      });
    }
  }

  // 7. BillingAudit (7 entries)
  const existingAuditCount = await prisma.billingAudit.count({
    where: { operationKey: { contains: ':seed-audit-' } },
  });
  if (existingAuditCount === 0) {
    const auditSpecs = [
      {
        action: 'COMPANY_PLAN',
        targetId: mikiri.id,
        before: { plan: 'FREE', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'YEARLY' },
        reason: 'Kích hoạt gói PLUS theo năm cho doanh nghiệp tuyển dụng trọng điểm Mikiri Talent Hub',
        daysAgo: 22,
      },
      {
        action: 'COMPANY_PLAN',
        targetId: novatech.id,
        before: { plan: 'FREE', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'MONTHLY' },
        reason: 'Nâng cấp gói PLUS theo tháng theo hợp đồng dịch vụ tháng 11',
        daysAgo: 20,
      },
      {
        action: 'COMPANY_PLAN',
        targetId: saigonlogistics.id,
        before: { plan: 'FREE', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'YEARLY' },
        reason: 'Gia hạn gói PLUS chu kỳ năm cho Saigon Logistics JSC',
        daysAgo: 18,
      },
      {
        action: 'PRICE_VERSION',
        targetId: env.GEMINI_MODEL,
        before: { inputUsd: '0.10000000', outputUsd: '0.40000000' },
        after: { model: env.GEMINI_MODEL, inputUsd: 0.075, outputUsd: 0.3, thinkingUsd: 0.3 },
        reason: 'Cập nhật biểu giá tham chiếu theo bảng giá Gemini mới nhất',
        daysAgo: 12,
      },
      {
        action: 'COMPANY_PLAN',
        targetId: eduspring.id,
        before: { plan: 'FREE', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'MONTHLY' },
        reason: 'Duyệt gói PLUS thử nghiệm 30 ngày cho EduSpring Academy',
        daysAgo: 9,
      },
      {
        action: 'PLAN_CONFIG',
        targetId: 'PLUS',
        before: { tokenLimit: 2000000, maxCvPerCall: 100 },
        after: { tokenLimit: 3000000, maxCvPerCall: 200, cycleDays: 30, maxOutputTokens: 8192 },
        reason: 'Mở rộng hạn mức gói PLUS lên 3.000.000 token mỗi chu kỳ cho tuyển dụng hàng loạt',
        daysAgo: 6,
      },
      {
        action: 'COMPANY_PLAN',
        targetId: finora.id,
        before: { plan: 'PLUS', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'MONTHLY', expiredNote: true },
        reason: 'Ghi nhận hết hạn chu kỳ gói PLUS đối với Finora Capital',
        daysAgo: 5,
      },
    ];
    for (let i = 0; i < auditSpecs.length; i++) {
      const a = auditSpecs[i];
      await prisma.billingAudit.create({
        data: {
          actorId: adminUser.id,
          action: a.action,
          targetId: a.targetId,
          before: a.before,
          after: a.after,
          reason: a.reason,
          operationKey: `admin:${adminUser.id}:seed-audit-${i + 1}`,
          createdAt: daysAgoDate(a.daysAgo),
        },
      });
    }
  }

  // 8. IdempotencyKeys & extra MatchingRequests
  if ((await prisma.idempotencyKey.count()) === 0) {
    for (let i = 1; i <= 5; i++) {
      await prisma.idempotencyKey.create({
        data: {
          key: crypto.randomUUID(),
          endpoint: '/api/candidates/upload',
          requestHash: crypto.createHash('sha256').update(`upload-seed-${i}`).digest('hex'),
          statusCode: 200,
          responseBody: { success: true, message: 'Đã xử lý tải lên thành công' },
          createdAt: daysAgoDate(i * 2),
          expiresAt: daysFromNow(1),
        },
      });
    }
  }

  const supportJob = jobByOwnerAndTitle.get(`${hrSupport.id}::Senior DevOps & Cloud Engineer`);
  if (supportJob && (await prisma.matchingRequest.count({ where: { key: { startsWith: `${hrSupport.id}:/run:` } } })) === 0) {
    for (let i = 1; i <= 3; i++) {
      const key = `${hrSupport.id}:/run:${crypto.randomUUID()}`;
      await prisma.matchingRequest.create({
        data: {
          key,
          hash: crypto.createHash('sha256').update(key).digest('hex'),
          statusCode: 200,
          response: { success: true, data: [{ jobDescriptionId: supportJob.id }] },
          createdAt: daysAgoDate(i + 1),
        },
      });
    }
  }

  // 9. Sync company monthlyUsed
  for (const company of [mikiri, novatech, vietretail, saigonlogistics, buildaxis, eduspring, finora]) {
    const succeededCount = await prisma.aiUsage.count({
      where: { companyId: company.id, succeeded: true, day: { gte: currentMonth } },
    });
    await prisma.company.update({
      where: { id: company.id },
      data: { quotaMonth: currentMonth, monthlyUsed: succeededCount },
    });
  }

  const totalMatches = await prisma.matchResult.count();
  console.info(`✅ Hoàn tất resume-demo-seed (thêm +${newSuccess} lượt Gemini mới, tổng ${totalMatches} kết quả đánh giá thật${quotaExhausted ? ', đã dừng sớm do RPD' : ''})!`);
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi chạy resume-demo-seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
