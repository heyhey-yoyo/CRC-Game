# 肠境：免疫围城 — AI 代理工作指南

本文件供 AI 编码代理使用。修改代码前请先阅读本文件。

## 项目概览

可部署到 Cloudflare Pages 的纯静态教育策略游戏（v0.7.0 Public Preview）。玩家在不完整证据下形成机制假设（最多 3 个）、选择受约束的治疗路径（pembro / nivoipi / folfoxbev），并在 W2 / W4 / W6 / W8 事件节点重新判断疾病控制、生态风险和治疗可持续性；W8 后做三维复盘与同种子反事实路径比较。

当前内容范围：仅一个病例 `case-b2m-escape`（MSI-H/dMMR 结直肠癌中 B2M/MHC-I 抗原呈递异质性），20–30 分钟，固定种子 2101。

**核心边界（不可违反）**：三类内容必须分离——临床事实 / 机制证据 / 游戏抽象（`clinicalStatus`、`mechanism`、`gameBoundary` 独立字段，测试强制检查）；不显示真实剂量（校验禁止 `mg` 字样和百分比数字）；B2M/MHC-I 异质性不是必然耐药开关。内部数值全部为无量纲游戏参数。

## 技术栈与运行架构

- 原生 HTML/CSS/JS，零运行时依赖，无框架、无打包器
- Web Worker 模拟：`js/sim-worker.js` 经 `importScripts` 加载引擎，消息协议 `INIT / ADVANCE / SIMULATE_COMPLETE`（12s 超时，失败自动降级主线程直调）
- 持久化三级降级：IndexedDB → localStorage → 内存（`js/storage.js`，schema 2，FNV-1a 32 位 checksum）
- PWA：`sw.js` 版本化缓存 `crc-immune-frontier-0.7.0`（导航 network-first、静态 cache-first）+ manifest + 更新横幅
- 测试：Node 内置 `node --test` + 项目内 Node Playwright Chromium smoke test

## 仓库结构

| 路径 | 作用 |
| --- | --- |
| `data/content-manifest.json` | 内容清单（schemaVersion 1，contentVersion，medicalBaseline） |
| `data/pathways.json` | 3 条路径（周排期/模型参数），约束：无真实剂量 |
| `data/evidence.json` | 7 条证据记录（组织/日期/URL/supports） |
| `data/cases/case-b2m-escape.json` | 唯一病例：临床框架、4 个假设、3 项检测、4 项预测、seed 2101 |
| `js/sim-engine.js` | 确定性纯逻辑引擎（mulberry32 PRNG、隐藏性状、tickRun、事件节点结果） |
| `js/sim-worker.js` | Web Worker 消息处理 |
| `js/storage.js` | 存档：三级降级、schema 迁移、checksum、导入导出 |
| `js/app.js` | 主控制器（978 行）：状态编排、渲染、事件委托、Canvas 生态地图 |
| `js/content-loader.js` | 按 manifest 加载并校验内容（支持内嵌模式） |
| `pages/` | methods / references / privacy / accessibility 静态说明页 |
| `scripts/build.mjs` | 生产构建：清空重建 dist/、SITE_URL 时生成 sitemap/canonical、standalone 单文件、checksums.txt |
| `scripts/validate-content.mjs` | 内容校验（build 与测试共用） |
| `tests/` | 7 个测试文件（模拟/内容/存档/静态/链接/构建 + Playwright smoke） |
| `docs/` | ARCHITECTURE、DEPLOYMENT、MEDICAL_BOUNDARIES、RELEASE_CHECKLIST、ROLLBACK 等 |

