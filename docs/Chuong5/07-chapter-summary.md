## Tổng kết Chương 5

Thiết kế hệ thống của CVMikiri xoay quanh ba quyết định cốt lõi: **(1)** modular monolith phân tầng, gói gọn bằng Docker Compose; **(2)** kiến trúc **lọc 2 tầng** giữ chi phí AI thấp, kèm xử lý **bất đồng bộ có tiến độ và hủy** cho lô lớn; **(3)** cô lập mọi dịch vụ ngoài (Gemini, lưu trữ tệp) sau các interface để đổi được mà không sửa nghiệp vụ.

### Các điểm cần đồng bộ ngược về các chương trước

| # | Chương | Nội dung cần cập nhật |
| :--- | :--- | :--- |
| 1 | Chương 3 — mục 3.2.1, NFR3 | Xác nhận PostgreSQL + Gemini là cấu hình duy nhất; loại bỏ nhắc tới MySQL/Claude/SQLite trong tài liệu Requirements |
| 2 | Chương 3 — mục 3.3.4 | Thay Prisma schema bằng bản ở mục 5.4.3 |
| 3 | Chương 3 — mục 3.5.2 | Bổ sung endpoint mới (mục 5.5.2), `extractionStatus`, `skillMode`, phân trang |
| 4 | Chương 3 — mục 3.5.3-C | Thay hàm fallback `score: 0` bằng cơ chế ném `AI_INVALID_RESPONSE` (mục 5.6.4) |
| 5 | Chương 3 — mục 3.5.3-A | Thêm khung chống prompt-injection quanh nội dung CV |
| 6 | Chương 3 — mục 3.3.2 (RTM) | Thay bằng ma trận ở mục 5.5.7 |
| 7 | Chương 4 — Phụ lục 4.1.5 | Đối chiếu tên trường/đường dẫn job bất đồng bộ và idempotency với mục 5.5.3 |
| 8 | Chương 4 | UI cần xử lý `extractionStatus` (`WARNING`/`FAILED`) và `errors[]` theo từng ứng viên của `matching/run` |

### Việc triển khai tiếp theo (đề xuất theo từng trang)

1. Khởi tạo khung `backend` + `prisma` + `docker-compose` (có `GET /api/health`).
2. Module `jobs` + trang **Job Descriptions**.
3. Module `candidates` (ingestion, lọc) + trang **Quản lý CV**.
4. Module `matching` (đồng bộ → bất đồng bộ) + trang **AI Matching Studio**.
5. Module `stats` + trang **Dashboard**.
