# 菲比啾比 DeepSeek 余额挂件 —— 完整生成提示词

> 用途：在 DeepSeek Harness（DSH）的 Web 界面右下角常驻一个「菲比啾比余额挂件」。
> 本提示词汇总了完整需求、架构、全部行为规格、视觉参数与踩坑结论，可直接交给 AI 复现或维护。
> 文中 `C:\Users\<user>\.dsh\profiles\web\` 等为本机示例路径，迁移时请替换为你环境中的实际路径。
> 当前版本：v0.2.0（菲比啾比换皮、API Key 直查、点击随机音效 + 连点特殊音效、米黄卡其主题、米黄主题设置按钮）。

---

## 一、需求总览

实现一个 DSH Web 界面右下角的余额挂件：

- 菲比啾比 cut-out 本体（`assets/feibi.png`）+ **代码绘制的奶油色对话气泡**（SVG 椭圆 + 尾巴，`#fef1c8`），气泡内叠加三行文字。
- 余额来自 DeepSeek 官方接口 `GET https://api.deepseek.com/user/balance`，取 `balance_infos[0].total_balance` 与 `currency`，请求头 `Authorization: Bearer <key>`。
- **API Key 来源（优先级）**：挂件菜单里输入的 API Key（持久化在配置里）→ DSH 凭据服务 `DEEPSEEK_API_KEY`。
- **气泡提示**：标题「DeepSeek 余额」+ 金额 + 底部「菲比啾比~」；**2 秒内连点 3 次**触发特殊音效 `feiba` 时，底部提示临时变为「**菲八啾比!**」（2.5 秒后恢复）。
- **点击音效**：每次按压随机播放 `feibe`/`feibe1`/`feibe2`/`feibe3`/`feibe4` 五选一；**2 秒内连点 3 次**触发特殊音效 `feiba`。
- 支持：拖拽、四分之一区域吸附（上下左右四边）、左吸附整体水平翻转（文字同步）、汉堡菜单（大小/音量/API Key）、按压 Q 弹 + 音效、余额数字滚动动画、60 秒自动刷新 + 点击手动刷新、随机台词气泡（点击切换/关闭）、**每次打开界面自动启用（常驻自启）**。

## 二、架构（务必先读）

动态 Cordis 插件（`cordis_define`/`cordis_run`）的定义存在进程内存中，页面重载后需要重新 run，**无法**满足「每打开界面就自动启用」。因此采用**标准 DSH bundle 插件**（npm 包 + `dsh.bundle.patch`）挂进 Web 组合：

1. **插件包**：`phoebe-chubi-widget/package.json` 声明 `dsh.bundle.patch`，`lib/index.js` 为宿主插件入口（ESM）。
2. **导出形式**：`const name = 'phoebe-chubi-widget'; const inject = ['webServer', 'credentials']; function apply(ctx) {...}; export { name, inject, apply }`（具名导出，与 `package.json` 的 `name` 一致）。
3. **挂载声明**：包内 `cordis.patch.yml` 用 `name: phoebe-chubi-widget` 把插件插入配置树。
4. **安装/更新**：`dsh plugin --profile web add phoebe-chubi-widget`；本地开发用 `dsh plugin --profile web add link:.`（在项目根目录）。安装后重启 `dsh web`。
5. **可迁移路径**：`lib/index.js` 顶部用 `fileURLToPath(import.meta.url)` 推得 `PACKAGE_ROOT`，图片/音效优先 `path.join(PACKAGE_ROOT, 'assets', ...)`；尺寸/账本写 `$DSH_HOME`（`process.env.DSH_HOME || ~/.dsh`）下（`.phoebe-size.json` / `.phoebe-usage.json`）。
6. **宿主上下文**：宿主插件运行在宿主进程（非动态沙箱），可直接使用全局 `fetch`（可带自定义请求头）、`node:fs`、`AbortSignal.timeout` 等 Node API。
7. **生命周期**：把所有 `webServer.register` / `tapIndex` 返回的 disposer 收集进数组，挂到 `ctx.effect(() => () => { for (const d of disposers) try { d() } catch {} })`，HMR 重载时自动清理。

