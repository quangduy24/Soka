# TÀI LIỆU BÁO CÁO TOÀN DIỆN VỀ GIAO DIỆN & CÁCH TƯƠNG TÁC (UI / UX REPORT)
## SOKA — AI-Powered Bitcoin Intent Protocol for Mezo Network

---

## 1. TỔNG QUAN HỆ THỐNG & TRIẾT LÝ THIẾT KẾ (DESIGN PHILOSOPHY)

SOKA là giao thức thực thi ý định (Intent Execution Layer) bằng trí tuệ nhân tạo xây dựng trên mạng lưới **Mezo** (Mạng lưới tài chính tự phục vụ bảo chứng bởi Bitcoin). Giao diện người dùng được phát triển dưới dạng Single-Page Application (SPA) hiệu năng cao, kết hợp thẩm mỹ tối giản sang trọng với khả năng trực quan hóa dữ liệu on-chain phức tạp.

### Bảng màu nhận diện (Soka Palette)
- **Nền chính (Canvas Background):** `#FDF4F2` (Soft Cream / Warm White) tạo cảm giác nhẹ nhàng, êm dịu cho mắt.
- **Đường viền & Phân cách (Borders & Dividers):** `#F7D1D7` (Pale Rose / Frosted Pink) thanh mảnh, sắc nét.
- **Màu chủ đạo & Điểm nhấn (Primary Accent):** Gradient `#DF7AA7` đến `#EE97C2` (Rose Orchid / Sweet Pink) nổi bật, hiện đại.
- **Văn bản & Nội dung (Typography):** `#2C1924` (Deep Plum / Midnight Bordeaux) đạt độ tương phản cao, chuẩn công thái học WCAG AA.
- **Trạng thái hệ thống:**
  - Thành công / An toàn: `#10B981` (Emerald Green)
  - Cảnh báo: `#F59E0B` (Amber Orange)
  - Nguy hiểm / Hủy: `#EF4444` (Rose Crimson)

### Ngôn ngữ thị giác (Visual Language)
- **Floating 3D Glassmorphism:** Các khối thẻ giao dịch và chatbox lơ lửng trên nền canvas, sở hữu quầng sáng chiều sâu (Ambient Glow), viền tán xạ ánh sáng (Specular Highlight) và độ mờ nền quang học (`backdrop-blur-3xl`).
- **Hệ thống Typography phân cấp:**
  - Tiêu đề & Nhãn thương hiệu: `Archivo` (font-grotesk / font-display) với độ co giãn ký tự tinh tế.
  - Số liệu on-chain, mã hash, giá tiền: `JetBrains Mono` đơn cách chuẩn kỹ thuật.
  - Văn bản hội thoại & nhãn nút bấm: `Inter` dễ đọc ở mọi độ phân giải.

---

## 2. CẤU TRÚC ĐỊNH TUYẾN & TRANG ỨNG DỤNG

Ứng dụng gồm 2 phân vùng trải nghiệm chính:
1. **Trang Giới Thiệu & Trực Quan Hóa Giao Thức (`/` - Landing Page):** Nơi người dùng tìm hiểu công nghệ, nguyên lý giải quyết intent và thử nghiệm mô phỏng.
2. **Trung Tâm Điều Khiển Ý Định (`/app` - Terminal Console):** Không gian tương tác AI trực tiếp, nơi người dùng ra lệnh bằng ngôn ngữ tự nhiên để hoán đổi token, vay thế chấp, gửi vault và cung cấp thanh khoản.

---

## 3. CHI TIẾT GIAO DIỆN LANDING PAGE (`/`)

### 3.1. Thanh Điều Hướng Trên Cùng (Navigation Bar)
- **Logo SOKA:** Nằm ở góc trái, sử dụng typography tối giản `font-grotesk-125`. Bấm vào sẽ cuộn mượt mà về đầu trang (`Scroll to top`).
- **Liên kết Anchor Navigation:**
  - `THE SHIFT`: Cuộn nhanh đến phần phân tích sự khác biệt giữa cầu nối truyền thống và SOKA Proofs.
  - `THE JOURNEY`: Cuộn đến sơ đồ quy trình 4 giai đoạn xử lý Intent.
  - `THE PILLARS`: Cuộn đến 3 trụ cột kỹ thuật cốt lõi.
