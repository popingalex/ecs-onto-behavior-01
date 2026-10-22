import React from "react"
import ReactDOM from "react-dom/client"
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  type FreeLayoutProps,
} from "@flowgram.ai/free-layout-editor"
import "@flowgram.ai/free-layout-editor/index.css"

/**
 * W5.1 最小复现宿主：在 dev 下用 React.StrictMode 双挂载一个最小
 * FreeLayoutEditorProvider，验证 FlowGram 1.0.16 DI 容器是否仍报
 * "Ambiguous match found for serviceIdentifier: FlowRendererRegistry"。
 * 与正式入口（src/main.tsx）完全隔离，不影响应用。
 */
const editorProps: FreeLayoutProps = {
  nodeRegistries: [],
  onContentChange: () => {},
  playgroundConfig: {},
}

function App() {
  return (
    <FreeLayoutEditorProvider {...editorProps}>
      <div style={{ width: 800, height: 500, border: "1px solid #ccc" }}>
        <EditorRenderer />
      </div>
      <div id="mounted">editor subtree rendered</div>
    </FreeLayoutEditorProvider>
  )
}

const app = <App />
ReactDOM.createRoot(document.getElementById("root")!).render(
  new URLSearchParams(location.search).get("strict") === "off" ? (
    app
  ) : (
    <React.StrictMode>{app}</React.StrictMode>
  ),
)
