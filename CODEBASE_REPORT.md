# BÁO CÁO PHÂN TÍCH CODEBASE — DIEPS INTENT ENGINE

> Báo cáo tổng hợp toàn bộ mã nguồn repo `dieps-masterhub-hy-ui-ux-3` (nhánh `main`).
> Phạm vi: đọc kỹ 100% mã nguồn frontend + backend + cấu hình + tài liệu.

---

## 1. TỔNG QUAN

**DIEPS Intent Engine v2.0** là một "intent engine" DeFi: người dùng gõ lệnh swap bằng tiếng Anh tự nhiên (vd: *"Swap 1000 SUI to USDC with the safest route"*), hệ thống dùng LLM để phân tích ý định, tìm đường swap tối ưu qua **Cetus Aggregator V3**, chạy **7 tầng kiểm tra rủi ro on-chain (Risk Guardian)**, rồi dựng sẵn một **Programmable Transaction Block (PTB)** để ví Sui ký — không cần điền form, không kéo thanh trượt.

**Mạng lưới thực tế: Sui Mainnet.** Toàn bộ mã nguồn, cấu hình, ví (`@mysten/dapp-kit`), RPC (`fullnode.mainnet.sui.io`), link explorer (Suiscan) đều là Sui. README.md mới đây bị rebrand marketing thành "AdidaaHood / Robinhood Chain" nhưng **không có dòng code nào** chạy trên Robinhood/EVM — đây chỉ là thay đổi tài liệu (commit `b5beee9`).

**Ba tên sản phẩm đang tồn tại song song** (dấu hiệu pivot/rebrand liên tục):

| Tên | Xuất hiện ở đâu |
|---|---|
| DIEPS | `package.json`, mã nguồn, `DIEPS_TECHNICAL_ARCHITECTURE_REPORT.md`, UI Pro Studio |
| AdidaaHood | `README.md` |
| WAPCHAT | `index.html`, branding UI Toon (logo, chrome "WAPCHAT.EXE") |

---

## 2. TECH STACK

| Tầng | Công nghệ |
|---|---|
| Runtime | Node.js + TypeScript (ESM), dev bằng `tsx watch`, build bằng `esbuild` |
| Backend | Express 4, zod (validate), winston (log), dotenv |
| Blockchain | `@mysten/sui` v2, `@mysten/dapp-kit(-react)`, `@cetusprotocol/aggregator-sdk` v1.5.9, bn.js |
| LLM | OpenRouter API (Google Gemini 2.5 Flash chính; fallback Nemotron free) — không gọi Gemini SDK trực tiếp dù có cài `@google/genai` |
| Frontend | React 19, Vite 8, Tailwind v4, react-router-dom, framer-motion, gsap, tanstack/react-query |
| Dev chạy | `npm run dev` → Express + Vite middleware mode, **một server duy nhất** port 3000 (mặc định) |

Scripts (`package.json`): `dev` (tsx watch server.ts), `build` (vite build + esbuild bundle server), `start` (node dist/server.mjs), `lint` = `tsc --noEmit`. **Chưa có test tự động.**

---

## 3. CẤU TRÚC THƯ MỤC