- **Nút "LAUNCH TERMINAL":** Nút CTA dạng pill bo tròn viền hồng `#DF7AA7`. Khi nhấp chuột, ứng dụng chuyển hướng ngay sang `/app` (Terminal).

### 3.2. Nền Nghệ Thuật Tương Tác (Generative Ink Canvas & Cursor Bloom)
- **Generative Ink Canvas:** Hệ thống mô phỏng hạt mực màu nước chuyển động tuần hoàn tự nhiên trên nền kem sáng, không gây mỏi mắt.
- **Cursor Dye Bloom:** Một vệt sáng gradient bán kính lớn chuyển động theo tọa độ chuột của người dùng, sử dụng kỹ thuật tăng tốc phần cứng (`transform: translate3d`) đạt tốc độ 120 FPS không gây giật lag.

### 3.3. Phần Hero & Trình Thử Nghiệm Intent Mô Phỏng
- **Tiêu đề định vị:** Dòng chữ lớn tuyên ngôn sứ mệnh mở rộng năng lực Bitcoin Banking trên Mezo.
- **Thẻ mô phỏng Intent (Interactive Sandbox):** Cho phép người dùng gõ thử hoặc bấm các câu lệnh mẫu (ví dụ: *"Swap 0.05 BTC to MUSD with lowest slippage"*), quan sát thuật toán Solver tự động phân giải thành biểu đồ route và điểm số an toàn ngay tại trang chủ.
- **Nút "ENTER TERMINAL":** Nút bấm chính mở cánh cửa vào giao diện điều khiển on-chain.

### 3.4. Bảng So Sánh Công Nghệ (The Shift)
- Bảng so sánh 2 cột trực quan:
  - Cột trái: Hạn chế của mô hình Cầu nối & DEX Cũ (Rủi ro MEV, trượt giá cao, phân mảnh thanh khoản).
  - Cột phải: Ưu thế vượt trội của SOKA (Xác thực bằng toán học, bảo vệ bởi Guardian Radar, tối ưu tuyến đường đa DEX).

### 3.5. Quy Trình Thực Thi Ý Định (The Journey)
- Trực quan hóa quy trình khép kín 4 bước:
  1. **Intent Ingestion:** Tiếp nhận câu lệnh ngôn ngữ tự nhiên từ người dùng.
  2. **Solver Auction:** Mạng lưới Solver cạnh tranh tìm tuyến đường tối ưu nhất.
  3. **Guardian Security Check:** Hệ thống phòng thủ 7 lớp quét rủi ro contract và trượt giá.
  4. **Consensus Settlement:** Giao dịch được xác thực và ghi nhận lên Mezo Consensus.

### 3.6. Chân Trang (Footer)
- Hiển thị tình trạng mạng lưới (`Mezo Testnet Active`), các liên kết tài liệu kỹ thuật (Docs), mã nguồn (GitHub), kênh cộng đồng (X / Twitter) và tuyên bố bản quyền.

---

## 4. CHI TIẾT GIAO DIỆN TERMINAL ĐIỀU KHIỂN (`/app`)

Giao diện Terminal là trung tâm hoạt động chính, kết hợp cơ chế chat đàm thoại AI và các bảng widget tài chính on-chain chuyên sâu.

### 4.1. Thanh Header Điều Khiển (`ProHeader`)
- **Logo SOKA:** Nhấp chuột để quay lại trang giới thiệu bất cứ lúc nào.
- **Bộ chuyển đổi Route (Overview / Terminal):**
  - Tab `Overview`: Chuyển về Landing Page.
  - Tab `Terminal`: Nút kích hoạt đang sáng thể hiện đang trong buồng lái điều khiển.
