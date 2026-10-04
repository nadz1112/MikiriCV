# CHƯƠNG 3: AI TRONG PHÂN TÍCH YÊU CẦU & SẢN PHẨM
## DỰ ÁN: CVMikiri — HỆ THỐNG KIỂM TRA, SÀNG LỌC VÀ CHẤM ĐIỂM CV THÔNG MINH

---

## 3.4 User Stories & Tiêu chí Chấp nhận (User Stories & Acceptance Criteria)

### US-01: Quản lý Bản mô tả công việc (Job Description Management)
* **Là một**: Nhà tuyển dụng (HR Recruiter)
* **Tôi muốn**: Tạo mới, xem lại và xóa các bản mô tả công việc (JD)
* **Để tôi**: Có căn cứ tiêu chuẩn kỹ thuật làm chuẩn đối sánh để lọc và chấm điểm các hồ sơ ứng viên.

#### Tiêu chí chấp nhận (Acceptance Criteria - Gherkin Format):
```gherkin
Scenario: Tạo Job Description mới thành công
  Given Tôi đang ở trang Quản lý JD và mở form "Tạo JD mới"
  When Tôi nhập tiêu đề là "Senior Fullstack Developer"
  And Tôi nhập mô tả chi tiết công việc
  And Tôi thêm các kỹ năng yêu cầu gồm: "React", "Node.js", "PostgreSQL", "Docker"
  And Tôi đặt số năm kinh nghiệm tối thiểu là 3
  And Tôi nhấn nút "Lưu JD"
  Then Hệ thống lưu thông tin JD vào cơ sở dữ liệu PostgreSQL
  And Hiển thị thông báo thành công "Tạo Job Description thành công"
  And JD mới xuất hiện ngay trên đầu danh sách JD

Scenario: Báo lỗi khi thiếu các trường bắt buộc lúc tạo JD
  Given Tôi đang mở form "Tạo JD mới"
  When Tôi để trống trường "Tiêu đề" hoặc không chọn bất kỳ kỹ năng yêu cầu nào
  And Tôi nhấn nút "Lưu JD"
  Then Hệ thống ngăn chặn việc gửi dữ liệu
  And Hiển thị thông báo lỗi bằng tiếng Việt tại các trường bị thiếu

Scenario: Xóa Job Description và các kết quả liên quan
  Given Tôi có một JD tên là "Junior Frontend" đã có 10 kết quả đánh giá AI (MatchResult)
  When Tôi nhấn nút "Xóa" tại JD này và xác nhận hộp thoại cảnh báo
  Then Hệ thống xóa bản ghi JD khỏi PostgreSQL
  And Tự động cascade xóa sạch 10 bản ghi MatchResult tương ứng
  And Danh sách JD được cập nhật lại không còn hiển thị JD vừa xóa
```

---

### US-02: Tải lên hàng loạt và Tự động Bóc tách dữ liệu CV
* **Là một**: Chuyên viên tuyển dụng
* **Tôi muốn**: Kéo thả nhiều file CV định dạng PDF/DOCX vào hệ thống cùng lúc
* **Để tôi**: Tự động chuyển đổi hồ sơ thành dữ liệu có cấu trúc mà không phải gõ tay thông tin từng ứng viên.

#### Tiêu chí chấp nhận (Acceptance Criteria - Gherkin Format):
```gherkin
Scenario: Tải lên nhiều file PDF và DOCX hợp lệ
  Given Tôi đang ở khu vực "Tải lên CV"
  When Tôi chọn kéo thả 5 file gồm 3 file .pdf và 2 file .docx có dung lượng mỗi file dưới 10MB
  Then Hệ thống hiển thị thanh tiến trình tải lên
  And Backend lưu các file vào thư mục lưu trữ uploads với tên file gán UUID duy nhất
  And Thư viện trích xuất đọc thành công nội dung text của cả 5 file
  And Hệ thống nhận diện được Họ tên, Email, SĐT của các ứng viên và lưu vào bảng Candidate
  And Hiển thị thông báo toast: "Tải lên và xử lý thành công 5/5 hồ sơ"

Scenario: Tải lên file sai định dạng hoặc vượt quá kích thước
  Given Tôi đang ở khu vực "Tải lên CV"
  When Tôi cố gắng tải lên một file ảnh "cv_candidate.png" hoặc một file PDF có dung lượng 15MB
  Then Hệ thống lập tức từ chối nhận file
  And Hiển thị thông báo lỗi cụ thể: "File cv_candidate.png không đúng định dạng hỗ trợ (PDF, DOCX)" hoặc "Dung lượng vượt quá giới hạn 10MB"
```

---

### US-03: Sàng lọc nhanh ứng viên theo Quy tắc (Rule-based Filter)
* **Là một**: Nhà tuyển dụng
* **Tôi muốn**: Tìm kiếm ứng viên bằng từ khóa, bộ lọc số năm kinh nghiệm và danh sách kỹ năng
* **Để tôi**: Nhanh chóng thu hẹp danh sách ứng viên phù hợp trước khi đưa vào chấm điểm AI chuyên sâu.