> 兼容提示：若环境中存在旧版动态插件占用同名路由，先 `cordis_stop`/`cordis_undefine` 释放，否则注册会因路径重复抛错。

## 三、Host 侧：webServer 路由

| 路由 | 方法 | 行为 |
|---|---|---|
| `/phoebe/image.png` | GET | 读取插件包内 `assets/feibi.png`（内存缓存字节），`Content-Type: image/png`、`Cache-Control: no-store`；读取失败返回 404。 |
| `/phoebe/balance.json` | GET | 返回余额 JSON：`{ok:true, totalBalance, currency, updatedAt}` 或 `{ok:false, code, error, transient?}`。**任何情况下都返回 200 + JSON**，绝不悬挂/空响应。 |
| `/phoebe/size.json` | GET / PUT | 挂件配置持久化：GET 返回 `{scale, sound, vol, apiKey}`；PUT 读 body 写盘（优先 `$DSH_HOME/.phoebe-size.json`，回退 `$DSH_HOME/profiles/web/`），带 CORS 头。`apiKey` 变化时清除余额缓存。 |
| `/phoebe/sound.mp3` | GET | 按 `?name=feibe|feibe1|...|feiba` 白名单返回对应音效（`assets/<name>.mp3`），每请求读盘、`no-store`；未知 name 返回 404。 |
| `/phoebe/widget.js` | GET | 返回页面挂件源码（原生 JS），`Content-Type: application/javascript; charset=utf-8`、`Cache-Control: no-store`。 |
| `tapIndex` | — | 对每次 index.html 注入 `<script defer src="/phoebe/widget.js"></script>`（置于 `</body>` 前，幂等判断 `html.indexOf('/phoebe/widget.js') !== -1` 则跳过）。 |

### 余额拉取（Host）的健壮性要求

- `fetch(BALANCE_URL, { headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(20000) })`。
- **重试**：网络错误/超时/5xx 重试 1 次（间隔 500ms）；4xx 不重试。
- **瞬时失败回退**：网络错误/超时/5xx 且存在缓存时，返回最近一次成功值并标记 `stale: true`（挂件继续显示旧余额，不闪错误）；4xx 不回退、`console.error` 记录。
- 25 秒内存缓存 + 进行中请求去重（in-flight promise 复用）。

## 四、页面挂件（widget.js，原生 JS）

页面上下文（无沙箱），IIFE 包裹，首行幂等守卫 `if (window.__phoebeWidget) return; window.__phoebeWidget = true`。

### DOM 结构

```
div.phoebe-root（position:fixed，承载定位与翻转）
├─ div.phoebe-body（绝对定位铺满，承载按压 Q 弹缩放）
│  ├─ img.phoebe-img（src=/phoebe/image.png，cut-out 人物，右下角 59.45%）
│  └─ div.phoebe-bubble（SVG 气泡：大椭圆 + 尾巴 + 两个小气泡，z-index:1）
│     └─ div.phoebe-text（三行：label / amount / hint，绝对定位居中）
├─ button.phoebe-menu-btn（右上角三条杠设置按钮，米黄主题，悬停显示）
└─ div.phoebe-menu（汉堡菜单：大小滑块 + 数字、音量滑块、API Key 输入 + 保存）
```

- 菜单挂在 `document.body` 下（`position:fixed`），打开时定位到按钮上方（右侧贴按钮右上角，左吸附镜像时贴左上角）。
- 气泡 SVG 几何（1026×700 画布）：大椭圆中心 (454,247) rx373 ry232（bbox x81..827 / y15..479）；尾巴半椭圆连接 (301,465)-(413,484) 中心 (356,472) 倾 10°；小气泡1 (352,561) rx37.5 ry26；小气泡2 (442,646) rx24.5 ry18；**填充 `#fef1c8`**（米黄），描边 `#c3b091`（卡其）宽 18，`stroke-linejoin:round`。三个图形元素分别带 class `phoebe-bshape / phoebe-b1 / phoebe-b2`，`transform-box:fill-box`。

