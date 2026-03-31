<div align="center">
  <img src="src/assets/PerlerStudio.svg" width="280" alt="PerlerStudio Logo" />
  <h1>PerlerStudio</h1>
  <p><strong>专业级拼豆像素艺术创作与材质预览工具</strong></p>

  [![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/venbs/PerlerStudio)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg)](https://perler.studio)
</div>

---

## 🌟 项目简介

**PerlerStudio** 是一款专门为拼豆（Perler Beads）爱好者和像素艺术家设计的 Web 设计工具。它不仅能将普通的照片快速转化为拼豆蓝图，更通过自研的 **Relievo Rendering (浮雕渲染)** 技术，为用户提供极其逼真的 3D 物理质感预览，让你的每一份设计在电脑屏幕上就拥有“触手可得”的立体感。

## ✨ 核心特性

- **🎭 高级浮雕渲染 (Advanced Relievo Rendering)**  
  基于斜向线性渐变偏移算法，模拟真实拼豆受光面（提亮）与背光面（压暗）的物理特性，支持 0-20% 的厚度自由调节。
- **🎨 智能色彩量化 & 自定义色板**  
  支持 4/8/16/32 色智能聚类算法，并允许用户通过色板交互完全自定义每一颗豆子的准确色彩。
- **🖌️ 九宫格卡通描边滤镜**  
  内置基于 p5.FIP 的 3x3 卷积边缘探测器，支持实时调整描边粗细（0.001-0.05），为复杂图片提供清晰的像素轮廓引导。
- **⚡ 极速工作流**  
  支持 **剪贴板直接粘贴 (Ctrl/Cmd + V)** 导入图片，支持 **一键复制 SVG 项目代码** 到 Figma 或绘图软件。
- **📐 极致参数化控制**  
  自由调整分辨率、拼豆圆角 (0-100%)、拼豆间隔、豆心大小等参数。
- **📶 PWA 离线支持**  
  支持安装到桌面，无需网络即可在任何地方展开你的创意设计。

## 🔬 技术原理

### 1. 图像预处理管线
为了解决纯黑色在 3D 效果下细节丢失的问题，我们实现了 **暗部像素底色提升技术**，确保黑色区域依然能看到精美的浮雕轮廓。同时，通过 WebGL 离线渲染通道应用卡通滤镜，为像素化提供辅助描黑。

### 2. 几何量化策略
程序将输入图像采样到目标分辨率后，通过 `image-q` 库进行高质量的欧几里得距离色彩空间量化，并支持 **Floyd-Steinberg 抖动算法** 以保留更多渐变细节。

### 3. SVG 矢量导出优化
不同于传统的图片导出，PerlerStudio 的 SVG 导出引擎使用了 **内描边 (Inner Stroke) 模拟算法**，确保导出的矢量图形与网页预览的圆角、间距效果完全一致，无重叠或溢出。

## 🚀 快速开始

### 在线体验
访问 [perler.studio](https://perler.studio) (示例链接) 立即开始创作。

### 本地开发
```bash
# 克隆仓库
git clone https://github.com/venbs/PerlerStudio.git

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版
npm run build
```

## 🛠️ 技术栈清单

- **Engine:** [p5.js](https://p5js.org/) (高效的画布操作与数学计算)
- **Quantization:** [image-q](https://github.com/ibezkrovnyi/image-q) (专业的调色板提取与抖动)
- **UI:** [Pickr](https://github.com/simonwep/pickr) (高级色彩编辑器) / Vanilla CSS
- **PWA:** Vite PWA Plugin (离线缓存与应用化)

---

<div align="center">
  <p>设计并创作属于你的拼豆世界</p>
  <p>© 2026 PerlerStudio Team. Made with ❤️ for artists.</p>
</div>