#### Tiêu chí chấp nhận (Acceptance Criteria - Gherkin Format):
```gherkin
Scenario: Lọc ứng viên kết hợp kỹ năng và số năm kinh nghiệm
  Given Danh sách đang hiển thị 100 ứng viên đã lưu trong hệ thống
  When Tôi nhập số năm kinh nghiệm tối thiểu là 2
  And Tôi chọn kỹ năng cần tìm là "PostgreSQL"
  Then Danh sách ngay lập tức cập nhật trong vòng dưới 100ms
  And Chỉ hiển thị các ứng viên có kinh nghiệm >= 2 năm và nội dung hồ sơ có chứa kỹ năng "PostgreSQL"
  And Hiển thị số lượng kết quả tương ứng (ví dụ: "Tìm thấy 12 ứng viên phù hợp")

Scenario: Tìm kiếm từ khóa tự do không dấu
  Given Danh sách đang có ứng viên tên "Nguyễn Văn An" với mô tả kinh nghiệm "Lập trình viên ReactJS"
  When Tôi gõ vào thanh tìm kiếm từ khóa "reactjs" hoặc "nguyen van an"
  Then Hệ thống trả về kết quả khớp ứng viên "Nguyễn Văn An" không phân biệt chữ hoa chữ thường
```

---

### US-04: Đánh giá và Chấm điểm phù hợp bằng Google Gemini AI
* **Là một**: Nhà tuyển dụng hoặc Trưởng nhóm chuyên môn
* **Tôi muốn**: Chọn một JD và danh sách các ứng viên đã lọc để yêu cầu Gemini AI chấm điểm
* **Để tôi**: Có được điểm số khách quan, nắm rõ kỹ năng ứng viên đáp ứng và các khoảng trống kỹ năng cần xem xét.

#### Tiêu chí chấp nhận (Acceptance Criteria - Gherkin Format):
```gherkin
Scenario: Chạy AI Matching thành công với Gemini API
  Given Tôi đã chọn JD "NodeJS Backend Developer"
  And Tôi tích chọn 5 ứng viên từ danh sách đã lọc
  When Tôi nhấn nút "Chạy AI Matching"
  Then Hệ thống hiển thị hiệu ứng đang xử lý (loading status) cho từng ứng viên
  And Backend gửi prompt kèm text của từng CV và JD sang Google Gemini API
  And Gemini trả về kết quả JSON chuẩn với các trường: score (0-100), summary, matchedSkills, missingSkills
  And Dữ liệu được lưu vào bảng MatchResult trong PostgreSQL
  And Giao diện cập nhật điểm số và nhận xét chi tiết ngay cạnh từng ứng viên

Scenario: Chạy lại matching cho cặp CV - JD đã từng chấm điểm
  Given Ứng viên "Trần Văn B" đã từng được chấm điểm cho JD "NodeJS Backend Developer" với điểm cũ là 65
  When Tôi thực hiện chạy matching lại cho cặp này
  Then Hệ thống ghi đè (Upsert) kết quả mới vào bản ghi MatchResult cũ
  And Không tạo ra bản ghi trùng lặp vi phạm ràng buộc Unique
```

---

### US-05: Xem Bảng xếp hạng và Chi tiết Kết quả Phân tích
* **Là một**: Trưởng nhóm tuyển dụng
* **Tôi muốn**: Xem danh sách ứng viên của một JD được sắp xếp theo điểm số AI từ cao xuống thấp
* **Để tôi**: Dễ dàng lựa chọn top những ứng viên sáng giá nhất để lên lịch mời phỏng vấn.

#### Tiêu chí chấp nhận (Acceptance Criteria - Gherkin Format):
```gherkin
Scenario: Xem bảng xếp hạng ứng viên theo JD
  Given Có 15 ứng viên đã được chấm điểm AI cho JD "Senior React Developer"
  When Tôi truy cập vào trang "Bảng xếp hạng" của JD này
  Then Danh sách ứng viên tự động sắp xếp theo thứ tự điểm số giảm dần (từ 100 xuống 0)
  And Mỗi ứng viên hiển thị huy hiệu điểm số có màu tương ứng:
    | Điểm số | Màu sắc huy hiệu |
    | >= 80   | Xanh lá cây (Rất phù hợp) |
    | 50 - 79 | Vàng hổ phách (Khá phù hợp) |
    | < 50    | Đỏ nhạt (Chưa đạt) |

Scenario: Xem chi tiết phân tích của một ứng viên
  Given Tôi đang xem bảng xếp hạng
  When Tôi nhấn vào tên ứng viên "Lê Hoàng C" (Điểm: 88)
  Then Hệ thống mở drawer/modal chi tiết hiển thị:
    - Đoạn văn bản tóm tắt nhận xét của Gemini AI
    - Danh sách các tag kỹ năng đạt yêu cầu (xanh lá)
    - Danh sách các tag kỹ năng còn thiếu (đỏ gạch)
    - Nút bấm tải/xem lại file CV gốc
```

---

### US-06: Quản lý và Xóa Ứng viên (Data Integrity & Cascade Delete)
* **Là một**: Quản trị viên hệ thống tuyển dụng
* **Tôi muốn**: Xóa bỏ một hồ sơ ứng viên không còn sử dụng
* **Để tôi**: Làm sạch dữ liệu và giải phóng dung lượng lưu trữ trên hệ thống.

#### Tiêu chí chấp nhận (Acceptance Criteria - Gherkin Format):
```gherkin
Scenario: Xóa ứng viên thành công
  Given Ứng viên "Phạm Văn D" có file gốc lưu trên ổ đĩa và có 3 kết quả MatchResult với 3 JD khác nhau
  When Tôi nhấn nút "Xóa ứng viên" và xác nhận
  Then Hệ thống xóa bản ghi ứng viên khỏi bảng Candidate
  And Toàn bộ 3 bản ghi MatchResult liên kết tự động bị xóa sạch khỏi bảng match_results
  And File vật lý trong thư mục uploads của server bị xóa an toàn
  And Giao diện cập nhật lại không còn ứng viên đó
```

---

