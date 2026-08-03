# 肠境：免疫围城 v0.7.0 Public Preview

一个可部署到 Cloudflare Pages 的静态教育策略游戏。玩家在不完整证据下形成机制假设，选择受约束的治疗路径，并在 W2、W4、W6、W8 事件节点重新判断疾病控制、生态风险和治疗可持续性。

> 本项目仅用于教育与游戏。不对应真实患者，不提供剂量、处方、诊断或疗效预测，也不能替代指南、MDT、临床试验或医疗专业人员。

## 这一版是什么

- **工程上可上线**：具有生产构建、PWA、离线缓存、错误恢复、安全响应头、自定义 404、CI、测试、部署和回滚说明。
- **内容上是 Public Preview**：当前只有一个 20–30 分钟病例，不等于 GDD 所规划的六章完整产品。
- **科学上是机制教学模型**：适应证和路径结构由公开证据约束；内部数值是无量纲游戏参数，不是临床模型。

## 技术栈

- 原生 HTML、CSS、JavaScript
- Web Worker 隐藏六小时 tick 模拟
- IndexedDB 主存档，localStorage 与内存降级
- 版本化 JSON 内容包
- Service Worker / PWA
- Node.js 内置测试运行器
- Playwright Chromium smoke test
- Cloudflare Pages 静态部署

## 本地检查

需要 Node.js 20 或更高版本。浏览器测试还需要 Python 3 与 Playwright。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run validate:content
npm test
npm run build
```

安装浏览器测试依赖后：

```bash
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
npm run test:browser
```

完整发布检查：

```bash
npm run release:check
```

## 生产构建

```bash
SITE_URL=https://你的正式域名 npm run build
```

产物位于 `dist/`。设置 `SITE_URL` 后，构建器会生成：

- `sitemap.xml`
- 带正式域名的 `robots.txt`
- Canonical 和 Open Graph URL
- `build-info.json`
- 完整 SHA-256 校验清单

## Cloudflare Pages 推荐设置

- Production branch：`main`
- Build command：`npm run build`
- Build output directory：`dist`
- Environment variable：`SITE_URL=https://你的正式域名`
- Node.js：22

首次上线前请阅读 `docs/DEPLOYMENT.md` 和 `docs/RELEASE_CHECKLIST.md`。

## 内容更新

医学和玩法内容位于：

- `data/cases/`
- `data/pathways.json`
- `data/evidence.json`
- `data/content-manifest.json`

每次更改后运行：

```bash
npm run validate:content
npm test
```

重要医学主张必须同时更新证据卡和内容基线日期。

## 存档兼容

- 当前存档 schema：2
- 自动存档槽：`autosave`
- 导入文件带 checksum 校验
- 旧 schema 1 会迁移到 schema 2
- IndexedDB 不可用时退回 localStorage；二者均受限时退回当前页面会话内存

## 隐私

默认没有账号、广告、分析 SDK、第三方追踪器或自动云上传。存档保存在本机浏览器，只有用户主动导出时才产生文件。

## 目录

```text
├── data/                 # 病例、路径和证据内容
├── js/                   # UI、模拟、Worker、存档
├── pages/                # 方法、证据、隐私、可访问性
├── scripts/              # 内容校验与生产构建
├── tests/                # 单元、静态、构建与浏览器测试
├── .github/workflows/    # GitHub CI
├── _headers              # Cloudflare 安全与缓存响应头
├── _redirects            # Cloudflare 重定向
└── dist/                 # 构建后部署目录
```

## 许可证

- 程序：MIT，见 `LICENSE`
- 原创内容与机制文档：CC BY 4.0，见 `CONTENT-LICENSE.md`
- 外部资料仍受其原始许可和版权约束
