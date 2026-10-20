# 关键页面的独立画面

打开index.html查看13页目录。P03/P05/P07/P12/P14/P15/P20/P22/P23/P24/P26/P27/P28各自有1920×1200 PNG、SVG和HTML源。

PNG为原尺寸参考；SVG由矢量排版输出，文字可能表现为轮廓，不能当成已完成的原生Figma组件。Figma中应依据pages/和02_components.md重建可编辑组件。HTML是指定状态的画面源，不带完整编辑器交互。

图片使用同一套字体与设计变量；静态画面通过WeasyPrint 70和Poppler渲染，未将其当作真实egui客户端截图。浏览器与原生egui实现仍需检查字体、焦点、停靠、滚动和性能。

重新生成HTML：python reference/generate_designs.py。重新出PNG/SVG需安装reference/render_requirements.txt及系统pdftocairo，然后运行reference/render_designs.py。业务复算仅用Python标准库，不依赖渲染工具。

位置重合的V01/V02使用标记展开和引线；世界位置仍由mock.state决定。场地为虚构局部坐标示意，非真实地图或实际3D资源。
