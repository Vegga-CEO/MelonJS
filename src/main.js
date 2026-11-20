import { Application, loader, registerTiledObjectClass, state } from "melonjs";
import { CONFIG } from "./config.js";
import { Oleo } from "./entities/Oleo.js";
import { Player } from "./entities/Player.js";
import { Rondador } from "./entities/Rondador.js";
import { Saida } from "./entities/Saida.js";
import { RECURSOS } from "./recursos.js";
import { PlayStage } from "./stages/PlayStage.js";
import { TituloStage } from "./stages/TituloStage.js";

const app = new Application(CONFIG.largura, CONFIG.altura, {
    parent: "screen",
    scale: "auto",
    backgroundColor: "#05070d",
});

// obrigatório na v20: sem isso nada é desenhado
await app.init();

// todos os assets do protótipo, de uma vez
await loader.preload(RECURSOS);

// classes do Tiled; precisa vir antes do level.load, senão os objetos viram formas soltas
registerTiledObjectClass("Player", Player);
registerTiledObjectClass("Rondador", Rondador);
registerTiledObjectClass("Oleo", Oleo);
registerTiledObjectClass("Saida", Saida);

// toda troca de estado (título ↔ fase) passa por um fade de preto
state.transition("fade", "#000000", 300);
state.set(state.MENU, new TituloStage());
state.set(state.PLAY, new PlayStage());
state.change(state.MENU);
