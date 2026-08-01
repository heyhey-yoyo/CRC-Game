# Cloudflare Pages 部署指南

## 推荐方式：Git 集成

1. 把项目推送到 GitHub 私有或公开仓库。
2. 在 Cloudflare Dashboard 进入 Workers & Pages，创建 Pages 项目并连接仓库。
3. 限制 Cloudflare GitHub App 只访问此仓库。
4. 设置：
   - Production branch：`main`
   - Build command：`npm run build`
   - Build output directory：`dist`
   - Root directory：仓库根目录
   - Node.js：22
   - 环境变量 `SITE_URL=https://正式域名`
5. 首次部署后检查预览域名，再绑定正式域名。

## 为什么需要 SITE_URL

构建器用它生成 canonical、Open Graph URL、robots 和 sitemap。没有设置时，构建仍成功，但会故意不生成 sitemap，避免把错误域名发布到搜索引擎。

## 上线前本地验证

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run release:check
SITE_URL=https://正式域名 npm run build
```

## 部署后验证

把域名替换成实际地址：

```bash
curl -I https://正式域名/
curl -I https://正式域名/sw.js
curl -I https://正式域名/data/content-manifest.json
curl -I https://正式域名/不存在的页面
```

确认：

- 首页为 200；
- 不存在页面返回自定义 404；
- CSP、X-Content-Type-Options、Referrer-Policy 等响应头存在；
- `sw.js` 不被长期缓存；
- `build-info.json` 版本正确；
- sitemap 中没有示例域名；
- PWA 离线打开和更新提示正常；
- W0→W8 关键流程可完成；
- 导出存档后可重新导入。

## 预览和生产

Cloudflare 的每个 Pull Request 应产生独立预览。先在预览环境执行 smoke test，再合并到 `main`。不要把真实 Token 写入仓库；本方案使用 Cloudflare Git 集成时不需要在 GitHub Actions 中保存部署 Token。

## 直接上传

也可把 `dist/` 压缩或拖放到 Pages Direct Upload 项目。不过应在建站时决定使用 Git 集成还是 Direct Upload，不要假设以后可以无缝切换项目类型。
