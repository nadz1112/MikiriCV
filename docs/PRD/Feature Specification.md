# CHƯƠNG 3: AI TRONG PHÂN TÍCH YÊU CẦU & SẢN PHẨM
## DỰ ÁN: CVMikiri — HỆ THỐNG KIỂM TRA, SÀNG LỌC VÀ CHẤM ĐIỂM CV THÔNG MINH

---

## 3.5 Đặc tả Tính năng (Feature Specification)

### 3.5.1 Đặc tả Giao diện Người dùng (UI/UX Specification)

#### A. Kiến trúc Bố cục Giao diện (Layout Architecture)
* **Thanh điều hướng chính (Top Navbar)**:
  * Logo CVMikiri.
  * Menu điều hướng: **Job Descriptions**, **Quản lý CV (Candidates)**, **AI Matching Studio**, **Bảng xếp hạng (Dashboard)**.
* **Khu vực tải lên (Drag-and-drop Dropzone)**:
  * Sử dụng thư viện `react-dropzone`.
  * Viền nét đứt (dashed border), icon đám mây, thông báo chấp nhận file PDF/DOCX (Tối đa 10MB/file).
  * Danh sách trạng thái file đang upload với progress bar và icon tích xanh/dấu chéo đỏ.
* **Bảng dữ liệu ứng viên & Bộ lọc thông minh (Data Table & Filter Bar)**:
  * Thanh Filter cố định ở trên đầu bảng: Ô tìm kiếm từ khóa, Dropdown chọn kỹ năng (Multi-select), Slider hoặc Input chọn số năm kinh nghiệm.
  * Các cột bảng: Checkbox chọn hàng loạt, Họ tên, Email, Số điện thoại, Kinh nghiệm, Kỹ năng bóc tách, Điểm AI (nếu đã matching), Thao tác (Xem chi tiết, Chạy AI, Xóa).
* **Modal Chi tiết Kết quả Matching (AI Insight Modal)**:
  * Phía trên: Gauge chart hoặc Circle Progress hiển thị điểm số trên thang 100.
  * Đoạn nhận xét tổng quan do Gemini sinh ra.
  * Hai cột so sánh: **Kỹ năng đã có (Matched)** vs **Kỹ năng còn thiếu (Missing)**.

---

### 3.5.2 Đặc tả Giao diện Lập trình Ứng dụng (RESTful API Specifications)

Toàn bộ các endpoint đều tuân thủ chuẩn RESTful, trả về dữ liệu định dạng JSON với mã phản hồi HTTP tiêu chuẩn.

#### Nhóm 1: Quản lý Job Description (`/api/jobs`)

##### 1. Tạo Job Description mới
* **Endpoint**: `POST /api/jobs`
* **Request Headers**: `Content-Type: application/json`
* **Request Body**:
```json
{
  "title": "Senior Backend NodeJS Developer",
  "description": "Tham gia phát triển hệ thống microservices chịu tải cao...",
  "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL", "Docker", "Redis"],
  "minExperience": 3
}
```
* **Validation (Zod Schema)**:
  * `title`: string, min 5 chars, max 150 chars.
  * `description`: string, min 10 chars.
  * `requiredSkills`: array of strings, at least 1 item.
  * `minExperience`: integer, >= 0.
* **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "clx123abc456",
    "title": "Senior Backend NodeJS Developer",
    "description": "Tham gia phát triển hệ thống microservices...",
    "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL", "Docker", "Redis"],
    "minExperience": 3,
    "createdAt": "2026-09-08T10:30:00.000Z",
    "updatedAt": "2026-09-08T10:30:00.000Z"
  }
}
```

##### 2. Lấy danh sách Job Description
* **Endpoint**: `GET /api/jobs`
* **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "clx123abc456",
      "title": "Senior Backend NodeJS Developer",
      "requiredSkills": ["Node.js", "TypeScript", "PostgreSQL"],
      "minExperience": 3,
      "candidateCount": 25,
      "createdAt": "2026-09-08T10:30:00.000Z"
    }
  ]
}
```

##### 3. Xóa Job Description
* **Endpoint**: `DELETE /api/jobs/:id`
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Đã xóa Job Description và toàn bộ kết quả matching liên quan thành công"
}
```

---

#### Nhóm 2: Quản lý Ứng viên & Upload CV (`/api/candidates`)

##### 1. Upload danh sách CV
* **Endpoint**: `POST /api/candidates/upload`
* **Request Headers**: `Content-Type: multipart/form-data`
* **Request Body**: FormData chứa `files` (Mảng các file `.pdf`, `.docx`)
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Đã xử lý 3/3 file thành công",
  "data": [
    {
      "id": "cand_001",
      "fullName": "Nguyễn Văn An",
      "email": "an.nguyen@email.com",
      "phone": "0987654321",
      "yearsOfExperience": 4,
      "skills": ["JavaScript", "TypeScript", "Node.js", "PostgreSQL"],
      "fileName": "CV_Nguyen_Van_An.pdf",
      "fileUrl": "/uploads/uuid-CV_Nguyen_Van_An.pdf",
      "createdAt": "2026-09-08T11:00:00.000Z"
    }
  ],
  "errors": []
}
```