```
├── server.ts                     # Entry Express: middleware + API + Vite SPA + static
├── index.html                    # SPA shell (title WAPCHAT)
├── vite.config.ts                # React + Tailwind plugin, alias @
├── package.json / tsconfig.json
├── metadata.json                 # Metadata agent (Gemini server-side API)
├── DIEPS_TECHNICAL_ARCHITECTURE_REPORT.md
├── README.md                     # Đã rebrand Robinhood (chỉ docs)
├── .env / .env.example           # SUI_RPC_ENDPOINT, OPENROUTER_API_KEY, ...
│
├── backend/
│   ├── scripts/sync-tokens.ts    # Đồng bộ metadata on-chain vào registry (GraphQL, batch 5)
│   └── src/
│       ├── api/                  # routes.ts + middleware.ts
│       ├── config/               # index.ts (ngưỡng rủi ro, slippage) + constant.ts (whitelist token)
│       ├── services/
│       │   ├── llm/              # intentParser, riskAdvisor, tokenAdvisor
│       │   ├── router/           # cetusRouter, ptbBuilder
│       │   ├── risk/             # LiquidityRiskGuardian
│       │   ├── safety/           # PoolSafety, TokenSafety
│       │   └── coin/             # tokenResolver, coinService, alternativeSource
│       ├── types/index.ts        # Domain types + Zod schemas
│       └── utils/                # suiClient, logger
│
└── src/                          # FRONTEND
    ├── main.tsx                  # Providers: QueryClient → DAppKit → BrowserRouter
    ├── App.tsx                   # 5 routes
    ├── constants.ts              # TOKENS (20 token phổ biến từ registry)
    ├── dapp-kit.ts               # Sui wallet (mainnet/testnet gRPC)
    ├── cetus-tokens.json         # Registry 900+ token (dùng chung FE/BE)
    ├── index.css                 # 2 theme UI hoàn chỉnh (toon + pro)
    ├── hooks/useSwapHistory.ts   # Lịch sử swap → localStorage
    ├── types/shared.ts           # Mirror type backend (RiskCheck, RouteNode, PtbStep...)
    ├── utils/explorer.ts         # Builder link Suiscan từ RiskReference
    ├── components/
    │   ├── landing/              # Hero, Footer, LoadingScreen
    │   ├── toon/Toon.tsx         # Mascot SVG: BuddyLogo, BlobBuddy, FlorkPal, sticker...
    │   ├── swapper/              # Giao diện chat Toon (core)
    │   │   ├── SwapperSection.tsx    # Điều phối toàn bộ luồng swap
    │   │   ├── ConsoleHero.tsx       # Hero nhập intent + balance + Flork
    │   │   ├── SessionView.tsx + history/  # Replay phiên cũ
    │   │   ├── MarketBoard.tsx       # "Demo feed" meme coins
    │   │   └── chat/             # UserMessage, SystemMessage, IntentParserCard,
    │   │                         # RouteSummaryCard, RiskReviewCard, ExecutionFlowCard,
    │   │                         # SuccessCard, TokenSuggestionCard, AlternativeSourceCard,
    │   │                         # ErrorMessage, InputBar, IntentConflictModal, SuiscanRefs...
    │   ├── pro/                  # Pro Studio dark glassmorphism
    │   │   ├── ProLanding.tsx, ProHeader.tsx, ProSwapper.tsx
    │   │   ├── ProRouteVisualizer.tsx, ProGuardianRadar.tsx
    │   └── TokenSelectorModal.tsx
    └── pages/Activity.tsx        # "Sticker book" — lịch sử swap dạng thẻ sưu tầm
```

---

## 4. BACKEND CHI TIẾT

### 4.1 API Endpoints (`backend/src/api/routes.ts`)

Tất cả đều POST, JSON, có rate limit 60 req/phút/IP (in-memory) và validate Zod:

| Endpoint | Chức năng |
|---|---|
| `/api/parse-intent` | Parse intent đơn lẻ (LLM) |
| `/api/calculate-optimal-route` | Tìm route tối ưu qua Cetus V3 |
| `/api/evaluate-guardian-risk` | Chạy Risk Guardian (format cũ) |
| `/api/risk-advice`, `/api/risk-summary` | LLM tóm tắt rủi ro (summary + UI labels) |
| `/api/balance` | Balance 1 token theo symbol |
| `/api/sui-rpc` | Proxy JSON-RPC → fullnode, **chỉ allowlist method đọc** (giữ API key phía server) |
| `/api/execute-swap` | Dựng & trả `transactionBytes` cho ví ký |
| **`/api/process-intent`** | **Pipeline chính** (parse → route → risk → PTB → 1 JSON) |