## 运行与构建

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check            # 语法检查 7 个文件
npm run validate:content # 内容包校验
npm test                 # Node 单元测试
npm run build            # 生产构建（SITE_URL=https://你的域名 npm run build）
npm run test:browser:install # 首次下载 Chromium（不属于生产构建）
npm run test:browser     # Playwright 冒烟（须先 build，用 dist/standalone-demo.html）
npm run release:check    # 全部串联：check → validate:content → test → build → test:browser
```

无 dev server，直接打开 `index.html`（file: 协议下 SW 自动跳过注册）或 `python -m http.server`。

## 测试

- `simulation.test.mjs`：同 seed 同计划结果确定性、发布病例 seed 2101 的 B2M 性状、ctDNA 可检出/假阴性且永不输出精确百分比、路径排期
- `content.test.mjs`：内容包校验 + 三字段分离；`storage.test.mjs`：checksum 稳定性、schema 迁移、篡改检测
- `static.test.mjs`：必需文件、CSS 排印/网格、安全头 token、SW 行为；`link.test.mjs`：本地链接完整性
- `browser-smoke.spec.mjs`：W0→W8 完整流程、移动端无横向溢出、收集 pageerror
- `browser-smoke.py` 与 `requirements-dev.txt`：保留的历史兼容参考；默认脚本、发布门禁和 Cloudflare 构建**不得**重新依赖 Python 测试环境。

## 部署

- Cloudflare Pages Git 集成：Production branch `main`，Build command `npm run build`，输出目录 `dist`，环境变量 `SITE_URL=https://正式域名`
- **无 GitHub Actions**（已删除，README 目录树提到 `.github/workflows/` 是过时信息，不要据此创建）
- 回滚三种方式见 `docs/ROLLBACK.md`（Dashboard 回滚 / git revert / 直接上传）；内容包可单独回滚
- 上线前过 `docs/RELEASE_CHECKLIST.md`；版本 tag `v0.7.0`

## 安全与数据注意事项

- 严格 CSP（`script-src 'self'`、`frame-ancestors 'none'`、`object-src 'none'` 等）+ COOP/CORP + nosniff
- 导入存档视为不可信输入：先 `verifyEnvelope`（JSON + schema + checksum）再 `sanitizeState` 白名单清洗
- 所有动态文字经 `escapeHtml()` 转义；CSP 仅允许同源脚本/Worker
- 无后端、无账号、无第三方追踪；存档只存本机浏览器，只有用户主动导出才产生文件
- **无真实患者数据**：SECURITY.md 与 MEDICAL_BOUNDARIES.md 明令禁止存档/报告中出现真实临床信息（注意 SECURITY.md 的 "1.x" 表述已过时，当前 0.7.0）

## 代码组织与风格约定

- 分层架构：内容层 `data/`（JSON 唯一内容源）→ 模拟层 `js/sim-engine.js`（纯逻辑、确定性）→ 状态层 `js/storage.js` → 展示层 `js/app.js` → 离线层 `sw.js`
- 模块用 `(function initX(scope){...})(window/self/globalThis)` IIFE + `module.exports` 双导出，浏览器/Worker/Node 测试三处共用
- 内容与引擎严格分离：新病例 = 新 `data/cases/*.json` + manifest 指针，引擎不改
- 确定性：`mulberry32(seed)`，隐藏性状由 `deriveHiddenTraits(seed)` 派生；`advanceRun` 拒绝倒退；**任何改变结果/迁移/校验的行为必须加固定种子回归测试**
- 单一 `document` 级事件委托，用 `data-*` 属性分发；渲染函数按 `renderAll()` 聚合
- UI 中文文案；医学名称一律 "-like"（Pembrolizumab-like 等）划清与真实药物的界限
- **版本一致性**：`0.7.0` 出现在 `package.json`、`js/app.js`、`js/sim-engine.js`、`data/content-manifest.json`、`sw.js`（CACHE_NAME）——发布新版本需同步更新

---

## AI 维护提醒

> **⚠️ 任何修改此项目的 AI 代理（包括未来的你自己）都必须遵守：**
>
> - 医学内容更新流程：改 `data/` → `npm run validate:content` + `npm test` → 同步 `evidence.json` 与 `medicalBaseline` → 递增补丁版本（换 SW 缓存名）→ 固定种子回归测试（新机制须记录 8 项，见 `docs/MEDICAL_BOUNDARIES.md`）
> - 遵守「临床事实 / 机制证据 / 游戏抽象」三类分离边界，禁止真实剂量与百分比数字
> - 发布新版本同步更新四处版本字符串；`dist/`、`checksums.txt`、根目录 standalone 单文件是构建产物（均不入库，已被 `.gitignore` 忽略），改源码后须重跑 `npm run build`
> - 上线前必须通过 `npm run release:check`

## 界面维护约定

页面主体采用 `ydchen-portfolio` 的米白 / 赤陶色视觉系统；只调整视觉层，保持临床事实、机制证据、游戏抽象三类内容分离。


## 标志维护约定

项目标志采用统一的深灰方章、米白线条与赤陶色识别点，页面标志与 favicon 共用同一 `project-mark.svg`。后续替换必须保持原标志容器宽高，不得借机改变页眉、网格或页面布局。
