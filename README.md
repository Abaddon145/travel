# 旅序 AI Travel

> travel — 旅行软件

个人使用的行程规划应用（`lvxu-ai-travel`）。把每一天的景点与住宿排成一条清晰的时间线，预算、预订和清单也留在这台设备上。

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

把 `.dev.vars.example` 复制为 `.dev.vars`。这个文件已忽略，不要提交。生产环境的 `ENVIRONMENT` 是 `production`，因此 `ACCESS_DEV_BYPASS` 不会生效。

付费和管理接口现在用私人密钥。浏览器只把密钥放在这台设备上，Worker 只保存它的 SHA-256（Wrangler secret `OWNER_KEY_SHA256`），明文不要进仓库。Access JWT 仍留着，等账号可以开通 Zero Trust 后再切换。

行程草稿由 Worker 调用 DeepSeek。密钥是 Worker secret `DEEPSEEK_API_KEY`，不要写进仓库。默认模型是 `deepseek-flash`，也可以在页面上改用 `deepseek-v4-pro`。

## 部署到 GitHub

工作流在 [Abaddon145/travel](https://github.com/Abaddon145/travel) 的 `main` 上运行：先 lint、typecheck、test、build，再用 Wrangler 部署到 `workers.dev` HTTPS。

仓库密钥只在 GitHub 里配置，不要写进代码：

- `CLOUDFLARE_API_TOKEN`：能编辑 Workers 脚本的账号令牌
- `CLOUDFLARE_ACCOUNT_ID`：目标 Cloudflare 账号

主人密钥由你在另一台机器上执行 `npx wrangler secret put OWNER_KEY_SHA256`，值是密钥的十六进制 SHA-256，不是明文。

以后改回 Access：把 `wrangler.jsonc` 里的 `AUTH_MODE` 设为 `access`，填上明文变量 `TEAM_DOMAIN` 和 `POLICY_AUD`（不要放进 secret，否则部署容易把它们清掉），再 `npx wrangler secret put ACCESS_ALLOWED_EMAIL`。不要把这些值写进提交。

`preview` 默认端口是 `43128`。

## 说明

- 界面文案为简体中文。
- 字体使用系统字体栈，并回退到 PingFang SC、冬青黑体、思源黑体与微软雅黑。
- 不在仓库中存放 API 密钥。Cloudflare、DeepSeek 与高德不在本阶段接入。
