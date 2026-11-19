import { Light2d, Sprite, Tween } from "melonjs";
import { CONFIG } from "../config.js";
import { registrarBrilho, removerBrilho } from "../systems/brilhos.js";
import { dadosDoEstilo, imagem } from "../systems/estilo.js";
import { registrarFonte, removerFonte } from "../systems/luz.js";
import { emitirFaiscas } from "../systems/particulas.js";
import { pintar, QUADRO } from "./folha.js";

// z de desenho: acima do chão, das paredes e das entidades do mapa
const Z_POSTE = 8;
const Z_LUZ = 9;
// poste com a chama tremendo (quadros da folha de sprites)
const QUADROS = [40, 41, 42];
const MS_POR_QUADRO = 120;
// ao ser instalado, o poste "estala": a escala cai de ESTALO_ESCALA para 1
const ESTALO_ESCALA = 1.3;
const ESTALO_MS = 150;
// pixels do miolo da chama em cada quadro, [coluna, linha] no quadro
// (tools/gerar-sprites.mjs: CHAMAS, a partir de (7, 5))
const MIOLO_DA_CHAMA = [
    [
        [8, 6],
        [7, 7],
        [8, 7],
    ],
    [
        [7, 6],
        [7, 7],
        [8, 7],
    ],
    [
        [8, 6],
        [7, 7],
    ],
];

// Poste desenhado embaixo da luz, com o centro do quadro no centro do tile.
class PosteLanterna extends Sprite {
    constructor(cx, cy) {
        super(cx, cy, { image: imagem("sprites"), framewidth: QUADRO, frameheight: QUADRO });
        this.addAnimation("chama", QUADROS, MS_POR_QUADRO);
        this.setCurrentAnimation("chama");
        this.corChama = dadosDoEstilo().jogo.chama;
        this.estalo = null;
    }

    onActivateEvent() {
        registrarBrilho(this);
        // estalo: a escala volta a 1 em torno do centro (anchorPoint padrão)
        const escala = { valor: ESTALO_ESCALA };
        this.aplicarEscala(escala.valor);
        this.estalo = new Tween(escala)
            .to({ valor: 1 }, { duration: ESTALO_MS })
            .easing(Tween.Easing.Quadratic.Out)
            .onUpdate(() => this.aplicarEscala(escala.valor))
            .onComplete(() => {
                this.aplicarEscala(1);
                this.estalo = null;
            })
            .start();
    }

    onDeactivateEvent() {
        removerBrilho(this);
        if (this.estalo !== null) {
            this.estalo.stop();
            this.estalo = null;
        }
    }

    aplicarEscala(valor) {
        this.currentTransform.identity();
        this.scale(valor);
    }

    // Miolo da chama por cima da escuridão.
    desenharBrilho(renderer) {
        // pos é o centro (anchorPoint padrão); o quadro começa meio quadro antes
        const x0 = Math.round(this.pos.x - QUADRO / 2);
        const y0 = Math.round(this.pos.y - QUADRO / 2);
        for (const [x, y] of MIOLO_DA_CHAMA[this.getCurrentAnimationFrame()]) {
            pintar(renderer, this.corChama, x0 + x, y0 + y);
        }
    }
}

// Lanterna fixa: um Light2d parado, registrado como fonte de luz em systems/luz.js.
// Fica acesa até o fim da fase (o reinício limpa o mundo e o registro).
export class LanternaFixa extends Light2d {
    constructor(cx, cy) {
        super(cx, cy, CONFIG.raioLanternaFixa, CONFIG.raioLanternaFixa, dadosDoEstilo().jogo.luz);
        this.softness = 0.6;
        this.intensity = CONFIG.intensidadeLuz;
        // o brilho é desenhado pela PlayStage, recortado nas paredes
        this.illuminationOnly = true;
        this.fonte = { x: cx, y: cy, raio: CONFIG.raioLanternaFixa, acesa: true };
    }

    onActivateEvent() {
        super.onActivateEvent();
        registrarFonte(this.fonte);
    }

    onDeactivateEvent() {
        super.onDeactivateEvent();
        removerFonte(this.fonte);
    }

    // Instala uma lanterna (poste + luz) com centro em (cx, cy) no container.
    static instalar(container, cx, cy) {
        container.addChild(new PosteLanterna(cx, cy), Z_POSTE);
        emitirFaiscas(cx, cy - 2);
        const lanterna = new LanternaFixa(cx, cy);
        container.addChild(lanterna, Z_LUZ);
        return lanterna;
    }
}