### 定位与吸附（关键：一律用 left/top 像素定位）

- **默认位置**：右下角（读取 `getBoundingClientRect` 初始化 `state.left/top`）。
- **四分之一吸附**（横、纵两轴独立判定，自由组合，互不打架）：中心 x < 视口宽/4 → 吸附左缘；中心 x > 3×视口宽/4 → 吸附右缘；中心 y < 视口高/4 → 吸附顶缘；中心 y > 3×视口高/4 → 吸附底缘；其余保持释放点坐标。
- **为什么必须用 left/top 像素**：若右吸附切换成 `left:auto; right:0`，CSS 过渡无法在 `auto` 与数值间插值，右侧吸附会瞬间跳变（闪现）。
- **锚点保持**：吸附信息（`state.h/v` + 偏移）存入状态；`settle()` 在窗口 resize 与尺寸调整时按锚点重算，已吸附的挂件保持贴边；未锚定轴仅做视口钳制。
- **角落固定缩放**：调整大小时以人物所在角为固定点（未翻转=右下角，翻转=左下角），保证人物不"乱跑"。
- 拖拽用 pointer 事件；位移平方 ≥ 9（>3px）判定拖动，否则为点击（点击人物=打开气泡+刷新）；拖拽中 `transition:none` 1:1 跟手，松手后 `settle()` 带动画滑向吸附位。

### 左吸附水平翻转

- 吸附到左缘时根元素加类 `phoebe-left` → `transform: scaleX(-1)` 整体镜像。
- 文字块同步反向镜像（`scaleX(-1)`）保持可读；数字/金额内容不变（镜像后仍可读）。
- 拖拽中保持翻转形态，松手后按落点判定是否保持。
- **关键**：文字块过渡必须**按属性拆分**——`transition: opacity .16s ease .36s, transform .3s ease`，否则开态延迟会拖累 transform 导致翻转文字滞后闪烁。

### 按压 Q 弹 + 点击音效

- `.phoebe-body` 上做缩放：pointerdown → `scaleY(0.88) scaleX(1.05)`；pointerup/cancel → 回弹 `scaleY(1) scaleX(1)`。
- `transform-origin: 50% 100%`（底边中心）——按压时底部坐标不变。
- 过渡 `transform .22s cubic-bezier(.34,1.56,.64,1)`（带过冲回弹）。
- **点击音效（每次按压触发）**：
  - 记录按压时间戳到 `clickTimes`，裁剪掉超过 2 秒的旧记录。
  - 若 2 秒窗口内按压次数 ≥ 3 → 清空窗口并播放 `feiba`（特殊音效），同时 `showReaction('菲八啾比!')` 把气泡底部提示临时改为「菲八啾比!」，2.5 秒后恢复「菲比啾比~」；否则从 `['feibe','feibe1','feibe2','feibe3','feibe4']` 随机选一个播放。
  - 音频对象池化（`audioPool`），`new Audio('/phoebe/sound.mp3?name=' + name)`，`preload='auto'`，音量跟随 `soundVol`；`setPoolVolume` 同步所有已建对象的音量。
  - 音量 0 时 `soundOn=false`，不播放。

### 汉堡菜单

- 悬停人物显示右上角三条杠设置按钮（米黄主题）；点击开/关菜单。
- 行1 大小：range 0.6–2.5（step 0.1）+ number 1–20（线性映射 1→0.6，20→2.5，默认 1.5=10）；滑块拖动期间给根元素 `transition:none`（CSS 过渡在 JS 块之后才求值，否则滑块会以错误中心缩放抖动）。
- 行2 音量：range 0–1；音量 0 时自动关声音。
- 行3 API Key：`<input type="password">`（占位 `sk-...（留空用默认凭据）`）+ 保存按钮；保存 → 写入配置 → 立即刷新余额；下方小字提示当前来源（「已用自定义 Key 查余额」/「未设 Key，用默认凭据查余额」）。
- 所有设置 PUT `/phoebe/size.json` 持久化；打开页面时 GET 恢复。
- 菜单 `color-scheme:light`，保证暗色主题下可读。