### 4.2 Pipeline `/api/process-intent` (luồng chính)

1. **Parse intent** bằng LLM (OpenRouter): symbol + số lượng + chế độ (SAFE/FAST/MAX_OUTPUT). Không hiểu → trả lỗi rõ ràng.
2. **Token không rõ / không whitelist** → tìm candidate trong registry 900+ token, chạy safety check + thử route cho từng ứng viên, hiện danh sách cho **người dùng tự chọn** (không tự chọn hộ) kèm `retryPrompt` chứa đủ coin type.
3. **Số tiền động** `ALL` / `MAX` / `N%` → đọc balance ví thật qua RPC để quy ra số cụ thể (trừ 0.1 SUI dự trữ gas nếu bán SUI).
4. **Tìm route**: Cetus Aggregator V3 SDK, `byAmountIn`, split tối đa 20 path, depth 3; chặn nếu không có thanh khoản.
5. **Risk Guardian** đánh giá route.
6. **Dựng PTB** + tính slippage tối ưu + dry-run lấy gas ước tính (nếu ví giả/thiếu balance thì trả PTB "mô phỏng" để UI vẫn render).
7. Nếu ví thật **thiếu token nguồn** → `alternativeSource`: quét tối đa 15 balance khác đang giữ, gợi ý token đủ giá trị để swap sang đích.
8. Trả JSON hợp nhất: `{ intent, route, guardian, ptb, tokenLogos, destDecimals, alternativeSource }`.

### 4.3 Risk Guardian — 7 tầng kiểm tra (`LiquidityRiskGuardian` + `PoolSafety` + `TokenSafety`)

| # | Check | Nguồn dữ liệu | Ý nghĩa |
|---|---|---|---|
| 1 | Price Impact / Slippage | Cetus simulation | DANGER ≥5%, khuyên tách lệnh ≥3%, WARNING ≥1% |
| 2 | Liquidity Risk | TVL route + giá on-chain | Tỷ lệ trade/depth; chặn khi oracle giá = 0 (tránh false-SAFE) |
| 3 | Liquidity Depth/Fragmentation | Route hops | >3 hop = thanh khoản phân mảnh |
| 4 | Pool Safety (DEX verify, Liquidity health, **Pool Age**) | On-chain `sui_getObject` + `previousTransaction` timestamp | Pool "chết" >7 ngày không hoạt động → DANGER; 100% on-chain, không cần indexer ngoài |
| 5 | Token Safety (whitelist, on-chain verify) | CoinMetadata GraphQL | Token lạ không verify → DANGER |
| 6 | Holder Distribution / **TreasuryCap tracing** | Truy vết tx tạo package → tìm TreasuryCap → check owner | Creator còn giữ TreasuryCap = infinite mint → DANGER (chống rug pull) |
| 7 | Supply Concentration | `suix_getTotalSupply` + TVL pool | <0.05% supply nằm trong pool → DANGER (99.9% trong ví cá voi) |

- Whitelisted token (SUI/USDC/...) được bỏ qua các check nặng (hợp lý, tránh false positive).
- **Chấm điểm**: 100 − (25 × DANGER) − (10 × WARNING), cắt tại 0. Mức: ≥80 LOW, ≥60 MEDIUM, ≥30 HIGH, còn lại CRITICAL. `safe = không DANGER Price Impact && score ≥ 30`.
- Mỗi check kèm **`references`** (coin/object/tx/account) → frontend dựng link Suiscan để người dùng tự kiểm chứng on-chain.

### 4.4 Token Resolver (`services/coin/tokenResolver.ts`)

- Whitelist 9 token (SUI, USDC, USDT, DEEP, WAL, BLUB, CETUS, HIPPO, LOFI) — ưu tiên decimals/alias chuẩn.
- Registry 921 token từ `cetus-tokens.json` (load 1 lần lúc startup).
- Decimals: whitelist → registry → GraphQL on-chain (cache 10 phút), fallback 9.
- `searchTokenCandidates`: tìm kiếm xếp hạng (exact > prefix > substring), token có logo curated nổi lên trước.