- **Đồng hồ phí mạng lưới (Gas Price):** Hiển thị trực tiếp mức phí mạng lưới hiện tại (mặc định: `750 MIST`).
- **Liên kết Mezo Explorer:** Nút bấm mở trình khám phá khối Mezo trên tab mới để kiểm tra giao dịch.
- **Nút Kết Nối Ví (Wallet Connect / Wallet Menu):**
  - *Khi chưa kết nối:* Nút "Connect Wallet" hiển thị icon ví. Khi bấm sẽ mở modal `ConnectModal` hỗ trợ ví Sui / Mezo.
  - *Khi đã kết nối:* Hiển thị địa chỉ ví rút gọn (dạng `0x1a...8b2c`) và số dư khả dụng. Nhấp vào sẽ mở menu ngữ cảnh cho phép:
    - Sao chép nhanh địa chỉ ví vào Clipboard.
    - Xem thông tin mạng lưới đang kết nối.
    - Ngắt kết nối ví (`Disconnect`).

---

### 4.2. Khung Chatbox Chính (Floating 3D Glass Container)
Chatbox được xây dựng theo phong cách kính mờ 3 chiều với các hiệu ứng:
- **Lớp hào quang phía sau (Ambient 3D Glow):** Quầng sáng gradient hồng dịu bao bọc toàn bộ khối thẻ, tạo độ sâu không gian rõ rệt so với nền trang.
- **Mép kính phản quang (Specular & Bevel Highlight):** Viền sáng mảnh ở mép trên cùng giả lập ánh sáng khúc xạ trên mặt kính acrylic cao cấp.
- **Độ trong suốt 70%:** Giúp giao diện hòa quyện mượt mà vào không gian tổng thể nhưng vẫn đảm bảo văn bản hiển thị sắc nét 100%.

#### A. Thanh công cụ đầu Chatbox (Terminal Header)
Gồm biểu tượng SOKA AI có trạng thái hoạt động và 5 nút chức năng cốt lõi:

1. **Nút `Transaction` (Giao dịch Hoán đổi):** Mở danh sách các cặp hoán đổi phổ biến và thiết lập trượt giá nhanh.
2. **Nút `Borrow` (Vay thế chấp tài sản):** Kích hoạt luồng 4 bước vay MUSD từ tài sản đảm bảo Bitcoin.
3. **Nút `Vault` (Kho sinh lời tự động):** Kích hoạt luồng quản lý tiền gửi tiết kiệm và tối ưu lợi tức.
4. **Nút `Pool` (Cung cấp & Quản lý thanh khoản):** Kích hoạt hệ sinh thái LP Pools trên Mezo.
5. **Nút `History` (Lịch sử giao dịch):** Mở thanh trượt bên phải hiển thị nhật ký các intent đã thực hiện.

---

### 4.3. Các Quy Trình Nghiệp Vụ Tương Tác Cụ Thể (Interactive Workflows)

#### A. Luồng Hoán Đổi Ý Định Tự Nhiên (Natural Language Swap Flow)
- **Bước 1: Nhập lệnh.** Người dùng gõ câu lệnh vào ô composer (hoặc nhấp các viên Quick Prompt), ví dụ:
  - *"Swap 0.05 BTC to MUSD, safest route"*
  - *"Đổi 100 MUSD sang BTC trượt giá thấp nhất"*
- **Bước 2: Phân giải Intent.**
  - Nếu câu lệnh nhắc đến token chưa rõ ràng (ví dụ: BTC vs WBTC vs tBTC), hệ thống hiển thị **Card Gợi Ý Token (Token Suggestion)** để người dùng nhấp chọn đúng tài sản on-chain.
  - AI kích hoạt trạng thái `sniffing pools…` với hiệu ứng 3 chấm sáng nhấp nháy theo màu theme.
