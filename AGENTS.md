# 肠境：免疫围城 — 项目说明（供 AI 编程代理阅读）

本文件供 AI 编码代理使用。修改代码前请先阅读本文件。

## 项目概览

可部署到 Cloudflare Pages 的纯静态教育策略游戏（Public Preview）。玩家在不完整证据下形成机制假设（最多 3 个）、选择受约束的治疗路径（pembro / nivoipi / folfoxbev），并在 W2 / W4 / W6 / W8 事件节点重新判断疾病控制、生态风险和治疗可持续性；W8 后做三维复盘与同种子反事实路径比较。

当前内容范围：仅一个病例 `case-b2m-escape`（MSI-H/dMMR 结直肠癌中 B2M/MHC-I 抗原呈递异质性），20–30 分钟，固定种子 2101。

**核心边界（不可违反）**：三类内容必须分离——临床事实 / 机制证据 / 游戏抽象（`clinicalStatus`、`mechanism`、`gameBoundary` 独立字段，测试强制检查）；不显示真实剂量（校验禁止 `mg` 字样和百分比数字）；B2M/MHC-I 异质性不是必然耐药开关。内部数值全部为无量纲游戏参数。

## 技术栈与运行架构

- 原生 HTML/CSS/JS，零运行时依赖，无框架、无打包器
- Web Worker 模拟：`js/sim-worker.js` 经 `importScripts` 加载引擎，消息协议 `INIT / ADVANCE / SIMULATE_COMPLETE`（12s 超时，失败自动降级主线程直调）
- 持久化三级降级：IndexedDB → localStorage → 内存（`js/storage.js`，schema 2，FNV-1a 32 位 checksum）
- PWA：`sw.js` 按 `APP_VERSION` 与视觉后缀定义缓存基础名；生产构建附加样式内容摘要，并同步全部页面样式 URL 与 Service Worker 预缓存，导航 network-first、静态 cache-first。修改后以 `dist/sw.js` 和 `dist/build-info.json` 为实际部署依据。
- 测试：Node 内置 `node --test` + 项目内 Node Playwright Chromium smoke test

## 项目结构

| 路径 | 作用 |
| --- | --- |
| `index.html` | 游戏入口页面 |
| `styles.css` | 全部样式 |
| `sw.js` | Service Worker：版本化离线缓存（导航 network-first、静态 cache-first） |
| `manifest.webmanifest` | PWA 清单 |
| `404.html` | 自定义 404 页面 |
| `_headers` / `_redirects` | Cloudflare Pages 安全响应头与重定向规则 |
| `robots.txt` | 搜索引擎抓取规则（构建时按 SITE_URL 重写） |
| `icons/` | PWA 与页面图标 |
| `data/content-manifest.json` | 内容清单（schemaVersion 1，contentVersion，medicalBaseline） |
| `data/pathways.json` | 3 条路径（周排期/模型参数），约束：无真实剂量 |
| `data/evidence.json` | 7 条证据记录（组织/日期/URL/supports） |
| `data/cases/case-b2m-escape.json` | 唯一病例：临床框架、4 个假设、3 项检测、4 项预测、seed 2101 |
| `js/sim-engine.js` | 确定性纯逻辑引擎（mulberry32 PRNG、隐藏性状、tickRun、事件节点结果） |
| `js/sim-worker.js` | Web Worker 消息处理 |
| `js/storage.js` | 存档：三级降级、schema 迁移、checksum、导入导出 |
| `js/app.js` | 主控制器：状态编排、渲染、事件委托、Canvas 生态地图 |
| `js/content-loader.js` | 按 manifest 加载并校验内容（支持内嵌模式） |
| `pages/` | methods / references / privacy / accessibility 静态说明页 |
| `scripts/build.mjs` | 生产构建：清空重建 dist/、SITE_URL 时生成 sitemap/canonical、standalone 单文件、checksums.txt |
| `scripts/validate-content.mjs` | 内容校验（build 与测试共用） |
| `tests/` | Node 回归、Playwright smoke 与仅供兼容参考的旧 Python smoke |
| `docs/` | ARCHITECTURE、DEPLOYMENT、MEDICAL_BOUNDARIES、RELEASE_CHECKLIST、ROLLBACK 等 |
| `package.json` / `package-lock.json` | npm 脚本、版本常量与锁定依赖（无运行时依赖） |
| `playwright.config.mjs` | 浏览器冒烟测试配置 |
| `requirements-dev.txt` | 历史 Python 冒烟脚本依赖（仅兼容参考） |
| `LICENSE` / `CONTENT-LICENSE.md` | 程序 MIT / 原创内容与机制文档 CC BY 4.0 |
| `CHANGELOG.md` / `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md` | 变更记录、贡献指南、行为准则与安全政策 |
| `.gitignore` | 忽略构建产物（`dist/`、`checksums.txt`、standalone 单文件等） |