### 余额刷新与状态机

- **自动刷新**：`setInterval(refresh, 60000)`；**手动刷新**：点击人物（同时打开气泡）。
- 请求期间提示行显示「加载中…」（金额保持显示）；数据到达后**淡出淡入**切换到「菲比啾比~」。
- 自动刷新：静默，**仅当余额实际变化**时弹气泡 + 数字滚动（700ms ease-out 三次方）+ 300ms 后开始滚动；900ms 后落定。
- 客户端 fetch 带 25 秒 AbortController 超时。
- 状态显示：初始加载 → 金额 `…` + `加载中…`；正常 → 金额 + `菲比啾比~`；错误 → 保留最近余额 + 错误信息。

### 随机台词气泡（点击切换/关闭）

- 点击人物 → 气泡弹出显示正常内容（余额 + 「菲比啾比~」），总时长 **5 秒**自动收起。
- **首次点击气泡** → 淡出淡入切换到随机台词段；**再次点击** → 关闭（切换不延长总时长）。
- 台词六组按权重随机（`pickRandomLines` 加权抽样）：
  1. 权重 20：三行（A 样式「DeepSeek 余额」/ B 样式金额 / C 样式「菲比啾比~」）
  2. 权重 7：居中 B「好模型... ↓」/「好女孩...↓」
  3. 权重 7：居中 A 六句随机（不知道主人有什么用…/我也要挣钱吗/我去吃饭啦/我的头发很贵的/好困...要充电了/主人彻底怒了），**自动换行**（`.phoebe-wrap`，max-width 560u）
  4. 权重 3：居中 A 三句随机（token 自由/便宜货/记小本本），**自动换行**
  5. 权重 1：三行「这个」(A) /「凶」(B) /「是什么意思呀...」(A)
  6. 权重 1：居中 B「啾比啾比... 」
- 样式档：A=label（66u 600）、B=amount（128u 800）、P=period（104u 800）、C=hint（56u 灰 `#9fb0d9`）；`--phoebe-u = var(--phoebe-base)/1026`。
- 随机段切换用**淡出淡入**（内联 opacity 过渡 190ms 出 / 220ms 入），与开合动画分离。

## 五、视觉与几何参数（精确值）

| 项 | 值 |
|---|---|
| 人物本体图 | `assets/feibi.png` 848×890 cut-out，右下角 `right:0;bottom:0;width:59.45%`（命中测试画布 610×610 拉伸，与显示一致） |
| 气泡画布 | 代码内 SVG，viewBox 0 0 1026 700，几何见上文 |
| 气泡填充 | `#fef1c8`（米黄） |
| 气泡描边 | `#c3b091`（卡其），宽 18，圆角连接 |
| 文字块定位 | `left:44.25%; top:38%; transform:translate(-50%,-50%)`，`text-align:center`，`color:#6d5736` |
| 字号联动 | `--phoebe-u: calc(var(--phoebe-base) / 1026)`；A=66/600、B=128/800（行高 1.05）、P=104/800、C=56/#a08a63 |
| 菜单主题 | 米黄底 `rgba(253,242,206,.95)`、卡其描边 `rgba(122,95,58,…)`、深卡其文字 `#6d5736` |
| 金额格式 | CNY → `¥ ` + toFixed(2)；其他 → `金额 币种` |
| 挂件基准尺寸 | `--phoebe-base: clamp(122px, calc(min(250px, min(100vw,100vh)*0.28) * var(--phoebe-scale)), 625px)`；scale 0.6–2.5（菜单 1–20） |
| 吸附阈值 | 各轴中心点所在 1/4 区（<1/4 或 >3/4） |
| 点击阈值 | 位移 < 3px（平方距离 < 9） |
| 翻转动画 | 0.3s ease（根 + 文字同步，文字按属性拆分过渡） |
| 按压 Q 弹 | scaleY(0.88) scaleX(1.05)，origin 50% 100%，0.22s cubic-bezier(.34,1.56,.64,1) |
| 点击音效 | 随机五选一 `feibe*`；2 秒内连点 3 次 → `feiba` + 提示变「菲八啾比!」2.5s |
| 数字动画 | 700ms ease-out 三次方（requestAnimationFrame） |
| 自动刷新 | 60s；变化提示 900ms；气泡 5s 自动收起 |
| 配置持久化 | `$DSH_HOME/.phoebe-size.json`（回退 profile 下） |
| 音效 | `assets/feibe.mp3` `feibe1-4.mp3` `feiba.mp3`；按请求读盘，no-store |
| z-index | 9999，`position: fixed`；菜单 10000 |

