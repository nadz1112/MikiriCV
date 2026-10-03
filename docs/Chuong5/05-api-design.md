## 5.5 Thiết kế API (API Design)

### 5.5.1 Quy ước chung

| Hạng mục | Quy ước |
| :--- | :--- |
| Base path | `/api` (không đánh phiên bản ở MVP; khi có thay đổi phá vỡ tương thích thì thêm `/api/v2`) |
| Định dạng | JSON, UTF-8; upload dùng `multipart/form-data` |
| Đặt tên | Danh từ số nhiều, `kebab-case` cho đường dẫn, `camelCase` cho trường JSON |
| Định danh | UUID dạng chuỗi |
| Thời gian | ISO 8601 UTC (`2026-09-08T10:30:00.000Z`) |
| Phân trang | `page` (mặc định 1), `limit` (mặc định 50, tối đa 500) — phù hợp quy mô MVP vài trăm CV |
| Validate | Mọi `body`, `query`, `params` đi qua Zod; lỗi trả về `400 VALIDATION_ERROR` |
| Header theo dõi | Response luôn có `X-Request-Id` |

**Phong bì phản hồi thành công** (tương thích Chương 3):

```json
{ "success": true, "data": {}, "message": "tùy chọn", "total": 0, "page": 1, "limit": 50 }
```

