## 5.3 Mô hình hóa Hệ thống & UML

### 5.3.1 Biểu đồ Use Case

```mermaid
flowchart LR
    hr(["HR Recruiter"])
    hm(["Hiring Manager"])
    ai(["Gemini API"])

    subgraph sys["Hệ thống CVMikiri"]
        uc1(["UC-01 Quản lý JD"])
        uc2(["UC-02 Upload CV hàng loạt"])
        uc2a(["Trích xuất và bóc tách thông tin"])
        uc3(["UC-03 Lọc CV theo quy tắc"])
        uc4(["UC-04 Chạy AI Matching"])
        uc4a(["Gọi AI chấm điểm"])
        uc4b(["Theo dõi tiến độ / Hủy job"])
        uc5(["UC-05 Xem bảng xếp hạng và chi tiết"])
        uc6(["UC-06 Xóa ứng viên"])
    end

    hr --- uc1 & uc2 & uc3 & uc4 & uc6 & uc5
    hm --- uc5
    uc2 -.->|include| uc2a
    uc4 -.->|include| uc4a
    uc4 -.->|extend| uc4b
    uc4a --- ai
```

| Use case | Tác nhân chính | Tiền điều kiện | Luồng chính | Ngoại lệ | Truy vết |
| :--- | :--- | :--- | :--- | :--- | :--- |
| UC-01 Quản lý JD | HR | — | Tạo/xem/sửa/xóa JD | Thiếu trường → lỗi tiếng Việt | FR1, US-01 |
| UC-02 Upload CV | HR | — | Chọn file → hệ thống lưu, trích xuất, bóc tách → trả danh sách thành công/thất bại | Sai định dạng, quá 10MB, PDF scan/khóa mật khẩu | FR2, US-02 |
| UC-03 Lọc CV | HR | Có ≥ 1 ứng viên | Nhập từ khóa/kỹ năng/kinh nghiệm → danh sách cập nhật | Không có kết quả → trạng thái rỗng | FR3, US-03 |
| UC-04 AI Matching | HR / HM | Có JD và tập CV đã chọn | Chọn JD + CV → chạy → lưu kết quả (upsert) | AI lỗi/429/JSON sai → mục lỗi, job tiếp tục | FR4, US-04 |
| UC-05 Xem xếp hạng | HM / HR | Có kết quả matching | Mở bảng xếp hạng theo JD → mở drawer chi tiết | JD chưa có kết quả → hướng dẫn chạy matching | FR5.2–5.3, US-05 |
| UC-06 Xóa ứng viên | HR | Ứng viên tồn tại | Xác nhận → xóa DB (cascade) → xóa tệp | Xóa tệp lỗi → ghi log tệp mồ côi | FR5.4, US-06 |

### 5.3.2 Biểu đồ Lớp — Mô hình miền (Domain Model)

```mermaid
classDiagram
    class JobDescription {
        +String id
        +String title
        +String description
        +String[] requiredSkills
        +Int minExperience
        +DateTime createdAt
        +DateTime updatedAt
    }
    class Candidate {
        +String id
        +String fullName
        +String email
        +String phone
        +String rawText
        +String searchText
        +String[] skills
        +Int yearsOfExperience
        +String education
        +String fileName
        +String fileUrl
        +ExtractionStatus extractionStatus
        +String extractionMessage
    }
    class MatchResult {
        +String id
        +Int score
        +String summary
        +String[] matchedSkills
        +String[] missingSkills
        +String modelName
        +DateTime updatedAt
    }
    class MatchingJob {
        +String id
        +MatchingJobStatus status
        +Int total
        +Int processed
        +Int failed
        +Boolean cancelRequested
    }
    class MatchingJobItem {
        +String id
        +MatchingItemStatus status
        +Int attempts
        +String errorMessage
    }
    JobDescription "1" --> "0..*" MatchResult
    Candidate "1" --> "0..*" MatchResult
    JobDescription "1" --> "0..*" MatchingJob
    MatchingJob "1" *-- "1..*" MatchingJobItem
    Candidate "1" --> "0..*" MatchingJobItem
```

### 5.3.3 Biểu đồ Lớp — Tầng dịch vụ & Adapter