## 六、关键技术结论（踩坑记录，供复用）

1. **动态插件无法自启**：定义在进程内存、页面重载需重 run；要常驻自启必须静态化挂进 profile 组合。
2. **发布包 patch 不用 `?v=`**：`cordis.patch.yml` 写 `name: phoebe-chubi-widget`（bundle 插件名）；`?v=N` 只用于手动复制到 profile 的本机热更。
3. **profile 补丁热更新**：本机开发时 `cordis.patch.yml` 被 `watchUserPatches` 实时监视，改文件即生效、无需重启。
4. **webServer handler 抛错**：异步 handler 抛异常会被 dispatcher 捕获并回 400 空响应；务必让路由永远返回 JSON（try/catch 全包）。
5. **CSS 过渡不能对 auto 插值**：定位切换一律用 left/top 像素。
6. **过渡延迟会传染所有属性**：需要"文字出现延迟但翻转立即"时必须用按属性拆分写法 `transition:opacity .16s ease .36s,transform .3s ease`。
7. **滑块抖动**：CSS 过渡在 JS 块之后求值，拖动滑块全程保持 `transition:none`。
8. **记账模式误差说明**：靠"观测到的余额下降"累计，DSH 关闭期间的消耗会漏记（从下次观测的新基准开始）。
9. **tapIndex 幂等**：注入脚本标签前先检查是否已存在，disposer 挂 ctx.effect，避免 HMR 后重复注入。
10. **音效缓存**：音频文件每次请求读盘 + no-store，避免更换 mp3 后浏览器缓存旧字节。
11. **音效路由白名单**：`/phoebe/sound.mp3` 按 `name` 参数白名单放行，防止路径遍历。

## 七、部署与验证

1. 将 `Phoebe-Chubi-DeepSeek-Balance` 作为本地包安装：项目根目录 `dsh plugin --profile web add link:.`（或发布后 `dsh plugin --profile web add phoebe-chubi-widget`），然后重启 `dsh web`。
2. 验证：`curl http://127.0.0.1:3080/phoebe/image.png`（200 image/png）、`/phoebe/balance.json`（200 JSON，含真实余额）、`/phoebe/size.json`（GET/PUT 读写回路）、`/phoebe/widget.js`（200 JS）、`/phoebe/sound.mp3?name=feibe`（200 audio/mpeg）、`curl http://127.0.0.1:3080/`（index 含 widget.js 脚本标签）。
3. 浏览器 **F5 刷新页面**后出现挂件。
4. 交互自测：拖拽 + 四边四分之一吸附（含角落组合）、左吸附镜像翻转、菜单（大小/音量/API Key 保存后余额刷新）、按压 Q 弹 + 随机音效 + 连点 3 次触发 feiba 且提示变「菲八啾比!」、点击人物弹气泡 → 首次点击切台词 → 再点关闭、5 秒自动收起、60s 自动刷新、余额变化数字滚动。
