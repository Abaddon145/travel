# 阶段 08 实现计划：高德地图与路线

只做地点核对和路段核实。不开始 09。距离和时长只来自高德返回值；没有路线数据时显示「未核实」，不估算直线距离。

官方文档（查阅于实现前）：

- [JS API 加载](https://lbs.amap.com/api/javascript-api-v2/guide/abc/load)：`@amap/amap-jsapi-loader`，`version: "2.0"`。只允许在线加载，不把 JS API 打进包。
- [安全密钥](https://lbs.amap.com/api/javascript-api-v2/guide/abc/prepare)：生产用代理。`window._AMapSecurityConfig = { serviceHost }` 必须在加载前设置。`/_AMapService/` 转到 `https://restapi.amap.com/`，`/_AMapService/v4/map/styles` 转到 `https://webapi.amap.com/v4/map/styles`，查询串追加 `jscode`。安全密钥不进浏览器。
- [搜索 POI 2.0](https://lbs.amap.com/api/webservice/guide/api-advanced/newpoisearch)：`GET /v5/place/text`、`/v5/place/around`、`/v5/place/detail`。坐标字段 `location` 为「经度,纬度」，坐标系为 GCJ-02。周边搜索才返回 `distance`（米）。
- [路径规划 2.0](https://lbs.amap.com/api/webservice/guide/api/newroute)：`/v5/direction/walking`、`/v5/direction/driving`。`origin`/`destination` 为「经度,纬度」。距离在方案的 `distance`（米）。耗时在 `show_fields=cost` 的 `cost.duration`（秒）。公交用 [v3 公交](https://lbs.amap.com/api/webservice/guide/api/direction#bus) `GET /v3/direction/transit/integrated`，`city` 为 citycode，`extensions=all` 才带回步行 steps 和 `buslines[].polyline`。
- 地理编码仍是 `GET /v3/geocode/geo` 与 `/v3/geocode/regeo`。
- [infocode](https://lbs.amap.com/api/webservice/guide/tools/info)：`10000` 成功。`10003`/`10044` 日配额，`10004`/`10020` 等为频率，`10001`/`10009` 为密钥或平台不匹配，`20000`/`20001` 为参数。

## 密钥

三个 Worker secret，仓库里只有空占位。缺失则失败关闭并返回 `not_configured`。

- `AMAP_JS_KEY`：Web 端 JS API。只通过已通过私人密钥的 `GET /api/map/config` 发给浏览器。
- `AMAP_JS_SECURITY_CODE`：只放在 `/_AMapService/*` 代理里追加为 `jscode`。
- `AMAP_WEB_KEY`：只用于服务端 REST。

JS SDK 自己的请求带不上 `Authorization`。私人密钥验证成功后发一个 30 分钟的 `lvxu_map` cookie：`HttpOnly`、`Secure`、`SameSite=Strict`。签名用 `OWNER_KEY_SHA256` 做 HMAC。代理校验这个 cookie，并走现有限流。没有 cookie 返回 401。

## 接口

都在私人密钥门禁后，输入用 Zod，超时 8 秒，网络和 5xx 最多再试 1 次。`fetch` 必须绑在 `globalThis` 上。成功的搜索可放进 Cache API，最多 10 分钟。日志去掉 `jscode`、key 和 cookie。

| 路径 | 作用 |
| --- | --- |
| `GET /api/map/config` | 返回 JS key 和 `serviceHost: "/_AMapService"`，并写 cookie |
| `GET /api/map/poi/search` | 关键字搜索，`region` 用行程目的地 |
| `GET /api/map/poi/around` | 周边搜索，只有响应该字段时才带距离 |
| `GET /api/map/poi/detail` | 按 POI id |
| `GET /api/map/geocode` / `regeo` | 地理与逆地理编码 |
| `GET /api/map/route` | `mode=walking\|driving\|transit` |

## 数据

Dexie 版本 5。地点和住宿增加 `mapSource`（`amap` 或 `unverified`）、`amapPoiId`、`amapAddress`、`amapLng`、`amapLat`、`amapFetchedAt`。旧数据和 AI 草稿在迁移时标成 `unverified`。新表 `mapRoutes` 只保存高德返回的距离、时长、折线和 `fetchedAt`。

路段状态：没有记录是「未核实」；查询失败是「查询失败」；超过 7 天或两端 POI 变了是「已过期」；否则「已核实」并显示米和秒。未核实、失败、过期都不显示距离数字。同一对地点按方式各存一条，列表同时显示已核实的步行、驾车、公交。地图画最近一次核实或用户选中的那条折线。公交折线由 `segments` 里的步行、公交（含地铁）和铁路分段拼成；高德没有返回坐标时显示「公交线路无轨迹」。

## 界面

行程详情顶部可收起的地图。懒加载 JS API。离线时说明地图需要网络，时间线仍可用。服务工作线程不缓存 `/api/` 和 `/_AMapService/`。

核对地点：按名称搜索，列出高德候选，用户确认后才写入坐标。地图上按当天顺序标号。点时间线定位标记，点标记定位时间线。已核实路段才画折线，且只画当前选中的方式。选中态只在距离行上；核实按钮只负责重新查询。地图在加载完成后再画线，换方式时替换折线并 `setFitView`。

顺手修 07：生成中给出步骤和骨架；用量文案允许换行；「关于」写明可以生成草稿，地图用来核对而不是猜测距离。

## 文件

新增 `worker/map/*`、`src/lib/route-status.ts`、`src/lib/map-client.ts`、`src/components/map-panel.tsx`、`src/components/amap-canvas.tsx`、`e2e/stage08-map.spec.ts`、`docs/stage08/*`。

修改校验与仓库、`worker/index.ts`、`worker/api.ts`、`worker/redact.ts`、`vite.config.ts`、行程详情、生成中的界面、关于文案、`.dev.vars.example`、`ROADMAP.md`。

测试不访问高德。控制台需要两把密钥：JS API 绑定域名 `lvxu-ai-travel.lvxu.workers.dev`；Web 服务不要开数字签名，IP 白名单留空（Cloudflare 出口 IP 不固定，否则会 `10005`）。
