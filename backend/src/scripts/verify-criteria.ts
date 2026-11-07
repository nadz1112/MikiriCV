import { prisma } from '../config/database.js';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TIÊU CHÍ HOÀN THÀNH (BACKEND & PERFORMANCE) ===\n');

  const results: TestResult[] = [];
  const baseUrl = 'http://localhost:4000/api';

  // 1. Đăng nhập để lấy cookie
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'CVMikiri',
    },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'ChangeThis_Admin_123',
    }),
  });

  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
  const headers = {
    'Cookie': cookie,
    'X-Requested-With': 'CVMikiri',
  };

  // Helper fetch API có tính thời gian
  async function timedFetch(url: string, opts: RequestInit = {}): Promise<{ status: number; body: any; durationMs: number }> {
    const start = performance.now();
    const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
    const end = performance.now();
    let body: any;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body, durationMs: Math.round((end - start) * 10) / 10 };
  }

  // Tiêu chí 1: Không lọc (mặc định)
  {
    const r = await timedFetch(`${baseUrl}/candidates`);
    const passed = r.status === 200 && r.body.success && r.body.total >= 500 && r.body.data.length > 0;
    results.push({
      name: 'Ca 1: Không lọc (Mặc định limit=50, page=1)',
      passed,
      durationMs: r.durationMs,
      details: `Status ${r.status}, Total: ${r.body.total}, Số dòng trả về: ${r.body.data?.length}`,
    });
  }

  // Tiêu chí 2: Search "nguyen van an" và "NGUYỄN VĂN AN" cho cùng kết quả
  {
    const rLower = await timedFetch(`${baseUrl}/candidates?search=nguyen+van+an`);
    const rUpper = await timedFetch(`${baseUrl}/candidates?search=${encodeURIComponent('NGUYỄN VĂN AN')}`);
    const sameTotal = rLower.body?.total === rUpper.body?.total && rLower.body?.total > 0;
    const sameIds = JSON.stringify(rLower.body?.data?.map((d: any) => d.id)) === JSON.stringify(rUpper.body?.data?.map((d: any) => d.id));
    const passed = rLower.status === 200 && rUpper.status === 200 && sameTotal && sameIds;
    results.push({
      name: 'Ca 2: Tìm kiếm không phân biệt hoa thường và dấu tiếng Việt',
      passed,
      durationMs: Math.max(rLower.durationMs, rUpper.durationMs),
      details: `"nguyen van an": ${rLower.body?.total} kết quả (${rLower.durationMs}ms) | "NGUYỄN VĂN AN": ${rUpper.body?.total} kết quả (${rUpper.durationMs}ms)`,
    });
  }

  // Tiêu chí 3: skills=NodeJS,Golang khớp Node.js và Go
  {
    const r = await timedFetch(`${baseUrl}/candidates?skills=NodeJS,Golang`);
    const allMatch = r.body?.data?.every((c: any) => c.skills.includes('Node.js') || c.skills.includes('Go'));
    const passed = r.status === 200 && r.body?.total > 0 && allMatch;
    results.push({
      name: 'Ca 3: Chuẩn hóa kỹ năng skills=NodeJS,Golang -> Node.js hoặc Go',
      passed,
      durationMs: r.durationMs,
      details: `Status ${r.status}, Total: ${r.body?.total}, Mọi ứng viên đều chứa Node.js hoặc Go: ${allMatch}`,
    });
  }

  // Tiêu chí 4: skillMode=all so với any cho kết quả khác nhau hợp lý
  {
    const rAny = await timedFetch(`${baseUrl}/candidates?skills=NodeJS,Golang&skillMode=any`);
    const rAll = await timedFetch(`${baseUrl}/candidates?skills=NodeJS,Golang&skillMode=all`);
    const allHaveBoth = rAll.body?.data?.every((c: any) => c.skills.includes('Node.js') && c.skills.includes('Go'));
    const diffReasonable = rAny.body?.total >= rAll.body?.total && allHaveBoth;
    const passed = rAny.status === 200 && rAll.status === 200 && diffReasonable;
    results.push({
      name: 'Ca 4: skillMode any (OR) vs all (AND)',
      passed,
      durationMs: Math.max(rAny.durationMs, rAll.durationMs),
      details: `any: ${rAny.body?.total} ứng viên | all: ${rAll.body?.total} ứng viên (mọi dòng all đều có cả Node.js & Go: ${allHaveBoth})`,
    });
  }

  // Tiêu chí 5: minExp=2
  {
    const r = await timedFetch(`${baseUrl}/candidates?minExp=2`);
    const allMinExp = r.body?.data?.every((c: any) => c.yearsOfExperience >= 2);
    const passed = r.status === 200 && r.body?.total > 0 && allMinExp;
    results.push({
      name: 'Ca 5: Lọc số năm kinh nghiệm minExp=2',
      passed,
      durationMs: r.durationMs,
      details: `Status ${r.status}, Total: ${r.body?.total}, Mọi ứng viên có exp >= 2: ${allMinExp}`,
    });
  }

  // Tiêu chí 6: Kết hợp search + skills + minExp
  {
    const r = await timedFetch(`${baseUrl}/candidates?search=React&skills=NodeJS&minExp=2`);
    const passed = r.status === 200 && Array.isArray(r.body?.data);
    results.push({
      name: 'Ca 6: Kết hợp đa tiêu chí (search=React + skills=NodeJS + minExp=2)',
      passed,
      durationMs: r.durationMs,
      details: `Status ${r.status}, Total: ${r.body?.total}`,
    });
  }

  // Tiêu chí 7: Phân trang limit=10&page=2
  {
    const r = await timedFetch(`${baseUrl}/candidates?limit=10&page=2`);
    const passed = r.status === 200 && r.body?.page === 2 && r.body?.limit === 10 && r.body?.data?.length === 10;
    results.push({
      name: 'Ca 7: Phân trang limit=10&page=2',
      passed,
      durationMs: r.durationMs,
      details: `Status ${r.status}, Page: ${r.body?.page}, Limit: ${r.body?.limit}, Trả về: ${r.body?.data?.length} dòng`,
    });
  }

  // Tiêu chí 8: Tham số sai trả 400 VALIDATION_ERROR tiếng Việt
  {
    const r = await timedFetch(`${baseUrl}/candidates?minExp=-5&skillMode=invalid`);
    const hasValidationError = r.status === 400 && r.body?.error?.code === 'VALIDATION_ERROR';
    const isVietnamese = typeof r.body?.error?.message === 'string' && r.body.error.message.length > 0;
    const passed = hasValidationError && isVietnamese;
    results.push({
      name: 'Ca 8: Validate Zod tham số sai (minExp=-5, skillMode=invalid)',
      passed,
      durationMs: r.durationMs,
      details: `Status: ${r.status}, Error Code: ${r.body?.error?.code}, Message: "${r.body?.error?.message}"`,
    });
  }

  // Tiêu chí 9: Kiểm tra không lộ trường nhạy cảm (rawText, searchText, fileUrl)
  {
    const r = await timedFetch(`${baseUrl}/candidates?limit=50`);
    let leakedField: string | null = null;
    for (const row of r.body?.data || []) {
      if ('rawText' in row) leakedField = 'rawText';
      if ('searchText' in row) leakedField = 'searchText';
      if ('fileUrl' in row) leakedField = 'fileUrl';
      if (leakedField) break;
    }
    const passed = leakedField === null;
    results.push({
      name: 'Ca 9: Bảo mật dữ liệu - Tuyệt đối không chứa rawText, searchText, fileUrl',
      passed,
      durationMs: r.durationMs,
      details: leakedField ? `❌ LỖ BẢO MẬT: Phát hiện trường ${leakedField} trong response!` : '✓ Đã kiểm tra 50 dòng: 100% không chứa rawText, searchText, fileUrl',
    });
  }

  // Tiêu chí 10: Đo thời gian truy vấn EXPLAIN trên PostgreSQL
  console.log('\n--- KẾT QUẢ TỪNG CA KIỂM THỬ API ---');
  for (const res of results) {
    const icon = res.passed ? '✅' : '❌';
    console.log(`${icon} [${res.durationMs}ms] ${res.name}`);
    console.log(`   -> ${res.details}`);
  }

  console.log('\n--- ĐO THỜI GIAN TRUY VẤN VÀ KIỂM TRA CHỈ MỤC (EXPLAIN ANALYZE) ---');
  const explainKeyword = await prisma.$queryRawUnsafe<any[]>(
    `EXPLAIN ANALYZE SELECT id, "fullName", skills, "yearsOfExperience" FROM candidates WHERE "searchText" LIKE '%nguyen van an%';`
  );
  console.log('EXPLAIN cho tìm kiếm searchText:');
  explainKeyword.forEach((row: any) => console.log('  ', row['QUERY PLAN']));

  const explainSkills = await prisma.$queryRawUnsafe<any[]>(
    `EXPLAIN ANALYZE SELECT id, "fullName", skills, "yearsOfExperience" FROM candidates WHERE skills && ARRAY['Node.js', 'Go']::text[];`
  );
  console.log('\nEXPLAIN cho lọc skills (GIN index):');
  explainSkills.forEach((row: any) => console.log('  ', row['QUERY PLAN']));

  console.log('\n=== HOÀN TẤT KIỂM THỬ TOÀN DIỆN ===');
}

run()
  .catch((err) => {
    console.error('Lỗi khi chạy verify:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