##### 2. Lấy danh sách ứng viên (Có hỗ trợ Lọc Rule-based)
* **Endpoint**: `GET /api/candidates`
* **Query Parameters**:
  * `search` (tùy chọn): Tìm kiếm họ tên hoặc nội dung rawText.
  * `skills` (tùy chọn): Chuỗi các kỹ năng ngăn cách bởi dấu phẩy (`skills=Node.js,PostgreSQL`).
  * `minExp` (tùy chọn): Số năm kinh nghiệm tối thiểu (`minExp=2`).
* **Response (200 OK)**:
```json
{
  "success": true,
  "total": 12,
  "data": [
    {
      "id": "cand_001",
      "fullName": "Nguyễn Văn An",
      "email": "an.nguyen@email.com",
      "phone": "0987654321",
      "yearsOfExperience": 4,
      "skills": ["JavaScript", "TypeScript", "Node.js", "PostgreSQL"],
      "fileName": "CV_Nguyen_Van_An.pdf",
      "createdAt": "2026-09-08T11:00:00.000Z"
    }
  ]
}
```

##### 3. Xóa một ứng viên
* **Endpoint**: `DELETE /api/candidates/:id`
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Đã xóa ứng viên và giải phóng tệp tin thành công"
}
```

---

#### Nhóm 3: Chấm điểm & AI Matching (`/api/matching`)

##### 1. Chạy AI Matching với Google Gemini
* **Endpoint**: `POST /api/matching/run`
* **Request Headers**: `Content-Type: application/json`
* **Request Body**:
```json
{
  "jobDescriptionId": "clx123abc456",
  "candidateIds": ["cand_001", "cand_002"]
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Hoàn tất đánh giá độ phù hợp cho 2 ứng viên",
  "data": [
    {
      "id": "match_001",
      "candidateId": "cand_001",
      "candidateName": "Nguyễn Văn An",
      "jobDescriptionId": "clx123abc456",
      "score": 85,
      "summary": "Ứng viên có nền tảng vững chắc về Node.js và TypeScript với 4 năm kinh nghiệm thực tế. Đã từng làm việc với cơ sở dữ liệu PostgreSQL và kiến trúc RESTful. Tuy nhiên ứng viên chưa đề cập nhiều đến kinh nghiệm triển khai Docker trong môi trường production.",
      "matchedSkills": ["Node.js", "TypeScript", "PostgreSQL"],
      "missingSkills": ["Docker", "Redis"],
      "createdAt": "2026-09-08T11:15:00.000Z"
    }
  ]
}
```

##### 2. Lấy Bảng xếp hạng ứng viên theo JD
* **Endpoint**: `GET /api/matching/leaderboard/:jobDescriptionId`
* **Response (200 OK)**:
```json
{
  "success": true,
  "jobTitle": "Senior Backend NodeJS Developer",
  "data": [
    {
      "candidateId": "cand_001",
      "fullName": "Nguyễn Văn An",
      "email": "an.nguyen@email.com",
      "phone": "0987654321",
      "score": 85,
      "summary": "Ứng viên có nền tảng vững chắc về Node.js...",
      "matchedSkills": ["Node.js", "TypeScript", "PostgreSQL"],
      "missingSkills": ["Docker", "Redis"],
      "evaluatedAt": "2026-09-08T11:15:00.000Z"
    },
    {
      "candidateId": "cand_002",
      "fullName": "Trần Thị Bình",
      "email": "binh.tran@email.com",
      "phone": "0912345678",
      "score": 62,
      "summary": "Ứng viên có kinh nghiệm với JavaScript và React nhưng kỹ năng backend còn hạn chế...",
      "matchedSkills": ["TypeScript"],
      "missingSkills": ["Node.js", "PostgreSQL", "Docker", "Redis"],
      "evaluatedAt": "2026-09-08T11:15:00.000Z"
    }
  ]
}
```

---

### 3.5.3 Thiết kế Prompt Kỹ thuật & Cấu trúc Dữ liệu Gemini AI (Prompt Engineering & Schema)

Để đảm bảo mô hình Google Gemini trả về kết quả chính xác, khách quan và luôn tuân thủ cấu trúc dữ liệu JSON để backend parse được 100%, chúng ta cấu hình và áp dụng kỹ thuật **Structured Outputs** với SDK `@google/genai` (hoặc `@google/generative-ai`).

#### A. Cấu trúc Prompt Gửi Tới Gemini AI

##### 1. System Instruction (Chỉ dẫn hệ thống):
```text
Bạn là một chuyên gia tuyển dụng nhân sự cấp cao và đánh giá năng lực công nghệ (Senior Technical Recruiter & Talent Assessment Expert).
Nhiệm vụ của bạn là phân tích văn bản CV của một ứng viên và đối chiếu khách quan với Bản mô tả công việc (Job Description - JD) được cung cấp.