**Phong bì phản hồi lỗi** (một dạng duy nhất cho toàn hệ thống):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Tiêu đề phải có từ 5 đến 150 ký tự",
    "details": [{ "field": "title", "message": "Tối thiểu 5 ký tự" }]
  },
  "requestId": "b6f1c1de-..."
}
```

* `message`: tiếng Việt, hiển thị trực tiếp cho người dùng (NFR4).
* `details`: chỉ có với lỗi validate; **không** chứa stack trace hay thông tin nội bộ.

### 5.5.2 Danh mục Endpoint

| Method | Đường dẫn | FR | Mô tả | Nguồn | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| POST | `/api/jobs` | FR1.1 | Tạo JD | Chương 3 | Must |
| GET | `/api/jobs` | FR1.2 | Danh sách JD | Chương 3 | Must |
| GET | `/api/jobs/:id` | FR1.4 | Chi tiết JD (nạp form sửa) | Phụ lục 4.1.5 | Should |
| PUT | `/api/jobs/:id` | FR1.4 | Cập nhật JD | Phụ lục 4.1.5 | Should |
| DELETE | `/api/jobs/:id` | FR1.3 | Xóa JD (cascade) | Chương 3 | Must |
| GET | `/api/jobs/:id/stats` | FR5.5 | Thống kê phân bổ điểm | Chương 3 (RTM) | Could |
| POST | `/api/candidates/upload` | FR2 | Upload nhiều CV (idempotent) | Chương 3 + 4.1.5 | Must |
| GET | `/api/candidates` | FR3, FR5.1 | Danh sách + lọc rule-based | Chương 3 (mở rộng) | Must |
| GET | `/api/candidates/:id` | FR5.3 | Chi tiết + lịch sử matching | Chương 3 (RTM) | Must |
| GET | `/api/candidates/:id/file` | FR2.5, FR5.3 | Xem/tải tệp CV gốc | **Mới ở Chương 5** | Must |
| DELETE | `/api/candidates/:id` | FR5.4 | Xóa ứng viên (cascade + tệp) | Chương 3 | Must |
| GET | `/api/skills` | FR3.2 | Danh sách kỹ năng chuẩn cho dropdown lọc | **Mới ở Chương 5** | Should |
| POST | `/api/matching/run` | FR4 | Matching **đồng bộ** (≤ `SYNC_MATCH_MAX`) | Chương 3 | Must |
| POST | `/api/matching/jobs` | FR4 | Tạo job matching **bất đồng bộ** | Phụ lục 4.1.5 | Must |
| GET | `/api/matching/jobs/:id` | FR4 | Trạng thái/tiến độ job | Phụ lục 4.1.5 | Must |
| POST | `/api/matching/jobs/:id/cancel` | FR4 | Hủy job | Phụ lục 4.1.5 | Must |
| GET | `/api/matching/leaderboard/:jobDescriptionId` | FR5.2 | Bảng xếp hạng theo JD | Chương 3 | Must |
| GET | `/api/health` | NFR7 | Kiểm tra sống/DB | **Mới ở Chương 5** | Must |

> **Lý do thêm `GET /api/candidates/:id/file`:** US-05 yêu cầu nút xem lại CV gốc, đồng thời ADR-06 cấm phục vụ `/uploads` công khai. **Lý do thêm `GET /api/skills`:** bộ lọc kỹ năng ở giao diện (multi-select) cần danh sách chuẩn, trùng với từ điển dùng khi bóc tách.

### 5.5.3 Đặc tả chi tiết các endpoint thay đổi / bổ sung

#### 1. `POST /api/candidates/upload`

* **Headers:** `Content-Type: multipart/form-data`, `Idempotency-Key: <uuid>` (bắt buộc; FE sinh một khóa cho mỗi lần người dùng bấm tải lên và **tái sử dụng khi retry**).
* **Body:** `files` — tối đa `MAX_FILES_PER_REQUEST` tệp `.pdf`/`.docx`, mỗi tệp ≤ `MAX_FILE_SIZE_MB`.
* **Hành vi idempotency:**

| Tình huống | Kết quả |
| :--- | :--- |
| Key mới | Xử lý bình thường, lưu phản hồi theo key |
| Key đã hoàn tất, cùng nội dung | Trả lại **nguyên phản hồi cũ**, không tạo bản ghi mới |
| Key đang xử lý | `409 REQUEST_IN_PROGRESS` |
| Key đã dùng với nội dung khác | `422 IDEMPOTENCY_KEY_REUSED` |

* **Response `200 OK`:**

```json
{
  "success": true,
  "message": "Đã xử lý 2/3 file thành công",
  "data": [
    {
      "id": "cand_001",
      "fullName": "Nguyễn Văn An",
      "email": "an.nguyen@email.com",
      "phone": "0987654321",
      "yearsOfExperience": 4,
      "skills": ["JavaScript", "TypeScript", "Node.js", "PostgreSQL"],
      "fileName": "CV_Nguyen_Van_An.pdf",
      "extractionStatus": "SUCCESS",
      "extractionMessage": null,
      "createdAt": "2026-09-08T11:00:00.000Z"
    },
    {
      "id": "cand_002",
      "fullName": "CV scan Tran Binh",
      "email": null,
      "phone": null,
      "yearsOfExperience": 0,
      "skills": [],
      "fileName": "scan_tran_binh.pdf",
      "extractionStatus": "FAILED",
      "extractionMessage": "Không thể đọc nội dung văn bản. Vui lòng kiểm tra file không cài mật khẩu hoặc file ảnh scan chưa được hỗ trợ.",
      "createdAt": "2026-09-08T11:00:01.000Z"
    }
  ],
  "errors": [
    {
      "fileName": "cv_candidate.png",
      "code": "UNSUPPORTED_FILE_TYPE",
      "message": "File cv_candidate.png không đúng định dạng hỗ trợ (PDF, DOCX)"
    }
  ]
}
```

* **Phân biệt hai loại thất bại:** (a) *bị từ chối khi kiểm tra* (sai định dạng/quá dung lượng) → chỉ xuất hiện trong `errors[]`, **không** tạo bản ghi; (b) *lưu được nhưng không đọc được nội dung* → có bản ghi với `extractionStatus = FAILED` để HR nhìn thấy và xử lý.
* **Mã trả về:** `200` nếu ≥ 1 tệp được xử lý; `422` nếu mọi tệp đều bị từ chối; `400 NO_FILES` nếu không có tệp.

#### 2. `GET /api/candidates`

| Query | Kiểu | Mô tả |
| :--- | :--- | :--- |
| `search` | string | Tìm trên `searchText` (không phân biệt hoa/thường, **không dấu**) |
| `skills` | string | Danh sách kỹ năng ngăn cách bởi dấu phẩy; được chuẩn hóa qua từ điển alias |
| `skillMode` | `any` \| `all` | OR (mặc định) hoặc AND — đáp ứng FR3.2 |
| `minExp` | int ≥ 0 | Số năm kinh nghiệm tối thiểu |
| `extractionStatus` | enum | Lọc theo trạng thái trích xuất |
| `jobId` | uuid | Nếu có, mỗi dòng kèm `matchScore` của JD đó (cột "Điểm AI") |
| `page`, `limit` | int | Phân trang |
| `sort` | `createdAt` \| `yearsOfExperience` \| `fullName` | Mặc định `createdAt` giảm dần |

```json
{
  "success": true,
  "total": 12,
  "page": 1,
  "limit": 50,
  "data": [
    {
      "id": "cand_001",
      "fullName": "Nguyễn Văn An",
      "email": "an.nguyen@email.com",
      "phone": "0987654321",
      "yearsOfExperience": 4,
      "skills": ["JavaScript", "TypeScript", "Node.js", "PostgreSQL"],
      "fileName": "CV_Nguyen_Van_An.pdf",
      "extractionStatus": "SUCCESS",
      "matchScore": 85,
      "createdAt": "2026-09-08T11:00:00.000Z"
    }
  ]
}
```

> Danh sách **không** trả `rawText` để giảm tải; nội dung thô chỉ có ở endpoint chi tiết.

#### 3. `GET /api/candidates/:id`

```json
{
  "success": true,
  "data": {
    "id": "cand_001",
    "fullName": "Nguyễn Văn An",
    "email": "an.nguyen@email.com",
    "phone": "0987654321",
    "education": "Đại học Bách Khoa",
    "yearsOfExperience": 4,
    "skills": ["JavaScript", "TypeScript", "Node.js"],
    "fileName": "CV_Nguyen_Van_An.pdf",
    "extractionStatus": "SUCCESS",
    "rawText": "…",
    "matches": [
      {
        "jobDescriptionId": "clx123abc456",
        "jobTitle": "Senior Backend NodeJS Developer",
        "score": 85,
        "summary": "…",
        "matchedSkills": ["Node.js"],
        "missingSkills": ["Docker"],
        "evaluatedAt": "2026-09-08T11:15:00.000Z"
      }
    ]
  }
}
```

#### 4. `GET /api/candidates/:id/file`

Trả luồng tệp gốc với `Content-Type` đúng, `Content-Disposition: inline; filename*=UTF-8''<tên>` (hỗ trợ tên tiếng Việt), `X-Content-Type-Options: nosniff`. Tham số `?download=1` đổi sang `attachment`. Lỗi: `404 CANDIDATE_NOT_FOUND`, `404 FILE_NOT_FOUND`.

#### 5. `PUT /api/jobs/:id` và `GET /api/jobs/:id`

`PUT` dùng cùng Zod schema với `POST /api/jobs` (ghi đè toàn bộ trường, trả `200` với bản ghi mới). Cập nhật JD **không** tự chấm lại các kết quả đã có; giao diện nên cảnh báo rằng kết quả cũ dựa trên phiên bản JD trước đó.

#### 6. `POST /api/matching/run` (đồng bộ)

```json
{ "jobDescriptionId": "clx123abc456", "candidateIds": ["cand_001", "cand_002"] }
```

* `candidateIds`: 1 đến `SYNC_MATCH_MAX` phần tử; vượt ngưỡng → `422 SYNC_BATCH_TOO_LARGE` kèm gợi ý dùng `/api/matching/jobs`.
* Hỗ trợ **thành công một phần**: các CV thành công nằm trong `data`, CV lỗi nằm trong `errors`.

```json
{
  "success": true,
  "message": "Hoàn tất đánh giá độ phù hợp cho 1/2 ứng viên",
  "data": [ { "id": "match_001", "candidateId": "cand_001", "candidateName": "Nguyễn Văn An",
              "jobDescriptionId": "clx123abc456", "score": 85, "summary": "…",
              "matchedSkills": ["Node.js", "TypeScript"], "missingSkills": ["Docker"],
              "evaluatedAt": "2026-09-08T11:15:00.000Z" } ],
  "errors": [ { "candidateId": "cand_002", "code": "CANDIDATE_NOT_READABLE",
                "message": "Không thể chấm điểm vì CV chưa đọc được nội dung" } ]
}
```

#### 7. `POST /api/matching/jobs` (bất đồng bộ)

* **Body:** như `run`, nhưng `candidateIds` có từ 1 đến 200 phần tử.
* **Hành vi:** kiểm tra JD tồn tại, loại ứng viên không tồn tại (`400`), ứng viên `FAILED` được tạo item `SKIPPED` kèm lý do. Trả `202 Accepted` và header `Location: /api/matching/jobs/{id}`.

```json
{
  "success": true,
  "message": "Đã tạo tiến trình đánh giá cho 30 ứng viên",
  "data": { "id": "job_001", "status": "QUEUED", "total": 30, "processed": 0, "failed": 0 }
}
```

#### 8. `GET /api/matching/jobs/:id`

`?include=items` để lấy chi tiết từng mục. FE gọi định kỳ mỗi 2 giây và **dừng khi `status` thuộc `COMPLETED | CANCELLED | FAILED`**.

```json
{
  "success": true,
  "data": {
    "id": "job_001",
    "jobDescriptionId": "clx123abc456",
    "status": "RUNNING",
    "total": 30,
    "processed": 12,
    "failed": 1,
    "cancelRequested": false,
    "createdAt": "2026-09-08T11:15:00.000Z",
    "startedAt": "2026-09-08T11:15:01.000Z",
    "finishedAt": null,
    "items": [ { "candidateId": "cand_001", "status": "DONE" },
               { "candidateId": "cand_007", "status": "FAILED", "errorCode": "AI_RATE_LIMITED",
                 "errorMessage": "Dịch vụ AI đang quá tải, vui lòng thử lại sau" } ]
  }
}
```

#### 9. `POST /api/matching/jobs/:id/cancel`

Đặt `cancelRequested = true`, trả `202` với trạng thái hiện tại. Kết quả đã chấm được giữ lại; các mục `PENDING` chuyển `SKIPPED` khi runner xử lý xong đợt hiện tại. Job đã ở trạng thái cuối → `409 MATCHING_JOB_NOT_CANCELLABLE`.

#### 10. `GET /api/matching/leaderboard/:jobDescriptionId`

Giữ nguyên hợp đồng Chương 3; trường `evaluatedAt` lấy từ `MatchResult.updatedAt`. Thứ tự: `score` giảm dần, đồng điểm thì mới chấm hơn xếp trước. Hỗ trợ `page`/`limit`.

#### 11. `GET /api/jobs/:id/stats` (Could)

```json
{
  "success": true,
  "data": {
    "evaluated": 15,
    "buckets": { "lt50": 3, "from50to70": 4, "from70to85": 5, "gt85": 3 },
    "passRate": 0.53
  }
}
```

> **Cần chốt ngưỡng:** biểu đồ dùng 4 khoảng (<50, 50–70, 70–85, >85) còn badge dùng 3 mức (≥80, 50–79, <50). Hai lớp này độc lập có chủ đích (nguyên tắc đã thống nhất ở Chương 4); `passRate` phải ghi rõ ngưỡng "đạt" (đề xuất ≥ 70) trong chú thích biểu đồ để tránh hiểu lầm.

### 5.5.4 Danh mục mã lỗi

| Mã lỗi | HTTP | Thông điệp tiếng Việt (mặc định) | Ngữ cảnh |
| :--- | :--- | :--- | :--- |
| `VALIDATION_ERROR` | 400 | Dữ liệu gửi lên không hợp lệ | Zod thất bại |
| `NO_FILES` | 400 | Chưa chọn file nào để tải lên | Upload rỗng |
| `JOB_NOT_FOUND` | 404 | Không tìm thấy Job Description | |
| `CANDIDATE_NOT_FOUND` | 404 | Không tìm thấy ứng viên | |
| `FILE_NOT_FOUND` | 404 | Không tìm thấy tệp CV gốc | Tệp mồ côi/thiếu |
| `MATCHING_JOB_NOT_FOUND` | 404 | Không tìm thấy tiến trình đánh giá | |
| `REQUEST_IN_PROGRESS` | 409 | Yêu cầu đang được xử lý, vui lòng đợi | Idempotency |
| `MATCHING_JOB_NOT_CANCELLABLE` | 409 | Tiến trình đã kết thúc, không thể hủy | |
| `FILE_TOO_LARGE` | 413 | Dung lượng vượt quá giới hạn {n}MB | Cũng xuất hiện trong `errors[]` |
| `UNSUPPORTED_FILE_TYPE` | 415 | File {tên} không đúng định dạng hỗ trợ (PDF, DOCX) | Cũng xuất hiện trong `errors[]` |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Khóa yêu cầu đã được dùng cho nội dung khác | |
| `SYNC_BATCH_TOO_LARGE` | 422 | Số ứng viên vượt giới hạn xử lý trực tiếp, hãy dùng chế độ chạy nền | |
| `CANDIDATE_NOT_READABLE` | 422 | CV chưa đọc được nội dung nên không thể chấm điểm | Ứng viên `FAILED` |
| `RATE_LIMITED` | 429 | Bạn thao tác quá nhanh, vui lòng thử lại sau | Giới hạn của chính API |
| `AI_RATE_LIMITED` | 503 | Dịch vụ AI đang quá tải, vui lòng thử lại sau | Gemini trả 429 sau retry |
| `AI_PROVIDER_ERROR` | 502 | Không thể kết nối dịch vụ AI | Lỗi mạng/5xx sau retry |
| `AI_INVALID_RESPONSE` | 502 | AI trả về dữ liệu không đúng định dạng | JSON/schema sai sau retry |
| `INTERNAL_ERROR` | 500 | Đã xảy ra lỗi hệ thống, vui lòng thử lại | Mọi lỗi chưa lường trước |

### 5.5.5 Zod Schema tiêu biểu

```typescript
import { z } from 'zod';