### 4.5 Slippage động (`calculateOptimalSlippage`)

```
raw = 0.1% (base) + impact% × 1.5 + (tradeUsd/liquidityUsd) × 2.0 × 100 + hops × 0.15
clamp: [0.1%, 15%]  — nếu user tự đặt slippage thì tôn trọng (vẫn clamp)
```

### 4.6 PTB Builder (`ptbBuilder.ts`)

- Serialize `transactionBytes` **trước**, rồi mới dry-run mô phỏng (lỗi mô phỏng không hủy payload ví).
- Gas budget: 5M MIST × 10 (0.05 SUI, dư gas được hoàn).
- Dùng lại đúng `routerData` từ bước tìm route (không gọi aggregator lần 2, đảm bảo route hiển thị = route thực thi).

### 4.7 Bảo mật quan sát được

- Ví ký ở client; server chỉ dựng tx — khóa không bao giờ chạm backend.
- Proxy RPC có allowlist method đọc; chặn `sui_executeTransactionBlock`.
- LLM không bao giờ tự chọn token mơ hồ; luôn để user pick → chống lừa đảo contract.
- Rate limit + sanitize lỗi (không lộ internal error ở production).
- Fallback deterministic khi LLM chết (risk summary, token summary, intent).

---

## 5. FRONTEND CHI TIẾT

### 5.1 Routing (`App.tsx`)

| Route | Màn hình | Phong cách |
|---|---|---|
| `/` | Landing "SWAPS THAT CHAT BACK!" | Toon |
| `/app` | **CHAT ROOM** — sản phẩm chính | Toon |
| `/activity` | "Sticker book" (lịch sử swap) | Toon |
| `/pro` | Landing Pro Studio | Dark glassmorphism |
| `/pro/app` | Trading terminal Pro | Dark glassmorphism |
| `*` | Fallback về Landing | — |

### 5.2 Toon Playground (theme chính)

Neo-brutalist retro cartoon: nền giấy `#FFF4E0`, viền đen 3px, shadow cứng, neon lime `#C6FF00`, mascot **Buddy/Flork** (SVG thuần, có thể nhìn theo chuột + chớp mắt + nhảy khi balance đổi).

**Luồng chat** (`SwapperSection` điều phối, `ConversationPanel` render theo `processStep`):

1. `ConsoleHero`: balance hero (đếm số mượt), textarea intent, chế độ route (Buddy Pick / Safest / Fastest / Max Out), DEEP SCAN, MEMORY (lưu intent gần nhất).
2. Gửi → `/api/process-intent` với `AbortController` (hủy request cũ nếu gửi liên tục).
3. Render tuần tự: UserMessage → loading "sniffing pools" → **IntentParserCard** (tóm tắt intent) → **RouteSummaryCard** (3 thẻ: Slippage/Concentration/Pools + visual route + bằng chứng Suiscan) → **RiskReviewCard** ("FLUX Risk Review" — phải tick *"I understand the risks"* mới bấm được Confirm) → **ExecutionFlowCard** (PTB steps, hoạt hình từng bước lúc execute) → **SuccessCard** (digest tx + link Suiscan).
4. **IntentConflictModal**: nếu gửi intent mới khi đang xử lý intent cũ → so sánh 2 swap (điểm rủi ro, thanh khoản, DANGER/WARNING) và chọn.
5. Refresh route tự động mỗi 8 giây khi đang xem kết quả (tạm dừng khi tab ẩn).
6. Lịch sử: snapshot mỗi phiên vào `localStorage` (`dieps:swap-history`, tối đa 50), xem lại dạng "old chat replay", trang `/activity` hiện dạng sticker.

**Xử lý lỗi thân thiện** (`formatSwapError`): dịch lỗi RPC thô → câu hiểu được ("không đủ SUI trả gas", "không có route"...), strip địa chỉ contract.

