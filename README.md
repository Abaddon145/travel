# 旅序 AI Travel

个人使用的行程规划应用（`lvxu-ai-travel`）。把每一天的景点与住宿排成一条清晰的时间线，数据保存在这台设备上。

阶段进度见 [ROADMAP.md](./ROADMAP.md)。行程保存在本机 IndexedDB 里，刷新后还在。示例数据只在第一次建立数据库时写入。

## 本地运行

需要 Node.js 22+。在 Windows、macOS 与 Linux 上使用同一套 npm 脚本。

```bash
npm install
npm run dev
```

开发服务器默认在 [https://127.0.0.1:43127](https://127.0.0.1:43127)。证书由本地插件临时生成，浏览器第一次打开会提示不受信任，在本机继续访问即可。Windows 上同样适用。

应用以独立窗口（`display: standalone`）安装。第一次成功打开后，服务工作线程会缓存应用外壳；之后即使离线，再次进入也会回到这个外壳。

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run preview
```

`test:e2e` 会先构建，再用 HTTPS 预览跑 Playwright。第一次需要 `npx playwright install chromium`。

## 同一源站的接口

静态页面和 `/api/*` 由同一个 Worker 提供。本地先开接口，再开页面：

```bash
npm run dev:api
npm run dev
```

`dev:api` 是 `wrangler dev`，地址 `http://127.0.0.1:8787`。Vite 把 `/api` 代理过去，浏览器仍访问 `https://127.0.0.1:43127`。

把 `.dev.vars.example` 复制为 `.dev.vars`。这个文件已忽略，不要提交。生产环境的 `ENVIRONMENT` 是 `production`，因此 `ACCESS_DEV_BYPASS` 不会生效。允许名单邮箱只放在 Wrangler secret `ACCESS_ALLOWED_EMAIL` 里，不要写进前端。

## 部署到 GitHub

工作流在 [Abaddon145/travel](https://github.com/Abaddon145/travel) 的 `main` 上运行：先 lint、typecheck、test、build，再用 Wrangler 部署到 `workers.dev` HTTPS。

仓库密钥只在 GitHub 里配置，不要写进代码：

- `CLOUDFLARE_API_TOKEN`：能编辑 Workers 脚本的账号令牌
- `CLOUDFLARE_ACCOUNT_ID`：目标 Cloudflare 账号

Access 应用配好后，再设置 Worker 变量 `TEAM_DOMAIN` 和 `POLICY_AUD`，并用 `npx wrangler secret put ACCESS_ALLOWED_EMAIL` 写入允许名单。不要把这些值放进 GitHub 密钥以外的提交。

`preview` 默认端口是 `43128`。

## 说明

- 界面文案为简体中文。
- 字体使用系统字体栈，并回退到 PingFang SC、冬青黑体、思源黑体与微软雅黑。
- 不在仓库中存放 API 密钥。Cloudflare、DeepSeek 与高德不在本阶段接入。
