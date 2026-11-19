import { collision, Rect, Renderable } from "melonjs";
import { CONFIG } from "../config.js";
import { registrarBrilho, removerBrilho } from "../systems/brilhos.js";
import { estado } from "../systems/estado.js";
import { dadosDoEstilo } from "../systems/estilo.js";
import { criarSpriteDaFolha, desenharSprite, pintar, QUADRO } from "./folha.js";

const LADO = 14;
// escotilha com a luz pulsando por baixo (quadros da folha de sprites)
const QUADROS = [36, 37, 38, 39];
const MS_POR_QUADRO = 180;
// pontinho de luz na fresta do meio do alçapão (2×2 px, no quadro) e a
// opacidade dele em cada quadro: escuro, médio, claro, médio
const PONTO_X = 7;
const PONTO_Y = 7;
const OPACIDADE_DO_PONTO = [0.25, 0.55, 0.95, 0.55];

// Saída da fase: pisar nela conclui a fase e para a jogabilidade.
export class Saida extends Renderable {
    constructor(x, y, settings) {
        const largura = settings.width ?? CONFIG.tile;
        const altura = settings.height ?? CONFIG.tile;
        super(x + (largura - LADO) / 2, y + (altura - LADO) / 2, LADO, LADO);
        this.anchorPoint.set(0, 0);

        this.bodyDef = {
            type: "static",
            shapes: [new Rect(0, 0, LADO, LADO)],
            collisionType: collision.types.ACTION_OBJECT,
            collisionMask: collision.types.PLAYER_OBJECT,
            isSensor: true,
        };

        // o quadro do sprite fica centrado no objeto do Tiled
        this.sprite = criarSpriteDaFolha(
            Math.round(x + (largura - QUADRO) / 2),
            Math.round(y + (altura - QUADRO) / 2),
        );
        this.sprite.addAnimation("pulso", QUADROS, MS_POR_QUADRO);
        this.sprite.setCurrentAnimation("pulso");
        this.corPonto = dadosDoEstilo().jogo.chama;
    }

    onActivateEvent() {
        registrarBrilho(this);
    }

    onDeactivateEvent() {
        removerBrilho(this);
    }

    update(dt) {
        this.sprite.update(dt);
        return true;
    }

    onCollisionStart(response, other) {
        // durante o efeito da morte a saída não conclui a fase
        if (estado.morreu) {
            return;
        }
        if (other.body && other.body.collisionType === collision.types.PLAYER_OBJECT) {
            estado.fimDeFase = true;
        }
    }

    draw(renderer) {
        desenharSprite(renderer, this.sprite);
    }

    // Pontinho pulsando por cima da escuridão: a saída se acha no escuro.
    desenharBrilho(renderer) {
        const opacidade = OPACIDADE_DO_PONTO[this.sprite.getCurrentAnimationFrame()];
        const { x, y } = this.sprite.pos;
        pintar(renderer, this.corPonto, x + PONTO_X, y + PONTO_Y, 2, 2, opacidade);
    }
}