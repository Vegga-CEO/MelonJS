import { Application, loader, state } from "melonjs";
import { CONFIG } from "./config.js";
import { ESTADOS } from "./estados.js";
import { RECURSOS } from "./recursos.js";
import { Fase1Stage } from "./stages/Fase1Stage.js";
import { MenuStage } from "./stages/MenuStage.js";
import { RecargaStage } from "./stages/RecargaStage.js";
import { iniciarEntrada } from "./ui/entrada.js";

const app = new Application(CONFIG.largura, CONFIG.altura, {
    parent: "screen",
    scale: "auto",
    backgroundColor: "#05070d",
});

// obrigatório na v20: sem isso nada é desenhado
await app.init();

// todos os assets do jogo, de uma vez
await loader.preload(RECURSOS);

// teclado e mouse da interface (menus, painéis, pausa)
iniciarEntrada(app);

// toda troca de estado passa por um fade de preto
state.transition("fade", "#000000", 300);
state.set(ESTADOS.MENU, new MenuStage());
state.set(ESTADOS.FASE1, new Fase1Stage());
// a recarga é só uma passagem: entra sem fade (o fade vem na saída dela)
state.set(ESTADOS.RECARGA, new RecargaStage());
state.setTransition(ESTADOS.RECARGA, false);
state.change(ESTADOS.MENU);