### 5.3 Pro Studio (dark glassmorphism)

- Bảng màu cyber: nền `#080A0F`, glass blur, cyan `#00F2FE`, font mono.
- `/pro` landing: hero "AI-Powered Intent Swaps", 4 sample prompt truyền qua `?intent=`, feature grid.
- `/pro/app`: terminal 1 ô input → `ProRouteVisualizer` (path qua từng DEX pool + link Suiscan object) + `ProGuardianRadar` (điểm 0–100, 4 nhóm sức khỏe, drawer 7-point audit, phải ack khi có warning) → nút Execute (disabled tới khi ack rủi ro).
- Dùng chung đúng backend, đúng hook ví; UI ngắn gọn hơn bản Toon.

### 5.4 Khác

- **MarketBoard** (Toon): dữ liệu **demo cứng** (HIPPO/BLUB/FUD/LOFI...) — bấm coin chỉ chèn tên token vào intent.
- **TokenSelectorModal** "Token Toybox": 20 token phổ biến, chọn → chèn câu intent.
- Wallet: `SwapperHeader` hiện dropdown "Treasure Chest" liệt kê balance từng token (refresh 10s).

---

## 6. LUỒNG DỮ LIỆU 1 CHIỀU TỔNG THỂ

```
User gõ intent (Toon / Pro)
  │  fetch POST /api/process-intent
  ▼
[LLM parse] → [token suggestion?] ←── user chọn → retry với coin type đầy đủ
  ▼
[Cetus V3 route] ──→ price impact, TVL, liquidityUsd per hop
  ▼
[Risk Guardian 7 checks] ──→ score/level + references (Suiscan)
  ▼
[PTB Builder] ──→ transactionBytes + simulation
  ▼
JSON hợp nhất → UI render cards → User bấm Confirm
  ▼
Wallet ký (dAppKit, client-side) → Sui RPC execute → waitForTransaction
  ▼
SuccessCard + cập nhật session (localStorage) + link Suiscan
```

---

## 7. VẤN ĐỀ / QUAN SÁT

1. **Rebrand chưa hoàn tất**: README nói Robinhood Chain nhưng code 100% Sui; 3 tên sản phẩm tồn tại song song (DIEPS/AdidaaHood/WAPCHAT). Nếu thật sự pivot chain thì đây là việc lớn chưa làm.
2. **Không có test tự động** — chỉ có `tsc --noEmit` (typecheck).
3. **Market demo feed là dữ liệu cứng**, không phải giá thật (có gắn nhãn DEMO trên UI).
4. Dùng `@mui/material`, `katex`, `mermaid`, `react-markdown`, `unicornstudio-react`, `@google/genai`, `@emotion/*` trong dependencies nhưng **không thấy dùng trong mã nguồn** (dependency thừa) — riêng `unicornstudio-react` còn bị CSS chủ động ẩn watermark.
5. `index.css` có lớp "compat shims" ghi đè các class của một UI cũ (glass-panel, button, uiverse...) về phong cách cartoon — gợi ý repo từng có giao diện khác bị thay thế.
6. `routes.ts` route `/execute-swap` dùng `await resolveToken(...)` (hàm sync) — lỗi nhỏ không gây hại do resolveToken luôn trả về nhanh.
7. Vite proxy: FE gọi `/api/...` tương đối — chạy dev qua `server.ts` (middleware) là bắt buộc; `vite.config.ts` không cấu hình proxy API riêng.

---

## 8. CÁCH CHẠY

```bash
cp .env.example .env    # điền OPENROUTER_API_KEY
npm install
npm run dev             # http://localhost:3000 (Express + Vite trong 1 tiến trình)
```

Build production: `npm run build` → `npm start` (dist/server.mjs + dist frontend).

---

*Báo cáo được tạo từ việc đọc toàn bộ mã nguồn — cập nhật theo nhánh `main` tại thời điểm báo cáo.*
