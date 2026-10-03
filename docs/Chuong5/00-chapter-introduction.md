# CHƯƠNG 5: THIẾT KẾ HỆ THỐNG (SYSTEM DESIGN)
## DỰ ÁN: CVMikiri — HỆ THỐNG KIỂM TRA, SÀNG LỌC VÀ CHẤM ĐIỂM CV THÔNG MINH

---

## 5.0 Cơ sở kế thừa & Quy ước tài liệu

Chương 5 chuyển các yêu cầu đã chốt ở **Chương 3 (PRD)** và **Chương 4 (UX/UI, kèm Phụ lục 4.1.5)** thành thiết kế kỹ thuật có thể triển khai trực tiếp. Mọi quyết định trong chương này phải truy vết được về một FR/NFR.

**Nguyên tắc giải quyết mâu thuẫn giữa các tài liệu:** PRD Chương 3 là nguồn chân lý (SSOT); phần đặc tả API của PRD là căn cứ khi UX và API mâu thuẫn nhau.

### 5.0.1 Các điểm lệch giữa các tài liệu đã được đồng bộ

| # | Hạng mục | Tài liệu Requirements cũ | PRD Chương 3 | **Quyết định của Chương 5** |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Cơ sở dữ liệu | MySQL (§1) / SQLite → PostgreSQL (NFR3) | PostgreSQL + Prisma | **PostgreSQL + Prisma** |
| 2 | AI Engine | Anthropic Claude (`ANTHROPIC_API_KEY`) | Google Gemini (`GEMINI_API_KEY`) | **Gemini**, đặt sau interface `AIMatchingProvider` để đổi nhà cung cấp mà không sửa nghiệp vụ |
| 3 | Biến môi trường | `ANTHROPIC_*`, `DATABASE_URL="file:./dev.db"` | `GEMINI_API_KEY`, PostgreSQL URL | Dùng bộ biến ở mục 5.1.6 |
| 4 | Matching đồng bộ vs. bất đồng bộ | Chỉ có `POST /api/matching/run` (đồng bộ) | Như Requirements | Giữ `run` cho lô nhỏ **và** thêm job bất đồng bộ (Phụ lục 4.1.5) để hỗ trợ tiến độ/hủy |
| 5 | Trạng thái trích xuất CV | Không có | Chỉ nêu "trạng thái cảnh báo" (mục 3.3.3) | Thêm trường `extractionStatus` (mục 5.4) |

> **Lưu ý khi đối chiếu:** các endpoint/trường từ Phụ lục 4.1.5 (`GET/PUT /api/jobs/:id`, `POST /api/matching/jobs`, cơ chế idempotency, `extractionStatus`) được tích hợp ở đây theo bản tóm tắt thiết kế. Hãy đối chiếu lại tên trường/đường dẫn với nội dung thực tế của Chương 4 trước khi chốt.

---
