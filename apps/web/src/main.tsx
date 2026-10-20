import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { loadRuntimeConfig } from "./config";
import { ChainProvider } from "./state";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

await loadRuntimeConfig();

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ChainProvider>
        <App />
      </ChainProvider>
    </BrowserRouter>
  </StrictMode>,
);
