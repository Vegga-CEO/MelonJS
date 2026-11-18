import { Renderable } from "melonjs";
import { CONFIG } from "../config.js";
import { pintar } from "../entities/folha.js";
import { dadosDoEstilo } from "../systems/estilo.js";
import { Rotulo } from "../ui/texto.js";

// ESQUELETO: tela provisória das fases enquanto elas não existem (fundo de
// uma cor, título e subtítulo no meio). As tarefas da Fase 1 e da Fase 2
// tiram isto das stages; quando nenhuma usar mais, o arquivo pode sair.
export class TelaEsqueleto extends Renderable {
    // obterSubtitulo: função chamada a cada quadro (ex.: a etapa atual)
    constructor(titulo, obterSubtitulo, cor) {
        super(0, 0, CONFIG.largura, CONFIG.altura);
        this.anchorPoint.set(0, 0);
        this.floating = true;
        this.alwaysUpdate = true;
        this.cor = cor;
        this.titulo = new Rotulo(titulo, 2);
        this.subtitulo = new Rotulo("");
        this.obterSubtitulo = obterSubtitulo;
    }

    draw(renderer) {
        const { jogo } = dadosDoEstilo();
        pintar(renderer, this.cor, 0, 0, CONFIG.largura, CONFIG.altura);
        const meio = CONFIG.altura / 2;
        this.titulo.desenhar(renderer, CONFIG.largura / 2, meio - 24, { cor: jogo.texto, alinhamento: "centro" });
        this.subtitulo.texto = this.obterSubtitulo();
        this.subtitulo.desenhar(renderer, CONFIG.largura / 2, meio + 6, {
            cor: jogo.textoFraco,
            alinhamento: "centro",
        });
    }

    onDestroyEvent() {
        this.titulo.destroy();
        this.subtitulo.destroy();
    }
}