```mermaid
classDiagram
    class IngestionService {
        +ingest(files, idempotencyKey) IngestResult
    }
    class TextExtractor {
        <<interface>>
        +supports(mime) Boolean
        +extract(filePath) Promise~String~
    }
    class PdfTextExtractor
    class DocxTextExtractor
    class FieldParser {
        +parse(rawText, fileName) ParsedFields
    }
    class SkillNormalizer {
        +normalize(skill) String
        +detect(text) String[]
    }
    class FileStorage {
        <<interface>>
        +save(file) Promise~String~
        +read(key) ReadStream
        +remove(key) Promise~void~
    }
    class LocalFileStorage
    class MatchingService {
        +runSync(jobId, candidateIds) MatchResult[]
        +createJob(jobId, candidateIds) MatchingJob
        +getJob(id) MatchingJob
        +cancelJob(id) MatchingJob
    }
    class MatchingJobRunner {
        +enqueue(jobId) void
        +resumePending() void
    }
    class AIMatchingProvider {
        <<interface>>
        +evaluate(input) Promise~MatchOutput~
    }
    class GeminiMatchingProvider
    class CandidateRepository {
        +findMany(filter, page) Candidate[]
        +create(data) Candidate
        +delete(id) void
    }

    IngestionService --> TextExtractor
    IngestionService --> FieldParser
    IngestionService --> FileStorage
    IngestionService --> CandidateRepository
    FieldParser --> SkillNormalizer
    TextExtractor <|.. PdfTextExtractor
    TextExtractor <|.. DocxTextExtractor
    FileStorage <|.. LocalFileStorage
    MatchingService --> MatchingJobRunner
    MatchingService --> AIMatchingProvider
    MatchingJobRunner --> AIMatchingProvider
    AIMatchingProvider <|.. GeminiMatchingProvider
```

### 5.3.4 Biểu đồ Tuần tự

#### A. Upload CV có idempotency (UC-02)

```mermaid
sequenceDiagram
    autonumber
    actor HR
    participant FE as Frontend SPA
    participant API as Middleware + Controller
    participant ING as IngestionService
    participant ST as FileStorage
    participant EXT as TextExtractor
    participant DB as PostgreSQL

    HR->>FE: Kéo thả N file CV
    FE->>FE: Kiểm tra sơ bộ đuôi file và dung lượng
    FE->>API: POST /api/candidates/upload (Idempotency-Key)
    API->>API: Multer lưu tạm, kiểm tra MIME và magic bytes
    API->>ING: ingest(files, key)
    ING->>DB: Đăng ký idempotency key
    alt Key đã hoàn tất với cùng requestHash
        DB-->>ING: Phản hồi đã lưu
        ING-->>FE: 200 phát lại phản hồi cũ
    else Key mới
        loop Mỗi file hợp lệ
            ING->>ST: save(file) thành uuid-tenfile
            ING->>EXT: extract(file)
            EXT-->>ING: rawText hoặc lỗi
            ING->>ING: parse trường, chuẩn hóa kỹ năng, tạo searchText
            ING->>DB: INSERT Candidate kèm extractionStatus
        end
        ING->>DB: Lưu phản hồi vào idempotency key
        ING-->>FE: 200 data[] và errors[]
    end
    FE-->>HR: Toast "Đã xử lý x/N hồ sơ"
```

#### B. AI Matching bất đồng bộ (UC-04)

```mermaid
sequenceDiagram
    autonumber
    actor HR
    participant FE as Frontend SPA
    participant API as MatchingController
    participant MS as MatchingService
    participant RUN as MatchingJobRunner
    participant AI as GeminiMatchingProvider
    participant G as Gemini API
    participant DB as PostgreSQL

    HR->>FE: Chọn JD, tích chọn CV, bấm Chạy AI Matching
    FE->>API: POST /api/matching/jobs
    API->>MS: createJob(jobId, candidateIds)
    MS->>DB: Tạo MatchingJob và Items (PENDING)
    MS->>RUN: enqueue(jobId)
    API-->>FE: 202 Accepted (jobId)
    loop Polling mỗi 2 giây
        FE->>API: GET /api/matching/jobs/:id
        API-->>FE: status, processed, total, failed
    end
    par Chạy nền
        loop Từng đợt tối đa MATCH_CONCURRENCY mục
            RUN->>DB: Đọc cancelRequested
            alt Đã yêu cầu hủy
                RUN->>DB: Các mục PENDING chuyển SKIPPED, job CANCELLED
            else Tiếp tục
                RUN->>AI: evaluate(JD, CV)
                AI->>G: generateContent (responseSchema)
                G-->>AI: JSON
                AI->>AI: Làm sạch và kiểm tra Zod
                AI-->>RUN: MatchOutput hoặc AiError
                RUN->>DB: Upsert MatchResult, cập nhật Item và bộ đếm
            end
        end
        RUN->>DB: Job COMPLETED
    end
    FE-->>HR: Cập nhật bảng điểm khi job kết thúc
```

#### C. Xóa ứng viên (UC-06)