- **Bước 3: Hiển thị Kết Quả Định Tuyến & An Toàn.**
  - **4 Chỉ số MiniStat:**
    - *Est. Output:* Số lượng token dự kiến nhận về (kèm mã token).
    - *Impact:* Mức độ ảnh hưởng giá (chuyển đỏ nếu $\ge 1\%$).
    - *Slippage:* Tỷ lệ trượt giá tối ưu được tính toán tự động.
    - *Guardian:* Điểm đánh giá an toàn thang 100 (xanh khi an toàn, đỏ khi nguy hiểm).
  - **Dòng Route Tóm Tắt:** Biểu đồ dòng chảy hiển thị: `Token Nguồn` $\to$ `DEX A` $\to$ `DEX B` $\to$ `Token Đích`.
  - **Hàng huy hiệu Guardian Check:** Hiển thị trạng thái các bài kiểm tra rủi ro (PASS / WARNING / DANGER).
  - **Hộp Xác Nhận Rủi Ro (Risk Acknowledgment):** Nếu xuất hiện cảnh báo, người dùng bắt buộc phải tích chọn checkbox *"I acknowledge the on-chain risk warnings"* mới có thể bấm nút thực thi.
- **Bước 4: Ký & Thực Thi Giao Dịch.**
  - Bấm nút **"Execute"**: Kích hoạt ví Web3 yêu cầu người dùng xác nhận chữ ký số on-chain.
  - Sau khi xác nhận thành công: Hiển thị banner xanh kèm liên kết trực tiếp đến **Mezo Explorer** để xem mã hash.
  - Nút **"Details"**: Đóng/mở khung kiểm tra sâu gồm `ProRouteVisualizer` (đồ thị tuyến đường tương tác) và `ProGuardianRadar` (radar an ninh).
  - Nút **"Cancel"**: Hủy bỏ kết quả và hoàn trả giao diện về trạng thái sẵn sàng.

---

#### B. Luồng Vay Thế Chấp (Borrow Workflow - 4 Steps)
Được kích hoạt khi bấm nút `Borrow` hoặc nhập prompt liên quan đến vay:
- **Step 1 (Select Collateral):** Người dùng chọn loại tài sản đem thế chấp (BTC, tBTC, v.v.). Thẻ hiển thị tỷ lệ LTV (Loan-to-Value), lãi suất vay và hạn mức khả dụng.
- **Step 2 (Lock Collateral):** Nhập số lượng tài sản muốn ký quỹ vào smart contract. Có các phím tắt chọn nhanh `25%`, `50%`, `75%`, `MAX`.
- **Step 3 (Mint / Borrow MUSD):** Nhập số lượng stablecoin MUSD muốn đúc ra dựa trên định giá tài sản thế chấp an toàn. Thanh đo rủi ro Liquidation Price hiển thị trực quan theo thời gian thực.
- **Step 4 (Success / Confirmation):** Tóm tắt hợp đồng vay đã kích hoạt, số tiền giải ngân về ví và nút quản lý khoản nợ.

---

#### C. Luồng Kho Sinh Lời (Yield Vault Workflow)
Được kích hoạt khi bấm nút `Vault`:
- **Chuyển đổi Tab linh hoạt:** Người dùng có thể chuyển đổi giữa `Deposit` (Gửi vốn sinh lãi) và `Withdraw` (Rút vốn gốc + lãi).
- **Số liệu thống kê trực quan:** Hiển thị tỷ suất sinh lời thực tế (Current APY), Tổng giá trị khóa (TVL), và thời gian khóa tối thiểu (Lock Period).
- **Ô nhập vốn & Thanh tỷ lệ nhanh:** Hỗ trợ nhập số lẻ hoặc chọn tỷ lệ nhanh theo số dư khả dụng trong ví.
- **Ước tính lợi nhuận tự động:** Tính toán trước số tiền lãi dự kiến nhận được theo mốc 30 ngày, 90 ngày hoặc 1 năm.
- **Nút Xác nhận Ký gửi (Confirm Vault Action):** Kích hoạt giao dịch smart contract gửi token vào vault an toàn.

---

