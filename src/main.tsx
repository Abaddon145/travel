import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { installNativeProxyAuth } from "@/lib/native-proxy-auth";
import { ensurePwa } from "@/pwa/register";
import "@/index.css";

installNativeProxyAuth();
ensurePwa();

const root = document.getElementById("root");
if (!root) {
  throw new Error("找不到应用根节点");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
