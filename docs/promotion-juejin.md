# 我做了一个纯本地的浏览器开发者工具箱扩展，九大工具零上报，源码可直接白嫖

> 掘金 / 知乎宣传文案 · 发布前请把文中 `dengliziyue` 替换为你的 GitHub 用户名，并把截图路径换成仓库绝对链接。

---

## 起因

做开发的人都有这样的浏览器收藏夹：JSON 格式化、正则测试、时间戳转换、Base64、颜色转换……一个个网页工具，每一个都要：

1. 把**数据粘贴到别人的服务器上**（接口日志里全是你的业务 JSON）；
2. 看两屏广告和弹窗；
3. 网一断，全歇菜。

我就想：这些工具明明全是纯计算，为什么不能直接住在浏览器里？

于是有了这个项目 —— **Dev Quick Assistant**，一个 Manifest V3 扩展，把九类高频工具装进弹窗和侧边栏，并且有一条铁律写进 CONTRIBUTING：

> **无后端、无远程接口、不请求任何外部服务，所有计算在浏览器本地完成，不上传用户任何数据。**

## 它能干什么

十个工具，覆盖我日常 90% 的调试场景：

| 场景 | 工具 |
| --- | --- |
| 接口返回的 JSON 又臭又长 | **JSON 格式化**：高亮、错误定位到行列、键排序、转义 |
| 两份配置对不上 | **JSON 差异对比**：按路径列出增删改，还有行级对照 |
| 写正则不敢直接上生产 | **正则测试**：实时高亮、分组、替换预览 |
| 日志里的 13 位数字是什么时候 | **时间戳转换**：多时区、批量提取文本里的时间戳 |
| 调样式 | **色值转换**：HEX/RGB/HSL/HSV、WCAG 对比度、色阶 |
| 调 JWT / Cookie | **Base64** 和 **Cookie 管理**（导出 Netscape 直接喂 curl） |
| 复现接口请求 | **请求复制**：页面里任意 fetch/XHR 一键复制成 cURL / fetch |
| 看页面塞了什么 | **存储查看器** 和 **图片提取**（批量下载） |

弹窗是启动器，侧边栏才是主战场（`Alt+Shift+S` 直达），明暗双主题跟随系统，中英双语，工具切换有快捷键。

## 几个值得一提的实现细节

**1. 请求复制没有用 `chrome.debugger`。**
 debugger 权限会在页面顶上挂一条吓人的横幅。这里用的是双世界内容脚本：`MAIN` world 在 `document_start` 包装 `fetch` 和 `XMLHttpRequest`，环形缓冲（默认 200 条）存在页面内存里；`ISOLATED` world 的桥接脚本通过 CustomEvent + `chrome.runtime` 消息把数据递给弹窗。钩子每一行都包了 try/catch —— 扩展可以崩，页面不能崩。

**2. 正则测试在 Web Worker 里跑。**
 `(a+)+$` 这类灾难性回溯一旦命中，同步执行能卡死整个面板。把匹配丢进 Worker，3 秒超时直接 terminate，UI 毫发无伤。

**3. 大 JSON 有「降级」策略。**
 超过 1MB 自动关闭语法高亮（纯文本照样能格式化），差异对比有节点预算，超出就标记截断 —— 工具应该变慢，而不是变白屏。

**4. 全部测试可复现。**
 Vitest 165 个用例，专治各种边界：2MB 的 JSON、5 万层嵌套、1MB 的中文 Base64、非法正则、零宽匹配死循环、夏令时时区换算……`npm test` 一键验证。

**5. 连图标和 zip 都是脚本生成的。**
 `scripts/generate-icons.mjs` 用纯 Node（zlib + 手写 PNG 编码）画出闪电图标；`scripts/pack.mjs` 手写 ZIP 格式打包 —— 整个项目除了 Vue 没有任何运行时依赖。

## 隐私到底怎么保证的

- 扩展自身**零网络请求**：没有统计、没有上报、没有 CDN 字体、没有远程脚本；
- Cookie、请求、存储数据只在内存里，标签页一关就没了；
- 唯一持久化的是你的主题语言偏好（`chrome.storage.sync`）；
- 图片提取器的缩略图是浏览器直接向你正在浏览的站点要的（本来就在加载），可一键关闭；
- 代码量小，欢迎自己审计。

权限用了 `storage / cookies / scripting / downloads / sidePanel` + http(s) 主机权限，每个权限的用途在 README 里逐条写明，没有 `tabs`、没有 `debugger`、没有 `webRequest`。

## 怎么用

```bash
git clone https://github.com/dengliziyue/dev-quick-assistant.git
cd dev-quick-assistant && npm install && npm run zip
```

打开 `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选 `dist/`。

不想构建？直接去 [Releases](https://github.com/dengliziyue/dev-quick-assistant/releases) 下载 CI 自动打包的 zip，解压加载即可。

想二次开发？`npm run dev` 会在 `localhost:5173/preview.html` 打开一个开发预览台 —— chrome API 全部 mock 掉，所有工具在普通标签页里就能调试，不用加载扩展。

## 适合谁

- 天天和接口、日志、配置打交道的前端 / 后端 / 测试同学；
- 公司数据敏感、不允许把业务 JSON 贴到第三方网站的同学；
- 喜欢离线、喜欢轻量、喜欢源码可审计工具的同学。

## 最后

项目 MIT 协议，结构清晰（core 纯逻辑 + tools 组件 + tests），CONTRIBUTING 里写了「十分钟新增一个工具」的完整清单 —— 想加 URL 编码？JWT 解码？UUID 生成？欢迎提 PR / Issue。

**GitHub：`https://github.com/dengliziyue/dev-quick-assistant`**

觉得有用的话点个 Star ⭐，让更多被网页广告工具折磨的同学看到。

---

*标签：`Chrome扩展` `Manifest V3` `Vue3` `Vite` `开发者工具` `前端效率` `开源项目`*
