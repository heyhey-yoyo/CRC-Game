# 肠境：免疫围城

一个可部署到 Cloudflare Pages 的静态教育策略游戏。玩家在不完整证据下形成机制假设，选择受约束的治疗路径，并在 W2、W4、W6、W8 事件节点重新判断疾病控制、生态风险和治疗可持续性。

> 本项目仅用于教育与游戏。不对应真实患者，不提供剂量、处方、诊断或疗效预测，也不能替代指南、MDT、临床试验或医疗专业人员。

## 主要功能

首页与病例页面均显示已载入内容包的医学基线日期。

- 机制假设只记录玩家判断，不改变肿瘤或免疫状态；ctDNA 在 W2 返回单次研究性检测状态与置信度，不提供纵向趋势。
- 单个 20–30 分钟病例：在不完整证据下形成机制假设（最多 3 个），选择受约束的治疗路径
- 在 W2、W4、W6、W8 事件节点重新判断疾病控制、生态风险与治疗可持续性，W8 后做三维复盘与同种子反事实路径比较
- 存档自动保存在本机浏览器，可导出备份、导入恢复，已知旧格式存档自动迁移，未知格式会拒绝
- 当前为 Public Preview：只有一个病例，不等于 GDD 所规划的六章完整产品
- 科学上是机制教学模型：适应证和路径结构由公开证据约束；内部数值是无量纲游戏参数，不是临床模型

## 界面风格

采用暖米白、浅灰与赤陶色，衬线标题与系统无衬线正文保持统一层级，图表与状态提示保留必要的颜色区别。

页眉内容区居中，品牌与标题靠左，操作靠右；页眉位于文档顶部，随页面正常滚走，窄屏允许换行。页眉背景与分隔线铺满页面宽度。

应用更新等待新版准备完成后刷新，准备较慢时显示等待提示，失败后可以重试。手机保留方法与证据入口，证据卡使用清晰的浅色阅读背景。

## 数据与隐私

默认没有账号、广告、分析 SDK、第三方追踪器或自动云上传。游戏进度自动保存在本机浏览器，只有用户主动导出时才产生文件；可导出存档备份、导入恢复，已知旧格式存档会自动迁移，未知格式会拒绝。带封套的备份先校验原始内容再迁移，缺少校验码或内容不符会拒绝；兼容没有封套的早期存档。模型标识不同或缺失的已有进度可查看与导出，继续模拟须重新开始，以免混合两套规则。清理浏览器网站数据或更换设备可能导致进度丢失。

## 本地运行

需要 Node.js 20 或更高版本。浏览器测试使用项目内固定版本的 Playwright。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run validate:content
npm test
npm run build
```

预览源码需先安装 Python 3，运行 `python -m http.server 8000` 并访问 `http://localhost:8000`。也可双击构建生成的 `crc-immune-frontier-v<应用版本>-standalone.html`。不要直接双击源码 `index.html`，它需要通过 HTTP 读取内容文件。

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

新版脚本及其依赖使用同步更新的资源地址，普通刷新可取得新资源；若出现应用更新提示，按提示完成更新，无需清空站点数据。

对外版本以 GitHub Release 为准。独立 HTML 文件名、导出记录与离线缓存跟随应用版本；模型版本和旧存档迁移标识分别保留，不以更新应用版本代替模型兼容性判断。

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

## License

- 程序：MIT，见 `LICENSE`
- 原创内容与机制文档：CC BY 4.0，见 `CONTENT-LICENSE.md`
- 外部资料仍受其原始许可和版权约束

---

> AI 编程代理请阅读 [AGENTS.md](./AGENTS.md) 了解代码架构、测试与开发约定。

---

## AI 维护提醒

> **⚠️ 任何修改此项目的 AI 代理（Claude Code、Cursor、Copilot 等）都必须同步更新本文件与 [AGENTS.md](./AGENTS.md)。**
>
> - 修改医学相关内容必须遵守「临床事实 / 机制证据 / 游戏抽象」三类分离边界并同步更新证据登记
> - 发布新版本时同步更新应用版本来源（`package.json`、`js/app.js`、`js/sim-engine.js`、`data/content-manifest.json`、`sw.js`），并同步锁文件根项目版本