#### D. Luồng Bể Thanh Khoản (Liquidity Pool Workflow)
Được kích hoạt khi bấm nút `Pool`:
- **Danh mục Bể (Pool Directory):** Hiển thị danh sách các cặp giao dịch (BTC/MUSD, MUSD/USDC, v.v.) kèm số liệu Khối lượng 24h, TVL và mức phí (Fee Tier: 0.05%, 0.3%, 1%).
- **Trang Chi Tiết Bể (Pool Detail Modal):** Hiển thị biểu đồ phân bổ thanh khoản, thị phần của người dùng và lịch sử trả thưởng.
- **Bổ sung Thanh Khoản (Add Liquidity):** Nhập đồng thời 2 đầu token theo tỷ lệ bể hiện hành. Tự động tính toán số lượng LP Token nhận được.
- **Thêm Phần Thưởng (Add Incentive):** Cho phép các dự án hoặc cá nhân bơm thêm phần thưởng token để kích cầu thanh khoản cho pool.
- **Rút Thanh Khoản (Remove Liquidity):** Kéo thanh trượt từ 1% đến 100% để quy đổi LP Token thành 2 tài sản gốc rút về ví.

---

#### E. Thanh Soạn Thảo Intent (Composer & Quick Prompts)
Nằm cố định ở chân Chatbox, thiết kế mờ ảo chống che khuất nội dung:
- **Ô nhập liệu đa năng (Input Field):** Hỗ trợ gõ cả tiếng Anh và tiếng Việt. Nhấn phím `Enter` trên bàn phím để gửi intent ngay lập tức.
- **Nút Gửi Intent hình tròn 3D (Submit Arrow Button):**
  - Khi chưa nhập chữ: Nút mang tông hồng nhạt. Nếu bấm vào khi ô trống, hệ thống sẽ tự động điền một câu lệnh mẫu chuẩn *"Swap 0.05 BTC to MUSD, safest route"* và kích hoạt thử nghiệm.
  - Khi đã có chữ: Nút tự động chuyển sang màu gradient hồng đậm rực rỡ với hiệu ứng bóng đổ phát sáng (Glow), sẵn sàng thực thi.
  - Trong lúc đang xử lý: Nút hiển thị biểu tượng bánh răng xoay `RefreshCw` và tự động vô hiệu hóa để chống spam lệnh.
- **Dải Viên Nhộng Gợi Ý Nhanh (Quick Prompt Pills):** Các nút bấm dạng capsule bo tròn bên dưới ô nhập, cho phép người dùng kích hoạt các hành động phổ biến chỉ với 1 cú nhấp chuột mà không cần gõ phím.

---

### 4.4. Các Bảng Điều Khiển Nổi & Drawer Phụ Trợ

#### A. Ngăn Kéo Lịch Sử Giao Dịch (`HistoryPanel`)
- Mở ra từ cạnh phải màn hình khi người dùng bấm nút `History`.
- Danh sách ghi lại tất cả các lệnh intent đã từng xử lý:
  - Thời gian thực hiện (Timestamp).
  - Nội dung câu lệnh gốc.
  - Trạng thái hoàn thành (Success / Failed).
- **Các tương tác trong bảng History:**
  - **Nút Re-run:** Chạy lại nguyên văn lệnh cũ chỉ bằng một cú nhấp chuột.
  - **Nút Chi tiết (Expand):** Bấm vào thẻ để xem chi tiết route và mã giao dịch tương ứng.
  - **Nút Xóa từng mục (Delete):** Xóa các lệnh không muốn lưu trữ.
  - **Nút Clear All:** Xóa sạch toàn bộ lịch sử trong bộ nhớ cục bộ.
  - **Nút Đóng (Close / Esc):** Đóng ngăn kéo quay lại màn hình chính.

#### B. Đồ Thị Tuyến Đường Tương Tác (`ProRouteVisualizer`)
- Hiển thị cấu trúc đồ thị mạng lưới đa node (Multi-hop routing graph).
- Mỗi nút đại diện cho một DEX hoặc Pool thanh khoản (ví dụ: MezoSwap, Uniswap v3, Cetus).
- Đường nối động biểu diễn luồng di chuyển của dòng vốn và tỷ lệ phần trăm phân bổ dòng tiền nhằm triệt tiêu tối đa trượt giá.

