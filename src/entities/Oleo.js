import { collision, Rect, Renderable } from "melonjs";
import { CONFIG } from "../config.js";
import { estado } from "../systems/estado.js";
import { emitirEstrelinhas } from "../systems/particulas.js";
import { criarSpriteDaFolha, desenharSprite, QUADRO } from "./folha.js";

const LARGURA = 8;
const ALTURA = 10;
// um brilho passa pela lata (32 a 34) e ela descansa no quadro 35, sem
// brilho, antes do próximo (quadros da folha de sprites)
const QUADROS = [
    { name: 32, delay: 150 },
    { name: 33, delay: 150 },
    { name: 34, delay: 150 },
    { name: 35, delay: 1000 },
];

// Lata de óleo: o jogador pega ao encostar e ganha CONFIG.oleoPorLata.
export class Oleo extends Renderable {
    constructor(x, y, settings) {
        const largura = settings.width ?? CONFIG.tile;
        const altura = settings.height ?? CONFIG.tile;
        super(x + (largura - LARGURA) / 2, y + (altura - ALTURA) / 2, LARGURA, ALTURA);
        this.anchorPoint.set(0, 0);

        // sensor: detecta o jogador sem empurrar ninguém
        this.bodyDef = {
            type: "static",
            shapes: [new Rect(0, 0, LARGURA, ALTURA)],
            collisionType: collision.types.COLLECTABLE_OBJECT,
            collisionMask: collision.types.PLAYER_OBJECT,
            isSensor: true,
        };
        this.coletada = false;

        // o quadro do sprite fica centrado no objeto do Tiled
        this.sprite = criarSpriteDaFolha(
            Math.round(x + (largura - QUADRO) / 2),
            Math.round(y + (altura - QUADRO) / 2),
        );
        this.sprite.addAnimation("brilho", QUADROS);
        this.sprite.setCurrentAnimation("brilho");
    }

    update(dt) {
        this.sprite.update(dt);
        return true;
    }

    onCollisionStart(response, other) {
        if (this.coletada) {
            return;
        }
        if (other.body && other.body.collisionType === collision.types.PLAYER_OBJECT) {
            this.coletada = true;
            estado.oleo += CONFIG.oleoPorLata;
            estado.latasPegas++;
            emitirEstrelinhas(this.pos.x + LARGURA / 2, this.pos.y + ALTURA / 2);
            // removeChild é adiado para depois do passo de física: seguro aqui
            this.ancestor.removeChild(this);
        }
    }

    draw(renderer) {
        desenharSprite(renderer, this.sprite);
    }
}