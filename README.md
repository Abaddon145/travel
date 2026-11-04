# 旅序 AI Travel

个人使用的行程规划应用（`lvxu-ai-travel`）。把每一天的景点与住宿排成一条清晰的时间线，数据保存在这台设备上。

这一阶段包含设计系统与工程骨架：Vite、React、TypeScript（strict）、Tailwind CSS v4、shadcn/ui、Motion、Zustand、TanStack Query。

## 本地运行

需要 Node.js 22+。在 Windows、macOS 与 Linux 上使用同一套 npm 脚本。

```bash
npm install
npm run dev
```

开发服务器默认在 [http://127.0.0.1:43127](http://127.0.0.1:43127)。PWA 外壳接入后会改为 HTTPS。

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview
```

`preview` 默认端口是 `43128`。

## 说明

- 界面文案为简体中文。
- 字体使用系统字体栈，并回退到 PingFang SC、冬青黑体、思源黑体与微软雅黑。
- 不在仓库中存放 API 密钥。Cloudflare、DeepSeek 与高德不在本阶段接入。
