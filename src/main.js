import { Application } from "melonjs";
import { CONFIG } from "./config.js";

const app = new Application(CONFIG.largura, CONFIG.altura, {
    parent: "screen",
    scale: "auto",
    backgroundColor: "#05070d",
});

// obrigatório na v20: sem isso nada é desenhado
await app.init();
