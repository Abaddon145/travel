import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MapFrameApp } from "@/map-frame/frame-app";
import "@/index.css";
import "@/map-frame/frame.css";

const root = document.getElementById("root");
if (!root) throw new Error("找不到地图根节点");

createRoot(root).render(
  <StrictMode>
    <MapFrameApp />
  </StrictMode>,
);
