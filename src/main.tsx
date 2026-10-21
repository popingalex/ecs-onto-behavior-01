import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

// 不包 React.StrictMode：dev 下它的双挂载会让 FlowGram 的 DI 容器重复注册插件
// （Ambiguous match found for serviceIdentifier: FlowRendererRegistry）。
// StrictMode 只在 dev 起作用，生产构建本来就没有这层行为。
ReactDOM.createRoot(document.getElementById("root")!).render(<App />)
