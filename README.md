# 菲比啾比 DeepSeek 余额挂件（Phoebe Chubi Balance Widget）
![alt text](assets/feibimd.png)
DeepSeek Harness（DSH）Web 界面右下角的常驻余额挂件：菲比啾比 + DeepSeek API 余额，每次打开界面自动启用，支持拖拽、点击音效与米黄卡其主题。

## 安装（先看这里）

1. **地址**：https://github.com/gdut4140/Phoebe-Chubi-DeepSeek-Balance
2. **丢给 DSH 安装**：对它说：

   > 安装这个 DSH 插件 https://github.com/gdut4140/Phoebe-Chubi-DeepSeek-Balance

   DSH 会自动安装，然后我们重新启动dsh；**没有 AI 助手的话**，用文末的 [手动安装命令](#手动安装命令)。

> 装好后打开 `http://127.0.0.1:3080`，刷新页面，右下角就会出现挂件。

## 特性

- 🧸 **常驻自启**：随 DSH Web 界面每次打开自动出现（标准 DSH bundle 插件）
- 💰 **余额**：60 秒自动刷新 + 点击菲比啾比手动刷新；余额变化时数字**滚动动画**；瞬时网络抖动自动沿用最近余额不报错
- 🔑 **API Key 直查**：汉堡菜单里可直接输入 `sk-...` 保存查余额；留空则回退 DSH 凭据服务里的 `DEEPSEEK_API_KEY`
- 🔊 **点击音效**：每点一次菲比啾比，随机播放 `feibe` / `feibe1` / `feibe2` / `feibe3` / `feibe4` 五选一；**2 秒内连点 3 次**触发特殊音效 `feiba`，气泡提示同时变为「**菲八啾比!**」（2.5 秒后恢复）
- 🎨 **米黄 × 卡其主题**：气泡与设置菜单均为米黄底（`#fef1c8`）+ 卡其描边（`#c3b091`）
- 🖱️ **拖拽 + 四边四分之一吸附**（左/右/上/下，角落可组合）
- 🔄 左吸附时整体**水平镜像翻转**（文字同步反向、带动画）
- 🧸 **按压 Q 弹**玩偶效果（按压时底部坐标不变）
- 🎚️ **汉堡菜单**：悬停人物右上角出现**米黄主题设置按钮**；菜单含大小滑块（0.6–2.5 倍，尺寸记忆）、音量调节、API Key 输入
- 💬 **随机台词**：点击气泡切换随机台词段（6 组加权随机，含余额/卖萌吐槽），再点一次关闭；气泡总显示 5 秒自动收起
- 📐 随浏览器窗口自动缩放；文字位置/字号与图片联动

## 目录结构

```text
Phoebe-Chubi-DeepSeek-Balance/
├── package.json          # DSH bundle 插件元数据
├── README.md             # 本文件
├── cordis.patch.yml      # 插件挂载声明
├── lib/
│   └── index.js          # 宿主侧插件本体
├── assets/
│   ├── feibi.png        # 菲比啾比本体（cut-out，气泡由代码绘制）
│   ├── feibe.mp3         # 点击音效 1/5
│   ├── feibe1.mp3        # 点击音效 2/5
│   ├── feibe2.mp3        # 点击音效 3/5
│   ├── feibe3.mp3        # 点击音效 4/5
│   ├── feibe4.mp3        # 点击音效 5/5
│   └── feiba.mp3         # 连点 3 次触发的特殊音效
└── phoebe-widget-prompt.md # 完整规格/维护提示词
```

## 凭据

- **余额**：用于 `api.deepseek.com/user/balance`。**优先使用挂件菜单里输入的 API Key**（汉堡菜单 → API Key → 输入 `sk-...` → 保存）；留空时回退到 DSH 凭据服务里的 `DEEPSEEK_API_KEY`

## 验证

```powershell
dsh --profile web --dump-config | Select-String -Pattern "phoebe"

curl http://127.0.0.1:3080/phoebe/image.png
curl http://127.0.0.1:3080/phoebe/balance.json
curl http://127.0.0.1:3080/phoebe/size.json
curl "http://127.0.0.1:3080/phoebe/sound.mp3?name=feibe"
```

- `/phoebe/image.png` → 200 `image/png`（菲比啾比）
- `/phoebe/balance.json` → 200，含 `{"ok":true,"totalBalance":...,"currency":"CNY"}`
- `/phoebe/size.json` → GET 返回 `{scale,sound,vol,apiKey}`；PUT 写入
- `/phoebe/sound.mp3?name=feibe` → 200 `audio/mpeg`
- 浏览器 F5 后右下角出现挂件

## 常见问题

- **挂件不出现 / 改动不生效**：确认插件已装；`dsh --profile web --dump-config` 里能看到 `phoebe-chubi-widget`；**重启 `dsh web`** 后再 F5。若端口报 `EADDRINUSE`，说明已有一个 `dsh web` 在跑，先去那个终端 Ctrl+C 关掉。
- **图片不显示**：确认 `assets/feibi.png` 在插件包内。
- **余额报「未配置 API Key」**：在挂件菜单里输入 API Key 保存，或去 DSH 配置 `DEEPSEEK_API_KEY` 凭据。
- **没有声音**：确认 `assets/feibe*.mp3`、`feiba.mp3` 在包内；若不想带音效文件，静默降级为无声音。
- **自定义图片**：气泡由代码绘制（SVG），菲比啾比本体为 cut-out PNG，放在右下角 59.45%；换图需保证透明背景 cut-out，否则按 `phoebe-widget-prompt.md` 调整几何参数。

## 手动安装命令

给**没有 AI 助手**的用户；以下命令在装有 DSH（v0.1.0+）的电脑上执行：

```powershell
# 1. 进入解压后的项目根目录
cd <解压后的目录>

# 2. 安装插件（需要 pnpm；没有就先执行：npm install -g pnpm）
dsh plugin --profile web add link:.

# 3. 启动 DSH Web（保持这个终端开着）
dsh web
```

浏览器打开 `http://127.0.0.1:3080`，按 **F5** 刷新即可看到挂件。

- **卸载**：`dsh plugin --profile web remove phoebe-chubi-widget`
- **移动了目录**：`link:` 记录的是解压时的绝对路径，移动后需在新位置重新执行一次 `dsh plugin --profile web add link:.`（若提示冲突，先 remove 再 add）
- **改代码后**：重启 `dsh web`（插件是启动时加载的）再 F5

## 开发与维护

完整规格、视觉参数、架构结论和生成提示词见 `phoebe-widget-prompt.md`。修改文字位置、颜色、动画、吸附逻辑、台词组、音频或按钮图标时参考该文件。
