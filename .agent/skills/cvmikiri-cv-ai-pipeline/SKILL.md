---
name: cvmikiri-cv-ai-pipeline
description: Diagnose or change CVMikiri CV extraction, personal-data handling, selected-candidate matching, provider failures, and AI usage accounting. Use when working on the CV-to-AI data flow rather than unrelated UI or API changes.
---

# Xử lý CV và AI CVMikiri

Đọc `AGENTS.md`, `.agent/rules/01-architecture.md` và theo dấu dữ liệu từ upload đến request provider. Không kết luận dữ liệu đã được ẩn danh chỉ vì prompt có yêu cầu bỏ qua thông tin cá nhân.

## Bản đồ code

- Trích văn bản và parse cục bộ: `backend/src/modules/candidates/text-extractor.ts`, `field-parser.ts`, `candidate.service.ts` trong `backend/src/services/`.
- Hồ sơ gửi đi: `backend/src/modules/candidates/matching-profile.ts`; hiện allowlist kỹ năng chuẩn hóa và số năm kinh nghiệm.
- Điều phối matching: `backend/src/services/matching.service.ts`; tìm interface `AIMatchingProvider` và implementation đang được import trước khi đổi lời gọi.
- Kiểm tra cả tiện ích `backend/src/utils/geminiParser.ts` và caller của nó nếu đánh giá toàn bộ đường gửi dữ liệu; không suy chỉ từ một đường matching.
- Test liên quan: `backend/tests/cv-extraction.test.ts`, `matching-privacy.test.ts`, `matching-usage.test.ts`, `candidate-delete.test.ts`.

## Bất biến xử lý

- Phân biệt extraction cục bộ với provider bên ngoài. Nếu yêu cầu xử lý PII trong máy, bảo vệ bằng allowlist payload ngay tại ranh giới provider; không gửi rawText, tên/email/điện thoại, tên tệp hoặc đối tượng candidate đầy đủ. Kiểm tra JD, metadata và log cũng không vô tình mang PII theo luồng được sửa.
- Chuẩn hóa kỹ năng qua từ điển hiện có; không mở rộng dữ liệu gửi AI chỉ để tăng độ chi tiết nếu trái với phạm vi bảo mật đã yêu cầu.
- Matching chỉ nhận candidateIds người dùng chọn. Kiểm tra quyền với JD và từng ứng viên, loại bỏ selection đã xóa ở frontend và chặn ID không hợp lệ ở backend. Không tự chuyển sang chấm tất cả khi selection rỗng.
- Giữ abstraction provider và concurrency có giới hạn. Lỗi mạng/provider/parse là failure rõ ràng, không trả điểm giả hoặc fallback hợp lý như một kết quả thành công.
- Khi thay retry hoặc chấm lại, kiểm tra AiUsage ghi nhận các lần gọi theo hợp đồng hiện có, kể cả lỗi; tránh đếm trùng. Chi phí là ước tính; lịch sử không bị cascade mất khi xóa tài khoản.
- Khi sửa xóa CV, DB phải xóa thành công trước khi unlink; kiểm tra đường dẫn thuộc upload root. Không để lỗi cleanup file làm client hiểu nhầm bản ghi chưa xóa.

## Xác minh

Dùng CV fixture tổng hợp và provider mock, không CV thật có PII. Với privacy test, kiểm tra payload thực sự truyền vào provider và absence của dữ liệu nhạy cảm, không chỉ so khớp lời prompt. Với lỗi provider, kiểm tra trạng thái lỗi và usage thay vì chỉ kiểm tra status HTTP.

Chạy test liên quan bằng `npm.cmd --prefix backend test -- tests/<ten-test>.test.ts` và build backend khi đổi TypeScript. Không gọi Gemini thật, upload CV thật hoặc phát sinh chi phí như bước mặc định; nêu rõ nếu chưa kiểm chứng bằng provider thật. Không log bí mật hay nội dung CV để debug.
