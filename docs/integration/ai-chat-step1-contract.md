# Bước 1: phiên hội thoại RAG

Tài liệu mô tả baseline bước 1. [Bước 2](./ai-safety-step2-contract.md) bổ sung Safety Gate, metadata `safety`, các phase chat và quy tắc ưu tiên cảnh báo; tham chiếu tài liệu đó cho contract hiện tại.

Backend hội thoại nằm trong `D:\rag-phu-san-chatbot`. Đồ án giữ frontend và route gateway. Bước này chưa thêm tool đặt lịch, graph điều phối, memory bệnh án hoặc bộ rule cấp cứu của bước 2.

## API đã triển khai

Frontend đăng nhập gọi gateway `http://localhost:8080/api/assistant`. Kong chuyển nguyên đường dẫn đến Python tại `host.docker.internal:8000`. Gateway kiểm tra JWT; Python xác minh tiếp RS256, chữ ký theo JWKS, issuer, audience, hạn token và vai trò PATIENT. Chủ phiên lấy từ `sub`, không lấy từ body hoặc header tự khai báo.

- `POST /api/assistant/conversations`: tạo phiên, HTTP 201.
- `GET /api/assistant/conversations/{conversationId}`: lấy messages và state.
- `POST /api/assistant/conversations/{conversationId}/messages`: body `{ "message": "...", "requestId": "UUID" }`.
- `DELETE /api/assistant/conversations/{conversationId}`: xóa cả phiên và lịch sử, HTTP 204.

Response lượt chat có `conversationId`, `answer`, `citations`, `sources`, `insufficientEvidence`, `state`, `actions`, `messages`, `disclaimer`, `latency`. `state` hiện gồm `phase: "qa"` và `turnCount`; không liên quan AppointmentStatus. `actions` hiện luôn rỗng. `messages` là cặp tin nhắn vừa lưu, không phải toàn bộ lịch sử.

Citation gồm `index`, `chunkId`, `document`, `section`, `excerpt`. Metadata đi từ index qua fusion/reranker/pipeline ra API. Chỉ citation `[n]` có chunk và nguồn thật mới được công bố là nguồn của câu trả lời. `sources` là các đoạn tìm được, không đồng nghĩa đã chứng minh mọi phát biểu. Thiếu nguồn, trích số nguồn không tồn tại hoặc RAG từ chối thì trả `insufficientEvidence: true`, không khẳng định thành công. Đây là kiểm tra khả năng truy nguyên nguồn, chưa phải bộ kiểm chứng nội dung y khoa.

Để tương thích, `POST http://localhost:8000/api/chat` còn phục vụ hỏi đáp khách từng câu độc lập; không lưu hay đọc phiên cá nhân. Giữ alias `insufficient_evidence` và `sources` cho UI cũ. Khách không có memory hội thoại và được thông báo trên widget.

## Chính sách phiên