## 运行与构建

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check            # 检查应用、Worker、Service Worker 与构建/内容校验脚本语法
npm run validate:content # 内容包校验
npm test                 # Node 单元测试
npm run build            # 生产构建（SITE_URL=https://你的域名 npm run build）
npm run test:browser:install # 首次下载 Chromium（不属于生产构建）
npm run test:browser     # Playwright 冒烟（须先 build，用 dist/standalone-demo.html）
npm run release:check    # 全部串联：check → validate:content → test → build → test:browser
```

源码入口需通过 HTTP 服务加载内容：安装 Python 3 后运行 `python -m http.server 8000`，访问 `http://localhost:8000`。需要双击运行时，先执行 `npm run build`，再打开生成的 `crc-immune-frontier-v<应用版本>-standalone.html`；只有该单文件产物内嵌内容，`file:` 协议下不注册 Service Worker。

## 测试

- `simulation.test.mjs`：同 seed 同计划结果确定性、发布病例 seed 2101 的 B2M 性状、ctDNA 可检出/假阴性且永不输出精确百分比、路径排期
- `content.test.mjs`：内容包校验 + 三字段分离；`storage.test.mjs`：checksum 稳定性、schema 迁移、篡改检测
- `static.test.mjs`：必需文件、CSS 排印/网格、安全头 token、SW 行为；`link.test.mjs`：本地链接完整性
- `browser-smoke.spec.mjs`：W0→W8 完整流程、移动端无横向溢出、收集 pageerror
- `browser-smoke.py` 与 `requirements-dev.txt`：Python 冒烟脚本及其依赖；默认脚本、发布门禁和 Cloudflare 构建**不得**依赖 Python 测试环境。

发布检查：

```bash
npm run release:check
```

## 代码组织与风格约定

发布版本以 `package.json` 为基准，同步锁文件、`APP_VERSION`、`ENGINE_VERSION`、内容清单和 SW；构建脚本从内容清单读取版本生成独立 HTML 文件名。`MODEL_VERSION` 与旧存档迁移的历史版本值独立维护，不能全局替换历史值。

- 分层架构：内容层 `data/`（病例与路径配置；通用 UI 和部分病例结果文案仍在代码中）→ 模拟层 `js/sim-engine.js`（纯逻辑、确定性）→ 状态层 `js/storage.js` → 展示层 `js/app.js` → 离线层 `sw.js`
- 模块用 `(function initX(scope){...})(window/self/globalThis)` IIFE + `module.exports` 双导出，浏览器/Worker/Node 测试三处共用
- 当前只加载 manifest 的首个病例；新增或替换病例除 `data/cases/*.json` 与 manifest 外，还须修改 `scripts/build.mjs` 的复制及独立 HTML 数据路径，核对 `js/app.js` 默认病例与 `js/sim-engine.js` 的病例性状及结果文案，补内容、固定种子和浏览器回归。当前不是通用多病例引擎
- `MODEL_VERSION` 为独立模型标识，写入每个新运行；应用/引擎交付版本仍遵循版本一致性清单。认知假设不参与生物学状态更新。已有进度缺少或不匹配模型标识时保留查看/导出，继续模拟须重开，禁止混合模型规则。
- 确定性：`mulberry32(seed)`，隐藏性状由 `deriveHiddenTraits(seed)` 派生；`advanceRun` 拒绝倒退；**任何改变结果/迁移/校验的行为必须加固定种子回归测试**
- 单一 `document` 级事件委托，用 `data-*` 属性分发；渲染函数按 `renderAll()` 聚合
- UI 中文文案；医学名称一律 "-like"（Pembrolizumab-like 等）划清与真实药物的界限
- **版本一致性**：应用版本常量需在下列位置保持一致，发布新版本时同步更新： `package.json`、`js/app.js`、`js/sim-engine.js`、`data/content-manifest.json`、`sw.js`（APP_VERSION）；`package-lock.json` 顶层及根项目版本也须与 `package.json` 一致

### 品牌与排版

本项目为普通项目类。页眉桌面 72px、手机（≤640px）64px；方章 48×48px / 40×40px，标题衬线 18px/400/1.3、手机 16px，副标题无衬线 12px/400/1.4；标志与标题间距 12px，标题与副标题间距 2px。

页眉背景和底部分隔线横跨页面可用宽度，内容区最大宽度 1280px（含两侧各 16px 内边距），整体居中；品牌和标题靠左，操作区靠右，窄屏换行后仍保持该对齐。品牌页眉在文档顶部正常排布，随页面滚走，不固定或吸顶；表格内部表头、侧边工具和手机底部导航可按功能保留。

正文采用统一系统无衬线字体，默认 16px / 1.6；标题采用 Georgia、Times New Roman、Songti SC、STSong 衬线族。数字与代码可使用 SFMono-Regular、Consolas、Liberation Mono、Microsoft YaHei 等宽族。按钮和输入通常 15px，辅助文字 12–14px，密集科学数据允许有理由的局部调整。页面底色 #f3eee5、正文 #24221f、赤陶强调 #a94f31，柔和底色上的强调文字 #823a25；科学分类色、热图、作品主题与状态色保留必要区分度。