Quy tắc chấm điểm (Scoring Guidelines):
- Thang điểm: 0 đến 100.
- 90 - 100: Xuất sắc, đáp ứng vượt mong đợi toàn bộ kỹ năng cốt lõi và số năm kinh nghiệm yêu cầu.
- 75 - 89: Rất tốt, đáp ứng toàn bộ yêu cầu cốt lõi, chỉ thiếu một vài kỹ năng phụ không bắt buộc.
- 50 - 74: Khá, đáp ứng được một phần yêu cầu nhưng thiếu kỹ năng chính hoặc số năm kinh nghiệm chưa đủ.
- Dưới 50: Không phù hợp, thiếu hụt nghiêm trọng các kỹ năng nền tảng của vị trí.

Quy tắc đầu ra:
- Ngôn ngữ nhận xét: Tiếng Việt chuẩn mực, khách quan, súc tích, mang tính xây dựng.
- Định dạng bắt buộc: CHỈ TRẢ VỀ DUY NHẤT một chuỗi JSON hợp lệ tuân thủ đúng Schema được định nghĩa. Tuyệt đối không thêm lời chào, không bọc trong ký hiệu markdown ```json ... ```.
```

##### 2. User Prompt (Dữ liệu đầu vào cụ thể):
```text
Dưới đây là thông tin chi tiết cần đánh giá:

=== THÔNG TIN JOB DESCRIPTION (JD) ===
Tiêu đề vị trí: {{jd_title}}
Số năm kinh nghiệm tối thiểu: {{jd_minExperience}} năm
Danh sách kỹ năng yêu cầu: {{jd_requiredSkills}}
Mô tả công việc:
{{jd_description}}

=== NỘI DUNG CV ỨNG VIÊN ===
Tên ứng viên: {{candidate_name}}
Nội dung văn bản trích xuất từ CV:
{{candidate_rawText}}

Hãy đánh giá mức độ phù hợp và trả về kết quả JSON theo đúng định dạng sau:
{
  "score": <số nguyên từ 0 đến 100>,
  "summary": "<Đoạn nhận xét đánh giá tổng quan bằng tiếng Việt từ 2 đến 4 câu>",
  "matchedSkills": ["<kỹ năng 1>", "<kỹ năng 2>"],
  "missingSkills": ["<kỹ năng còn thiếu 1>", "<kỹ năng còn thiếu 2>"]
}
```

#### B. Thiết kế JSON Schema kiểm soát đầu ra (Google Gemini SDK)

```typescript
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.2, // Giảm tính ngẫu nhiên để điểm số có tính nhất quán cao
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        score: {
          type: SchemaType.INTEGER,
          description: 'Điểm số phù hợp tổng thể từ 0 đến 100',
          nullable: false,
        },
        summary: {
          type: SchemaType.STRING,
          description: 'Đoạn tóm tắt nhận xét ưu và nhược điểm bằng tiếng Việt',
          nullable: false,
        },
        matchedSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Danh sách các kỹ năng ứng viên có đáp ứng yêu cầu của JD',
        },
        missingSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Danh sách các kỹ năng JD yêu cầu nhưng CV còn thiếu',
        },
      },
      required: ['score', 'summary', 'matchedSkills', 'missingSkills'],
    },
  },
});
```

#### C. Hàm Xử lý Ngoại lệ và Parse JSON An toàn tại Backend:
```typescript
export function sanitizeAndParseGeminiResponse(rawText: string) {
  try {
    // 1. Loại bỏ các khối code block markdown nếu có
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // 2. Parse JSON
    const parsed = JSON.parse(cleaned);

    // 3. Validate kiểu dữ liệu đầu ra
    if (
      typeof parsed.score !== 'number' ||
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.matchedSkills) ||
      parsed.matchedSkills.some((skill: unknown) => typeof skill !== 'string') ||
      !Array.isArray(parsed.missingSkills) ||
      parsed.missingSkills.some((skill: unknown) => typeof skill !== 'string')
    ) {
      throw new Error('Định dạng dữ liệu JSON không khớp schema mong đợi');
    }

    // Đảm bảo điểm số nằm trong khoảng 0-100
    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    return parsed;
  } catch (error) {
    console.error('Lỗi khi parse phản hồi từ Gemini:', rawText, error);
    // Trả về fallback an toàn không làm crash luồng
    return {
      score: 0,
      summary: 'Không thể phân tích tự động do phản hồi từ AI không đúng cấu trúc.',
      matchedSkills: [],
      missingSkills: [],
    };
  }
}
```

---

## TỔNG KẾT & CHẤP THUẬN TÀI LIỆU
Tài liệu PRD Chương 3 này định nghĩa toàn diện từ bối cảnh khám phá sản phẩm (Product Discovery), phạm vi và yêu cầu phi chức năng (PRD), ma trận truy vết và mô hình dữ liệu PostgreSQL (Requirements Analysis), hệ thống kịch bản kiểm thử hành vi Gherkin (User Stories & Acceptance Criteria), cho đến đặc tả chi tiết giao diện, RESTful API và kỹ thuật tích hợp Google Gemini AI.

Tài liệu này đóng vai trò là "nguồn chân lý duy nhất" (Single Source of Truth - SSOT) cho đội ngũ phát triển Frontend, Backend, AI Engineer và QA/QC trong toàn bộ vòng đời triển khai dự án **CVMikiri**.