export const createJobSchema = z.object({
  title: z.string().trim().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(150, 'Tiêu đề tối đa 150 ký tự'),
  description: z.string().trim().min(10, 'Mô tả tối thiểu 10 ký tự'),
  requiredSkills: z.array(z.string().trim().min(1)).min(1, 'Cần ít nhất 1 kỹ năng'),
  minExperience: z.number().int().min(0).max(30).default(0),
});

export const listCandidatesQuery = z.object({
  search: z.string().trim().optional(),
  skills: z.string().optional().transform(v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : [])),
  skillMode: z.enum(['any', 'all']).default('any'),
  minExp: z.coerce.number().int().min(0).max(30).optional(),
  extractionStatus: z.enum(['SUCCESS', 'WARNING', 'FAILED']).optional(),
  jobId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  sort: z.enum(['createdAt', 'yearsOfExperience', 'fullName']).default('createdAt'),
});

export const runMatchingSchema = z.object({
  jobDescriptionId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).min(1).max(200),
});
```

### 5.5.6 Các vấn đề xuyên suốt

| Vấn đề | Thiết kế |
| :--- | :--- |
| **CORS** | Whitelist theo `CORS_ORIGIN`; production đi qua reverse proxy cùng origin nên không cần CORS |
| **Giới hạn tần suất** | `express-rate-limit`: mức chung cho `/api`, mức chặt hơn cho `/api/matching/*` và `/upload` |
| **Timeout** | `run` đồng bộ có timeout tổng (đề xuất 60s); vượt → gợi ý dùng job |
| **Tải tệp lớn** | Multer `diskStorage` (không giữ 20×10MB trong RAM) rồi xử lý từng tệp tuần tự |
| **Tài liệu API** | Sinh OpenAPI từ Zod (ví dụ `zod-to-openapi`) để FE/QA đối chiếu — tùy chọn |
| **Tương thích Chương 3** | Mọi trường cũ được giữ; chỉ **thêm** trường/endpoint mới, trừ `fileUrl` không còn trả ra (ADR-06) |

### 5.5.7 Ma trận truy vết cập nhật (FR → Thành phần → API → Bảng)

| FR | Module Backend | Endpoint | Bảng |
| :--- | :--- | :--- | :--- |
| FR1.1–1.4 | `jobs` | `POST/GET/PUT/DELETE /api/jobs`, `GET /api/jobs/:id` | `job_descriptions` |
| FR2.1–2.6 | `candidates/ingestion` | `POST /api/candidates/upload`, `GET /api/candidates/:id/file` | `candidates`, `idempotency_keys` |
| FR3.1–3.4 | `candidates` (+ `skills`) | `GET /api/candidates`, `GET /api/skills` | `candidates` |
| FR4.1–4.5 | `matching` (+ `ai`, `queue`) | `POST /api/matching/run`, `/jobs`, `GET /jobs/:id`, `POST /jobs/:id/cancel` | `match_results`, `matching_jobs`, `matching_job_items` |
| FR5.1–5.3 | `candidates`, `matching` | `GET /api/candidates`, `GET /api/candidates/:id`, `GET /api/matching/leaderboard/:id` | `candidates`, `match_results` |
| FR5.4 | `candidates` | `DELETE /api/candidates/:id` | `candidates` (cascade) |
| FR5.5 | `stats` | `GET /api/jobs/:id/stats` | `match_results` |

---