主样式保留一个顶层 `:root`，条件规则和深色画布局部令牌独立维护，避免叠加重复主题或末尾覆盖层。修改视觉后核对实际渲染字体、字号、间距、对比度和操作可达性；至少检查 1440、820、390px，涉及断点时补查两侧宽度，涉及画布或存储时补查交互。构建、单测、本地浏览器和线上部署分别记录；发布后禁用缓存/硬刷新，并核对实际资源版本；还必须保留旧 Service Worker 与站点缓存，验证普通刷新或应用更新提示的实际升级流程，不能用清空缓存代替。

页眉外层保持 width:100%、max-width:none，水平内边距为 max(16px,calc((100% - 1280px)/2 + 16px))；按包含块宽度计算，避免 100vw 将滚动条计入而产生溢出。手机以 16px 留白，保持标题及操作可达。

### 交互与数据约束

内容包载入后立即调用 renderContentMetadata，首页与病例共用医学基线来源；不能等进入病例才更新首页占位文字。浏览器测试在首页尚未进入病例时核对实际内容清单基线。

更新先注册 controllerchange，再发送 SKIP_WAITING；8 秒只显示等待提示，通信失败或 redundant 释放忙碌态，接管后仅刷新一次。生产构建以样式内容摘要同步页面 URL、SW 预缓存与缓存名；独立 HTML 内嵌样式。证据正文与链接保持浅色背景对比度。

### 界面维护约定

页面主体采用 `ydchen-portfolio` 的米白 / 赤陶色视觉系统；只调整视觉层，保持临床事实、机制证据、游戏抽象三类内容分离。

## 部署

发布缓存修订必须贯穿 HTML 脚本、深层模块引用、Worker/importScripts 与 SW 预缓存；游戏还包括 JSON 内容请求。_headers 请求使用 no-cache；托管平台可能覆盖响应缓存期限，发布仍须同步整条依赖链的资源地址并核对线上字节。SW 安装以 Request.cache=reload 获取资源。资源缓存修订独立于应用/模型/schema，不改科学算法；缓存回归检查整条依赖链，不能只检查入口查询参数。

- Cloudflare Pages Git 集成：Production branch `main`，Build command `npm run build`，输出目录 `dist`，环境变量 `SITE_URL=https://正式域名`
- **无 GitHub Actions**：本项目不使用 CI，不要新增 `.github/workflows/`
- 回滚方式见 `docs/ROLLBACK.md`（Dashboard 回滚 / git revert）；内容包可单独回滚
- 上线前过 `docs/RELEASE_CHECKLIST.md`；版本 tag 与 GitHub Release 对齐

## 安全与数据注意事项

- 严格 CSP（`script-src 'self'`、`frame-ancestors 'none'`、`object-src 'none'` 等）+ COOP/CORP + nosniff
- 导入存档视为不可信输入：先 `verifyEnvelope` 校验已知 schema 及存在的 checksum；仅兼容旧裸存档省略 checksum。拒绝未知 schema、数组载荷与内外版本冲突，再由 `sanitizeState` 归一化计划枚举、事件及 UI；它不宣称对整个 `run` 递归白名单校验
- 所有动态文字经 `escapeHtml()` 转义；CSP 仅允许同源脚本/Worker
- 无后端、无账号、无第三方追踪；存档只存本机浏览器，只有用户主动导出才产生文件
- **无真实患者数据**：SECURITY.md 与 MEDICAL_BOUNDARIES.md 明令禁止存档/报告中出现真实临床信息；SECURITY.md 中的版本表述以 GitHub Release 为准，不随本文件维护

## 标志维护约定

项目标志采用统一的深灰方章、米白线条与赤陶色识别点，页面标志与 favicon 共用同一 `icons/project-mark.svg`。后续替换必须保持原标志容器宽高，不得借机改变页眉、网格或页面布局。

---

## AI 维护提醒

> **⚠️ 任何修改此项目的 AI 代理（包括未来的你自己）都必须遵守：**
>
> - 医学内容更新流程：改 `data/` → `npm run validate:content` + `npm test` → 同步 `evidence.json` 与 `medicalBaseline` → 递增补丁版本（换 SW 缓存名）→ 固定种子回归测试（新机制须记录 8 项，见 `docs/MEDICAL_BOUNDARIES.md`）
> - 遵守「临床事实 / 机制证据 / 游戏抽象」三类分离边界，禁止真实剂量与百分比数字
> - 发布新版本按「版本一致性」清单同步应用版本与锁文件；`dist/`、`checksums.txt`、根目录 standalone 单文件是构建产物（均不入库，已被 `.gitignore` 忽略），改源码后须重跑 `npm run build`
> - 上线前必须通过 `npm run release:check`
