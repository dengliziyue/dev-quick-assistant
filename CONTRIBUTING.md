# 贡献指南 / Contributing to Dev Quick Assistant

> 感谢你有兴趣参与贡献！本文档分中文和英文两部分。
> Thanks for your interest in contributing! This guide is available in Chinese and English.

---

## 中文

### 开发环境

```bash
git clone https://github.com/your-name/dev-quick-assistant.git
cd dev-quick-assistant
npm install
npm run dev        # 启动开发预览台 http://localhost:5173/preview.html（无需加载扩展）
```

- Node.js ≥ 18（推荐 20 LTS）
- 无需任何账号 / API Key / 远端服务

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发预览台（chrome API 由 `src/dev/chrome-mock.js` 模拟） |
| `npm test` | 运行全部单元测试（Vitest） |
| `npm run build` | 构建 `dist/`（页面 + Service Worker + 内容脚本） |
| `npm run pack` | 将 `dist/` 打包为 `release/*.zip`（零依赖 zip 实现） |
| `npm run icons` | 重新生成扩展图标 |
| `npm run zip` | build + pack |

### 在真实浏览器中调试扩展

1. `npm run build`
2. 打开 `chrome://extensions`，开启右上角「开发者模式」
3. 「加载已解压的扩展程序」→ 选择 `dist/` 目录
4. 修改源码后重新 `npm run build`，在扩展卡片上点刷新按钮

### 项目结构速览

```
src/
├── core/          纯逻辑（无 DOM / chrome 依赖）→ 优先在这里实现并写测试
├── utils/         chrome 封装、i18n、设置、注入页面的收集器
├── tools/         十大工具组件（Vue SFC）
├── components/    公共 UI 组件
├── popup|sidepanel|options/  三个入口页面
├── content/       请求捕获钩子（MAIN world）+ 桥接（ISOLATED world）
├── background/    Service Worker
├── workers/       正则 Worker（防卡死）
├── dev/           开发预览台专用（不进构建产物）
└── styles/        主题变量与通用样式
```

### 新增一个工具的步骤

1. 在 `src/core/` 写纯逻辑模块，**必须**配套 `tests/core/*.test.js`（覆盖正常、非法输入、超大/超长边界）
2. 在 `src/tools/` 写 `YourTool.vue`（使用 `ToolShell` 外壳 + 公共组件，文案全部走 `src/utils/i18n.js` 的 zh/en 词典）
3. 在 `src/utils/tools.js` 注册（id / 图标 / 文案 key / 快捷键位）
4. 在 `src/utils/i18n.js` 补充两种语言的词条（zh 与 en 的 key 必须对齐，测试会校验）
5. 如需读取页面数据：优先 `chrome.scripting` + `src/utils/page-collectors.js` 的独立函数模式；**严禁**任何网络请求
6. 运行 `npm test` 与 `npm run build` 确认通过

### 硬性约束（PR 必查）

- ❌ 不引入任何运行时网络请求（统计、上报、CDN 字体、远程脚本一律禁止）
- ❌ 不新增运行时依赖（`dependencies` 保持只有 `vue`；开发依赖酌情）
- ✅ 所有用户数据只留在内存 / `chrome.storage.sync`（仅界面偏好）
- ✅ 提交前 `npm test` 全绿

### 提交规范

- 提交信息：`feat: xxx` / `fix: xxx` / `docs: xxx` / `test: xxx` / `chore: xxx`
- 一个 PR 聚焦一件事，附带测试；改 UI 请附截图
- Issue 请使用模板，敏感数据（Cookie 值、Token）务必脱敏

---

## English

### Setup

```bash
git clone https://github.com/your-name/dev-quick-assistant.git
cd dev-quick-assistant
npm install
npm run dev        # preview harness at http://localhost:5173/preview.html (no extension needed)
```

- Node.js ≥ 18 (20 LTS recommended)
- No accounts, API keys or remote services involved

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev preview harness (chrome APIs mocked via `src/dev/chrome-mock.js`) |
| `npm test` | Full unit test suite (Vitest) |
| `npm run build` | Build `dist/` (pages + service worker + content scripts) |
| `npm run pack` | Zip `dist/` into `release/*.zip` (zero-dep zip writer) |
| `npm run icons` | Regenerate extension icons |
| `npm run zip` | build + pack |

### Debugging in a real browser

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the `dist/` directory
4. After code changes: `npm run build`, then hit the reload button on the extension card

### Adding a new tool

1. Write the pure logic in `src/core/` with tests in `tests/core/` (happy path, invalid input, huge/long edge cases)
2. Create `src/tools/YourTool.vue` (use `ToolShell` + shared components; all copy goes through `src/utils/i18n.js`)
3. Register it in `src/utils/tools.js` (id / icon / i18n keys / hotkey)
4. Add zh & en dictionary entries (keys must stay aligned — a test enforces this)
5. Page data goes through `chrome.scripting` + standalone functions in `src/utils/page-collectors.js`; **never** call the network
6. `npm test` and `npm run build` must pass

### Hard constraints (check before every PR)

- ❌ No runtime network requests of any kind (analytics, telemetry, CDN fonts, remote scripts)
- ❌ No new runtime dependencies (`dependencies` stays `vue` only)
- ✅ User data stays in memory / `chrome.storage.sync` (UI preferences only)
- ✅ `npm test` green before committing

### Commit style

- Messages: `feat:` / `fix:` / `docs:` / `test:` / `chore:`
- One topic per PR, include tests; attach screenshots for UI changes
- Use issue templates; redact sensitive data (cookie values, tokens) before posting
