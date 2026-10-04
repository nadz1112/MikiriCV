# .agent — Cấu hình cho AI coding agent (CVMikiri)

Thư mục này chứa ngữ cảnh và quy trình để agent code đúng kiến trúc của dự án.

- `rules/`      Quy tắc luôn áp dụng (ngữ cảnh, kiến trúc, chuẩn code, cách làm việc)
- `workflows/`  Quy trình theo yêu cầu, gọi bằng `/tên-file` (ví dụ `/add-page`)
- `skills/`     (để trống) Kỹ năng chuyên biệt khi cần, mỗi skill một thư mục có `SKILL.md`

Nguồn chân lý: `docs/Chuong3_*` (PRD), `docs/Chuong4_*` (UX), `docs/Chuong5_CVMikiri_ThietKeHeThong.md` (thiết kế).
Không đặt bí mật (API key, mật khẩu) trong thư mục này. Thư mục được commit vào Git để cả nhóm dùng chung.
