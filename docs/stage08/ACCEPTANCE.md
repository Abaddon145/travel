# 阶段 08 验收

地点和路段只在高德有返回时显示。没有路线数据时是「未核实」，不出现估算距离。同一路段会同时列出已核实的步行、驾车和公交，地图画当前选中的折线。选中态只在距离行。公交请求走 v3 `extensions=all`，折线来自分段轨迹；高德没有坐标时显示「公交线路无轨迹」。

## 测试

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run test` | 29 个文件、87 个测试通过 |
| `npm run build` | 通过 |
| `npx playwright test e2e/stage08-map.spec.ts` | 通过。核对两个地点后显示高德返回的 860 米 |

截图在 `docs/stage08/screenshots/`：`unverified.png`、`not-configured.png`、`candidates.png`、`verified.png`。

## 控制台

- `AMAP_JS_KEY`：Web 端（JS API），域名白名单包含 `lvxu-ai-travel.lvxu.workers.dev`。安全密钥只作为 `AMAP_JS_SECURITY_CODE`。
- `AMAP_WEB_KEY`：Web 服务。不要开启数字签名。IP 白名单留空，否则 Cloudflare 出口变化会返回 `10005`。
- 用 `npx wrangler secret put` 写入这三把密钥。不要放进仓库。