- Lưu SQLite riêng trong `data/private`, không thêm bảng vào các database nghiệp vụ. Nội dung messages, state và cache request được mã hóa Fernet trước khi ghi. UUID tài khoản/chủ phiên và thời điểm cập nhật vẫn là metadata truy vấn, không phải PHI nội dung.
- Khóa lấy từ `CHAT_SESSION_ENCRYPTION_KEY` hoặc tự tạo ở `data/private/session.key`. Thư mục này bị gitignore. Khi đưa lên môi trường dùng chung phải đặt khóa trong secret manager, giới hạn ACL thư mục và sao lưu khóa cùng dữ liệu theo quy trình riêng; không commit khóa. `chmod` trên Windows không thay thế cấu hình ACL quản trị.
- Một worker Python cho triển khai SQLite này. Khóa theo phiên trong cùng process giữ thứ tự lượt và chống mất cập nhật. Khi chạy nhiều worker/replica cần chuyển sang kho có transaction/locking dùng chung.
- Tối đa 100 lượt/phiên, truyền tối đa 6 tin nhắn gần nhất cho generator, tổng lịch sử tối đa 2.000 ký tự. Generator dùng JSON schema của Ollama để lấy answer/citations/insufficientEvidence, kiểm tra kiểu và phạm vi số nguồn. Các câu tiếp nối có dấu hiệu tham chiếu dùng câu hỏi trước làm ngữ cảnh retrieval. Đây là hỗ trợ ngữ cảnh giới hạn, không phải bộ hiểu hội thoại đã benchmark.
- Lịch sử cũ không là bằng chứng y khoa; nguồn của lượt hiện tại mới được trích dẫn. Không đọc hồ sơ bệnh án trong bước 1.
- Phiên không hoạt động quá 30 ngày bị dọn khi có thao tác đọc phiên tiếp theo; chưa có lịch chạy dọn nền.
- Cùng `requestId` + cùng message trả lại kết quả đã lưu, không sinh thêm lượt; đổi message trên cùng requestId trả 409. Lỗi RAG không ghi nửa lượt.
- Trình duyệt chỉ lưu conversationId theo tài khoản trong sessionStorage. Reload đọc lại server. Đăng xuất/đổi tài khoản xóa con trỏ của tài khoản trước và remount widget; không tự xóa lịch sử server khi đăng xuất. Nút “Cuộc trò chuyện mới” xóa phiên server trước khi reset.
- Phiên không tồn tại hoặc thuộc người khác đều trả 404; thiếu/sai token trả 401, vai trò nhân viên trả 403. Không log token, câu hỏi, thông tin bệnh nhân hay exception body từ model.

## Chạy local

Khi Qdrant và Ollama đã chạy, có thể dùng `scripts/start-rag-assistant.ps1` trong đồ án để kiểm tra các phụ thuộc và khởi động API ẩn. Script dùng `.venv` có CUDA; log nằm trong `data/private`. Nếu API đã chạy, script giữ nguyên tiến trình hiện tại.

Trong Docker Desktop Windows, gateway cần truy cập được cổng 8000 trên host. Python mặc định bind `0.0.0.0`; có thể cấu hình `CHAT_BIND_HOST`. Không đưa cổng này trực tiếp ra Internet.

```powershell
cd D:\rag-phu-san-chatbot
.\.venv\Scripts\python.exe -m pip install 'PyJWT[crypto]>=2.10,<3' 'cryptography>=44'
docker start qdrant
.\.venv\Scripts\python.exe -u web_app.py
```

Ollama phải chạy và có model `qwen2.5:3b`; Qdrant phải có index `chunks` phù hợp BM25/model hiện tại. `.venv` trên máy này có Torch CUDA, còn `.venv_clean` hiện chạy CPU; dùng `.venv` để chạy app và `.venv_clean` để chạy unit test. Không chạy lại seed đồ án hoặc build index chỉ để khởi động chat. Tham khảo `.env.chat.example` cho JWKS, CORS, khóa và vị trí lưu phiên; file mẫu không tự được load.

Sau thay đổi gateway lần đầu:

```powershell
cd D:\DATN_maternal_healthcare_support_system
docker compose build kong-init
docker compose run --rm --no-deps kong-init
docker compose restart gateway
docker compose build frontend
docker compose up -d --no-deps --no-build frontend
```

Nạp DB bằng `kong config db_import` cần restart gateway đang chạy để nhận cấu hình mới. `GET /api/health` trên Python là liveness, không khẳng định Qdrant/Ollama/model đã sẵn sàng.

## Kiểm thử lặp lại

```powershell
cd D:\rag-phu-san-chatbot
.\.venv_clean\Scripts\python.exe -m pytest tests -q
cd D:\DATN_maternal_healthcare_support_system\frontend
npm test -- --run src/modules/patient/components/chatbot/ChatbotWidget.test.tsx
npx tsc --noEmit
```

Kiểm thử API trên dùng RAG giả lập để cô lập tính đúng đắn của phiên và quyền; kiểm thử model và browser thật lưu riêng tại `docs/testing/agent-step1-2026-11-14`.
