# WiFi Transfer Tool

一个基于 Electron 和 Node.js 的局域网文件传输工具。通过生成二维码，让手机能够快速与电脑建立连接，实现文件和文本的快速传输。

##  功能特性

- **扫码连接**：自动获取本机局域网 IP 并生成二维码，手机扫码即可连接。
- **文件传输**：支持手机向电脑发送文件，文件自动保存至 uploads 目录。
- **文本传输**：支持手机向电脑发送文本消息/剪贴板内容。
- **实时同步**：使用 WebSocket 实现手机端与电脑端的实时状态同步。
- **无需公网**：完全在局域网内运行，安全且速度快。

##  技术栈

- **Electron**: 桌面应用框架
- **Express**: Web 服务器
- **WebSocket (ws)**: 实时通信
- **Multer**: 处理文件上传
- **QRCode**: 生成连接二维码

##  安装与使用

### 环境要求

- Node.js (建议 v14.0.0 或更高版本)
- npm

### 1. 克隆或下载项目

`ash
git clone https://github.com/qichaoren/WiFi-Transfer.git
cd WiFi-Transfer
`

### 2. 安装依赖

`ash
npm install
`

### 3. 开发模式运行

`ash
npm start
`

### 4. 打包应用

构建 Windows 可执行文件：

`ash
npm run build
`

打包完成后，可执行文件位于 dist/WiFi Transfer-win32-x64/ 目录下。

##  目录结构

`
WiFi Transfer/
 dist/                  # 打包输出目录
 src/
    assets/           # 静态资源（图标等）
    index.html        # 桌面端主界面
    main.js           # Electron 主进程 & Express 服务端
    mobile.html       # 手机端界面
    renderer.js       # 桌面端渲染进程
    styles.css        # 样式文件
 uploads/              # 接收到的文件存放目录
 package.json          # 项目配置与依赖
 README.md             # 项目说明文档
`

##  使用说明

1. 运行程序后，电脑端会显示一个二维码。
2. 确保手机和电脑连接在同一个 WiFi 网络下。
3. 使用手机扫描二维码，将在手机浏览器中打开传输页面。
4. 在手机端选择文件或输入文本并发送。
5. 电脑端将实时收到文件（保存在 uploads 文件夹）或文本内容。

##  许可证

ISC
