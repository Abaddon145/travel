import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { ensurePwa } from "@/pwa/register";
import "@/index.css";

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