```mermaid
sequenceDiagram
    autonumber
    actor HR
    participant FE as Frontend SPA
    participant API as CandidateController
    participant CS as CandidateService
    participant DB as PostgreSQL
    participant ST as FileStorage

    HR->>FE: Bấm Xóa ứng viên và xác nhận
    FE->>API: DELETE /api/candidates/:id
    API->>CS: remove(id)
    CS->>DB: Đọc fileUrl
    CS->>DB: DELETE Candidate (cascade MatchResult và JobItem)
    DB-->>CS: OK
    CS->>ST: remove(fileUrl)
    alt Xóa tệp lỗi
        ST-->>CS: Lỗi
        CS->>CS: Ghi log cảnh báo tệp mồ côi, không làm hỏng yêu cầu
    end
    CS-->>FE: 200 thông báo thành công
```

> **Thứ tự quan trọng:** xóa bản ghi DB **trước**, xóa tệp **sau**. Nếu ngược lại, lỗi giữa chừng sẽ để lại bản ghi trỏ tới tệp không tồn tại (xấu hơn một tệp mồ côi). Tệp mồ côi được dọn bằng lệnh bảo trì định kỳ (mục 5.4.8).

### 5.3.5 Biểu đồ Hoạt động — Pipeline trích xuất CV

```mermaid
flowchart TD
    A(["Nhận file"]) --> B{"Đuôi, MIME, magic bytes<br/>và dung lượng hợp lệ?"}
    B -- Không --> E1["Ghi vào errors[]<br/>FILE_TOO_LARGE hoặc UNSUPPORTED_FILE_TYPE<br/>Không lưu bản ghi"]
    B -- Có --> C["Lưu tệp với tên uuid-tenfile"]
    C --> D["Trích xuất rawText<br/>pdf-parse hoặc mammoth"]
    D --> F{"rawText có nội dung?"}
    F -- "Không hoặc lỗi" --> G["Tạo Candidate<br/>extractionStatus = FAILED<br/>kèm extractionMessage"]
    F -- Có --> H["Bóc tách họ tên, email, SĐT,<br/>kinh nghiệm, kỹ năng"]
    H --> I{"Thiếu email hoặc SĐT<br/>hoặc không có kỹ năng?"}
    I -- Có --> J["extractionStatus = WARNING"]
    I -- Không --> K["extractionStatus = SUCCESS"]
    J --> L["Tạo searchText và lưu Candidate"]
    K --> L
    G --> M(["Trả kết quả cho FE"])
    L --> M
    E1 --> M
```

### 5.3.6 Biểu đồ Trạng thái

**Vòng đời `MatchingJob`:**

```mermaid
stateDiagram-v2
    [*] --> QUEUED
    QUEUED --> RUNNING: Runner nhận job
    QUEUED --> CANCELLED: Người dùng hủy
    RUNNING --> COMPLETED: Xử lý hết các mục
    RUNNING --> CANCELLED: Người dùng hủy
    RUNNING --> FAILED: Lỗi hệ thống không phục hồi
    RUNNING --> QUEUED: Khởi động lại máy chủ
    COMPLETED --> [*]
    CANCELLED --> [*]
    FAILED --> [*]
```

**Vòng đời `MatchingJobItem`:**

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> DONE: AI trả kết quả hợp lệ
    PENDING --> FAILED: Hết lượt retry hoặc ứng viên không đọc được
    PENDING --> SKIPPED: Job bị hủy trước khi chạy
    FAILED --> PENDING: Chạy lại thủ công
    DONE --> [*]
    SKIPPED --> [*]
```

**`Candidate.extractionStatus`:**

```mermaid
stateDiagram-v2
    [*] --> SUCCESS: Đủ nội dung và thông tin liên hệ
    [*] --> WARNING: Có nội dung nhưng thiếu trường quan trọng
    [*] --> FAILED: Không đọc được nội dung
```

> Ý nghĩa nghiệp vụ: `SUCCESS` — dùng bình thường; `WARNING` — vẫn được chấm AI nhưng HR nên kiểm tra thông tin liên hệ; `FAILED` — **không** được chạy AI Matching, giao diện hiển thị thông điệp ở `extractionMessage` (mục 3.3.3-1).

### 5.3.7 Biểu đồ Thành phần Frontend

```mermaid
flowchart TB
    subgraph pages["Pages"]
        p1["JobsPage"]
        p2["CandidatesPage"]
        p3["MatchingStudioPage"]
        p4["DashboardPage"]
    end
    subgraph feat["Features: components + hooks + store"]
        f1["jobs"]
        f2["candidates<br/>UploadDropzone, FilterBar, DataTable"]
        f3["matching<br/>useMatchingJob polling, AIInsightModal"]
        f4["dashboard<br/>Leaderboard, ScoreChart"]
    end
    subgraph shared["Shared"]
        s1["httpClient Axios<br/>interceptor lỗi, toast tiếng Việt"]
        s2["ScoreBadge, EmptyState, ConfirmDialog"]
    end
    p1 --> f1
    p2 --> f2
    p3 --> f3
    p4 --> f4
    f1 & f2 & f3 & f4 --> s1
    f2 & f3 & f4 --> s2
```

---
