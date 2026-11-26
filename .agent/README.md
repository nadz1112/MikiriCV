# .agent — Cấu hình cho AI coding agent (CVMikiri)

Thư mục này chứa ngữ cảnh và quy trình để agent code đúng kiến trúc của dự án.

- `rules/`      Quy tắc luôn áp dụng (ngữ cảnh, kiến trúc, chuẩn code, cách làm việc)
- `workflows/`  Quy trình theo yêu cầu, gọi bằng `/tên-file` (ví dụ `/add-page`)
- `skills/`     Kỹ năng chuyên biệt khi cần, mỗi skill một thư mục có `SKILL.md`

Nguồn chân lý: `docs/Chuong3_*` (PRD), `docs/Chuong4_*` (UX), `docs/Chuong5_CVMikiri_ThietKeHeThong.md` (thiết kế).
Không đặt bí mật (API key, mật khẩu) trong thư mục này. Thư mục được commit vào Git để cả nhóm dùng chung.

## Skill hiện có

- [github-pr-review](skills/github-pr-review/SKILL.md): review thay đổi trong PR, chỉ đọc và báo lỗi có bằng chứng.
- [cvmikiri-api-development](skills/cvmikiri-api-development/SKILL.md): thêm/sửa API, validation, nghiệp vụ và DTO backend.
- [cvmikiri-frontend-workflows](skills/cvmikiri-frontend-workflows/SKILL.md): form, popup, bộ lọc, request bị hủy và cập nhật nền.
- [cvmikiri-permission-audit](skills/cvmikiri-permission-audit/SKILL.md): kiểm tra ADMIN/ENTERPRISE, cách ly dữ liệu và phiên đăng nhập theo đặc tả.
- [cvmikiri-cv-ai-pipeline](skills/cvmikiri-cv-ai-pipeline/SKILL.md): trích xuất CV, bảo vệ thông tin cá nhân, matching và ghi nhận chi phí AI.

Có thể yêu cầu agent đọc skill theo đường dẫn trên, ví dụ: "Dùng `.agent/skills/cvmikiri-permission-audit/SKILL.md` kiểm tra quyền tải file CV, chỉ đọc và báo cáo." Việc tự phát hiện skill phụ thuộc công cụ agent đang dùng; thêm vào `.agent/skills` không tự cài skill toàn cục cho mọi công cụ.
