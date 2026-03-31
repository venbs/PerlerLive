<div align="center">
  <img src="src/assets/PerlerStudio.svg" width="240" alt="PerlerStudio Logo" />
  <h1>PerlerStudio (拼豆工作室)</h1>
  <p>一个简单好用的拼豆像素画设计与导出工具</p>

  <p>
    <a href="https://venbs.github.io/PerlerStudio/"><strong>👉 立即在线使用</strong></a>
  </p>

  [ ![Version](https://img.shields.io/badge/version-0.2.0-blue.svg) ](https://github.com/venbs/PerlerStudio)
  [ ![PWA](https://img.shields.io/badge/PWA-支持离线-orange.svg) ](https://venbs.github.io/PerlerStudio/)
</div>

---

## 🧐 这是什么？

**PerlerStudio** 是一个纯网页端的工具，专门帮拼豆爱好者把喜欢的图片转成拼豆图纸。它不仅能像素化图片，还能模拟豆子特有的圆角和中心孔洞，并加上一点立体光影效果，让你在动手制作前就能直观看到成品长什么样。

## ✨ 有哪些好用的功能？

- **🕹️ 3D 质感预览**：模拟拼豆的圆角和浮雕光影，边缘可以设置厚度，看起来更像真实的豆子。
- **🖍️ 连续描边辅助**：内置了一个专门开发的描边滤镜（8 方向采样），支持微调粗细，方便在复杂图片里勾勒出轮廓。
- **🌈 色板自定义**：自动提取图片颜色，也支持手动修改每一个色块，颜色合并逻辑非常丝滑。
- **📋 快捷操作**：
    - 支持直接 **Ctrl/Cmd + V** 粘贴图片进行处理。
    - **复制 SVG**：一键拷贝 SVG 代码，适配 Figma 等设计软件。
- **📐 细节可调**：分辨率、豆子圆角、豆子间距、豆心大小全部实时可调。
- **💻 PWA 支持**：可以像原生 App 一样安装到电脑上，离线也能用。

## 🛠️ 基本原理

1.  **暗部补亮**：自动处理原图里的纯黑像素，确保深色豆子在浮雕模式下依然有轮廓细节。
2.  **图像采样**：使用 p5.js 将图片缩放并进行色彩提取（基于 `image-q` 库）。
3.  **SVG 对齐**：导出的 SVG 经过特殊计算（内描边渲染），确保其粗细和间距与网页预览完全一致。

## 🚀 开发者快速开始

```bash
# 安装依赖
npm install

# 本地预览
npm run dev

# 构建发布
npm run build
```

## ⚖️ 许可

基于 MIT 协议开源。

---

<div align="center">
  <p>为了让拼豆制作更简单一点点 ✨</p>
</div>
