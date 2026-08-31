# 肠境：免疫围城 v0.7.0 Public Preview

一个可部署到 Cloudflare Pages 的静态教育策略游戏。玩家在不完整证据下形成机制假设，选择受约束的治疗路径，并在 W2、W4、W6、W8 事件节点重新判断疾病控制、生态风险和治疗可持续性。

> 本项目仅用于教育与游戏。不对应真实患者，不提供剂量、处方、诊断或疗效预测，也不能替代指南、MDT、临床试验或医疗专业人员。

## 主要功能

- **工程上可上线**：具有生产构建、PWA、离线缓存、错误恢复、安全响应头、自定义 404、测试、部署和回滚说明。
- **内容上是 Public Preview**：当前只有一个 20–30 分钟病例，不等于 GDD 所规划的六章完整产品。
- **科学上是机制教学模型**：适应证和路径结构由公开证据约束；内部数值是无量纲游戏参数，不是临床模型。

## 界面风格

页面采用 `ydchen-portfolio` 的暖米白、浅灰与赤陶色视觉系统，使用衬线标题和扁平化面板；病例结构、游戏流程、Canvas 生态图和医学边界保持不变。

## 数据与隐私

默认没有账号、广告、分析 SDK、第三方追踪器或自动云上传。存档保存在本机浏览器，只有用户主动导出时才产生文件。

## 本地运行

需要 Node.js 20 或更高版本。浏览器测试使用项目内固定版本的 Playwright。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run validate:content
npm test
npm run build
```

首次运行浏览器测试时：

```bash
npm run test:browser:install
npm run test:browser
```

旧的 Python 冒烟脚本与其依赖清单仅作为兼容参考保留；默认质量门禁和 Cloudflare 构建只使用上述项目内的 Node/Playwright 流程。

完整发布检查：

```bash
npm run release:check
```

## 部署

生产构建：

```bash
SITE_URL=https://你的正式域名 npm run build
```

产物位于 `dist/`。设置 `SITE_URL` 后，构建器会生成：

- `sitemap.xml`
- 带正式域名的 `robots.txt`
- Canonical 和 Open Graph URL
- `build-info.json`
- 完整 SHA-256 校验清单

Cloudflare Pages 推荐设置：

- Production branch：`main`
- Build command：`npm run build`
- Build output directory：`dist`
- Environment variable：`SITE_URL=https://你的正式域名`
- Node.js：22

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

- 游戏进度会自动保存在本机浏览器中
- 可导出存档文件备份，也能从存档文件导入恢复
- 旧版本的游戏存档会自动迁移到新格式，无需手动处理

## License

- 程序：MIT，见 `LICENSE`
- 原创内容与机制文档：CC BY 4.0，见 `CONTENT-LICENSE.md`
- 外部资料仍受其原始许可和版权约束

---

> AI 编程代理请阅读 [AGENTS.md](./AGENTS.md) 了解代码架构、测试策略与开发约定。

---

## AI 维护提醒

> **⚠️ 任何修改此项目的 AI 代理（Claude Code、Cursor、Copilot 等）都必须同步更新本文件与 [AGENTS.md](./AGENTS.md)。**
>
> - 修改医学相关内容必须遵守「临床事实 / 机制证据 / 游戏抽象」三类分离边界并同步更新证据登记
> - 发布新版本时同步更新四处版本字符串（`package.json`、`js/app.js`、`js/sim-engine.js`、`data/content-manifest.json`）
