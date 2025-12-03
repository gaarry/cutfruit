# 🍉 手势切水果 - Gesture Fruit Ninja

一个使用 Three.js 和 MediaPipe 构建的网页手势切水果游戏。

## ✨ 特性

- 🎮 **手势控制**: 使用 MediaPipe 识别手指位置，空中划动即可切水果
- 🌐 **3D 渲染**: 基于 Three.js 的精美 3D 场景和刀光特效
- 🔊 **动态音效**: 使用 Web Audio API 生成的合成音效
- 📷 **实时画面**: 右下角显示摄像头画面及手部骨骼连线
- 🚀 **无外部素材**: 所有 Emoji 和效果都是代码生成，无需额外资源

## 🎯 游戏玩法

1. **开始游戏**: 用食指切割屏幕中央的 🌍 地球开始游戏
2. **切水果**: 用食指在空中划动，切割飞出的 Emoji
3. **得分规则**:
   - 🍉 西瓜: +10 分
   - 💩 便便: -5 分
   - 💣 炸弹: 失去一条命
4. **连击加分**: 连续切中西瓜获得额外分数
5. **游戏结束**: 漏掉西瓜或切到炸弹会失去生命，3条命用完游戏结束

## 🛠️ 技术栈

- **React 18** - UI 框架
- **Three.js** - 3D 渲染引擎
- **MediaPipe Hands** - 手势识别
- **Web Audio API** - 音效合成
- **Vite** - 构建工具
- **TypeScript** - 类型安全

## 📦 安装运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 🚀 部署到 Vercel

1. 将代码推送到 GitHub 仓库
2. 在 [Vercel](https://vercel.com) 导入项目
3. 自动部署完成！

或使用 Vercel CLI:

```bash
npm i -g vercel
vercel
```

## ⚠️ 注意事项

- 需要允许浏览器访问摄像头
- 推荐使用 Chrome/Edge 浏览器获得最佳体验
- 确保光线充足以提高手势识别准确度
- 首次加载可能需要下载 MediaPipe 模型文件

## 📁 项目结构

```
cut-fruit/
├── src/
│   ├── components/
│   │   ├── GameEngine.tsx    # 游戏引擎
│   │   └── HandTracker.tsx   # 手势追踪
│   ├── utils/
│   │   ├── audioSystem.ts    # 音效系统
│   │   └── gameObjects.ts    # 游戏对象
│   ├── App.tsx               # 主组件
│   ├── main.tsx              # 入口
│   └── index.css             # 样式
├── index.html
├── package.json
├── vite.config.ts
└── vercel.json
```

## 📄 License

MIT License

