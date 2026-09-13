# THAHOOK — Trò chơi ôn tập cho sinh viên

Ứng dụng trắc nghiệm thời gian thực kiểu Kahoot, hỗ trợ khoảng **150–300 sinh viên** cùng chơi.
Một máy tính làm **màn hình giáo viên** (chiếu lên máy chiếu), sinh viên dùng **điện thoại** để trả lời.

---

## A. Chuẩn bị (làm 1 lần)

1. Cài **Node.js** (bản LTS) từ https://nodejs.org
2. Giải nén thư mục `THAHOOK`, mở **Terminal / Command Prompt / PowerShell** tại thư mục đó.
3. Gõ lệnh cài thư viện:
   ```
   npm install
   ```

---

## B. Cách 1 — Chạy tại lớp qua WiFi (KHUYẾN NGHỊ)

Dùng khi thầy và sinh viên **cùng một mạng WiFi** trong trường.

**Cách nhanh nhất — bấm đúp vào file `CHAY_APP.bat`.** File này tự cài đặt (lần đầu),
tự chạy máy chủ và tự mở màn hình giáo viên trong trình duyệt. Những lần sau cũng chỉ cần
bấm đúp file này. (Cửa sổ đen hiện ra là máy chủ — giữ nguyên, đừng đóng trong lúc dạy.)

Hoặc chạy thủ công bằng lệnh:

1. Chạy máy chủ:
   ```
   npm start
   ```
2. Cửa sổ lệnh sẽ in ra 2 địa chỉ, ví dụ:
   ```
   [Man hinh GIAO VIEN]:  http://localhost:3000/host.html
   [SINH VIEN]:           http://192.168.1.10:3000
   ```
3. **Trên máy giáo viên**: mở trình duyệt vào `http://localhost:3000/host.html`
   → soạn/nhập câu hỏi → bấm **Tạo phòng**.
4. **Sinh viên**: mở trình duyệt điện thoại vào địa chỉ dạng `http://192.168.1.10:3000`
   (hoặc **quét mã QR** hiện trên màn chiếu), nhập **mã PIN** và **tên**.
5. Khi đủ người, thầy bấm **Bắt đầu**.

> ⚠️ **Quan trọng — WiFi trường có thể chặn kết nối giữa các thiết bị** (tính năng
> *AP/Client Isolation*). Hãy **thử trước với 1–2 điện thoại**: nếu điện thoại mở
> được địa chỉ `http://192.168.1.x:3000` là dùng được; nếu không mở được thì WiFi
> đang bị chặn — hãy nhờ phòng CNTT mở, hoặc dùng **Cách 2 (cloud)**.

---

## C. Cách 2 — Chạy trên Cloud (chơi từ xa, mọi nơi)

Dùng khi sinh viên **không cùng WiFi** (học online). Cần một dịch vụ hỗ trợ **WebSocket**.
*(Lưu ý: gói miễn phí của các dịch vụ này thay đổi thường xuyên — hãy kiểm tra điều
khoản mới nhất khi đăng ký.)*

Các lựa chọn phổ biến hỗ trợ WebSocket: **Render**, **Railway**, **Fly.io**.
(Không dùng được Vercel/Netlify vì chúng chạy dạng serverless, không giữ kết nối WebSocket.)

Ví dụ với **Render** (không cần thẻ tín dụng):
1. Đưa thư mục `THAHOOK` lên một kho GitHub.
2. Vào https://render.com → **New → Web Service** → chọn kho vừa tạo.
3. Cấu hình: **Build Command** = `npm install`, **Start Command** = `npm start`.
4. Sau khi deploy xong, Render cấp một địa chỉ dạng `https://THAHOOK.onrender.com`.
5. Gửi địa chỉ đó cho sinh viên; màn giáo viên mở `.../host.html`.

> Gói miễn phí thường "ngủ" sau ~15 phút không dùng và mất vài giây để "thức dậy".
> Nên mở trước giờ học vài phút. Với lớp quan trọng, cân nhắc gói trả phí rẻ để chạy ổn định.

---

## D. Soạn / nhập câu hỏi