#### C. Biểu Đồ An Ninh Rủi Ro (`ProGuardianRadar`)
- Mô hình đánh giá toàn diện gồm 7 tiêu chuẩn an ninh on-chain:
  1. *Liquidity Depth:* Chiều sâu thanh khoản của cặp token.
  2. *Sandwich Protection:* Cơ chế bảo vệ trước bot giao dịch kẹp lệnh.
  3. *Price Deviation:* Độ lệch giá so với Oracle tin cậy.
  4. *Contract Audit:* Tình trạng kiểm toán của hợp đồng thông minh.
  5. *Mint Authority:* Quyền đúc thêm token của chủ dự án.
  6. *Freeze Risk:* Khả năng đóng băng ví của token.
  7. *Fee Anomaly:* Bất thường về phí giao dịch ẩn.

---

## 5. BẢNG TỔNG HỢP CÁC THAO TÁC & PHÍM TẮT (INTERACTIONS SUMMARY)

| Vị trí | Thao tác | Hành vi tương ứng của giao diện |
| :--- | :--- | :--- |
| **Bàn phím** | `Enter` (tại ô nhập) | Gửi câu lệnh Intent đến engine phân tích |
| **Bàn phím** | `Esc` | Đóng bảng History hoặc Modal mở rộng |
| **Header** | Nhấp Logo `SOKA` | Về đầu trang hoặc chuyển về Landing Page |
| **Header** | Nhấp `Connect Wallet` | Mở popup kết nối ví Web3 Sui / Mezo |
| **Header** | Nhấp Địa chỉ ví | Mở menu sao chép địa chỉ / ngắt kết nối |
| **Action Bar** | Nhấp `Borrow` | Khởi chạy wizard 4 bước vay MUSD thế chấp bằng BTC |
| **Action Bar** | Nhấp `Vault` | Mở giao diện gửi/rút tiền tiết kiệm tối ưu APY |
| **Action Bar** | Nhấp `Pool` | Mở bảng danh mục bể thanh khoản và thêm LP |
| **Action Bar** | Nhấp `History` | Mở drawer lịch sử giao dịch bên phải |
| **Result Card** | Nhấp `Details` | Thu gọn / Mở rộng đồ thị Route và radar an ninh |
| **Result Card** | Nhấp `Cancel` | Hủy bỏ đề xuất giao dịch, dọn sạch màn hình |
| **Result Card** | Nhấp `Execute` | Ký giao dịch trên ví và phát sóng lên blockchain |
| **Result Card** | Nhấp `Mezo Explorer` | Mở tab mới xem chi tiết khối giao dịch trên explorer |
| **Composer** | Nhấp nút Gửi khi ô trống | Tự động điền câu lệnh mẫu và chạy thử nghiệm |
| **Composer** | Nhấp `Quick Prompt` pill | Điền ngay intent mẫu và kích hoạt solver xử lý |

---

## 6. KẾT LUẬN & ĐÁNH GIÁ TRẢI NGHIỆM NGƯỜI DÙNG

Giao diện **SOKA** đã giải quyết triệt để rào cản kỹ thuật phức tạp của DeFi thông qua mô hình tương tác hướng ý định (Intent-Driven UI):
1. **Thân thiện & Tự nhiên:** Người dùng không cần phải tự mình tìm kiếm từng pool, tính toán từng bước swap hay lo sợ bị trượt giá; tất cả được điều khiển qua ngôn ngữ tự nhiên.
2. **Minh bạch & An toàn:** Mọi quyết định hoán đổi đều được bảo vệ bởi hệ thống Guardian Radar 7 lớp, yêu cầu xác thực rủi ro rõ ràng trước khi ký giao dịch.
3. **Thẩm mỹ Hiện đại:** Thiết kế 3D Floating Glass đồng bộ theo concept màu hồng đất SOKA tinh tế, tạo nên cảm giác nhẹ nhàng, chuyên nghiệp và đáng tin cậy.
