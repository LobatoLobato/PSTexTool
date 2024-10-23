import "./index.scss";
import ReactDOM from "react-dom/client";
import React from "react";
import {ExportPanel, ImportPanel} from "./panels";

setTimeout(() => {
  const exportRoot = document.querySelector('#root')!;
  ReactDOM.createRoot(exportRoot).render(<ExportPanel/>);
  const importRoot = document.querySelector('body>uxp-panel')!;
  ReactDOM.createRoot(importRoot).render(<ImportPanel/>);
}, 1);