Trên màn hình giáo viên (trước khi tạo phòng) thầy có thể:
- **Thêm câu hỏi** bằng biểu mẫu (chọn nút tròn đánh dấu đáp án đúng, đặt số giây cho câu).
- **Sửa câu đã có:** mỗi câu có ô **"Giây"** (đổi thời gian ngay), nút **"Sửa"** và **"Xóa"**; có nút **"Đặt thời gian cho tất cả câu"** để đổi hàng loạt.
- **📂 Nhập file:** nhận **Excel (.xlsx)**, CSV hoặc JSON.
- **📥 Tải mẫu Excel:** tải file mẫu để điền câu hỏi rồi nhập lại.
- **📊 Xuất ra Excel / Xuất JSON:** lưu ngân hàng câu hỏi để dùng lần sau.

**Các cột trong file Excel/CSV:**
`Câu hỏi | Đáp án A | Đáp án B | Đáp án C | Đáp án D | Đáp án đúng (A–D) | Thời gian(giây)`
(Cột đáp án đúng ghi chữ A/B/C/D. Mỗi câu 2–4 đáp án, có thể bỏ trống C/D.)

> ⚠️ Nên dùng **file Excel (.xlsx)** để nhập/xuất — không bao giờ lỗi tiếng Việt. Nếu tự tạo
> bằng CSV rồi lưu bằng WPS/Excel, tiếng Việt có thể bị lỗi mã hóa (kiểu "CÃ¢u há»i").

**Định dạng JSON**:
```json
[
  {
    "question": "Thủ đô của Việt Nam?",
    "options": ["Hà Nội", "TP.HCM", "Đà Nẵng", "Huế"],
    "answer": 0,
    "time": 15
  }
]
```
(`answer` = vị trí đáp án đúng, tính từ 0. Mỗi câu 2–4 đáp án.)

---

## E. Cách tính điểm & Xuất kết quả

**Cách tính điểm:** trả lời **đúng nhiều câu luôn được xếp trên** — mỗi câu đúng được
1000 điểm, sai được 0 điểm. Tốc độ chỉ cộng thêm một chút điểm nhỏ, dùng để **phân hạng
giữa những người bằng số câu đúng** (ai nhanh hơn xếp trên). Vì vậy người đúng 3 câu (dù
chậm) luôn xếp trên người đúng 2 câu (dù nhanh).

**Xuất kết quả:** khi kết thúc, màn hình hiện **bảng xếp hạng đầy đủ của tất cả người chơi**.
Bấm nút **📊 Tải kết quả ra Excel** để lưu file `.xlsx` gồm: hạng, tên sinh viên, số câu
đúng, tổng số câu, điểm. File tải về nằm trong thư mục Downloads của máy.

## F. Âm thanh & nhạc nền

Ứng dụng đã tích hợp sẵn **hiệu ứng âm thanh** (không cần file): tiếng đếm ngược 5 giây
cuối, tiếng đúng/sai, tiếng hết giờ, nhạc chúc mừng khi kết thúc.
- Trên **màn giáo viên**: có nút **🎵 Nhạc nền** và **🔊 Hiệu ứng** ở góc trên bên phải để bật/tắt.
- Trên **điện thoại sinh viên**: có nút 🔊 để tắt/bật tiếng.

**Thêm nhạc nền (tùy chọn):** chép file mp3 vào thư mục `public/sounds/` với tên
`lobby.mp3` (phòng chờ) và `question.mp3` (lúc làm bài). Nếu không có file, app vẫn chạy
bình thường, chỉ là không có nhạc nền. Nên dùng nhạc **miễn phí bản quyền** (Pixabay Music,
YouTube Audio Library…). Xem hướng dẫn chi tiết trong `public/sounds/HUONG_DAN_NHAC.txt`.

> Nhạc nền chỉ phát trên máy giáo viên (màn chiếu) — không phát trên 150 điện thoại để tránh loạn tiếng.

## G. Ghi chú kỹ thuật
- Công nghệ: Node.js + Express + Socket.IO (WebSocket).
- Một máy chủ nhỏ xử lý tốt vài trăm kết nối. Với ~150 sinh viên chạy rất nhẹ.
- Nếu một sinh viên bị rớt mạng giữa chừng, cần vào lại bằng PIN (điểm cũ sẽ không được giữ).
- Đổi cổng chạy: đặt biến môi trường `PORT` (mặc định 3000).
