import { collision, input, Light2d, Rect, Renderable } from "melonjs";
import { CONFIG } from "../config.js";
import { registrarBrilho, removerBrilho } from "../systems/brilhos.js";
import { centroDoTile, tileDe } from "../systems/caminho.js";
import { estado, jogoParado } from "../systems/estado.js";
import { dadosDoEstilo } from "../systems/estilo.js";
import { registrarFonte, removerFonte } from "../systems/luz.js";
import { emitirBrasa, emitirPoeira } from "../systems/particulas.js";
import { criarSpriteDaFolha, desenharSprite, pintar, QUADRO } from "./folha.js";
import { LanternaFixa } from "./LanternaFixa.js";

const LARGURA = 10;
const ALTURA = 12;
// z da luz: acima do chão, das paredes e das entidades do mapa
const Z_LAMPARINA = 9;

// quadros da folha por direção; "lado" olha para a
// direita e é espelhado para a esquerda
const QUADROS = {
    baixo: { parado: [0, 1], andando: [2, 3, 4, 5] },
    cima: { parado: [8, 9], andando: [10, 11, 12, 13] },
    lado: { parado: [16, 17], andando: [18, 19, 20, 21] },
};
// ms por quadro
const MS_PARADO = 500;
const MS_ANDANDO = 110;

// Lamparina desenhada em cada quadro (tools/gerar-sprites.mjs): coluna do
// canto dela no quadro; nos quadros ímpares o corpo sobe 1 px e ela junto.
// O miolo da chama fica 1 px à direita do canto, na linha 13 (12 se subiu).
const LAMPARINA_X = {
    0: 11, 1: 11, 2: 11, 3: 12, 4: 11, 5: 10,
    8: 1, 9: 1, 10: 1, 11: 0, 12: 1, 13: 2,
    16: 11, 17: 11, 18: 11, 19: 12, 20: 11, 21: 10,
};
const LINHA_DA_CHAMA = 13;

// partículas (só desenho): poeira a cada PASSOS_POR_POEIRA quadros de
// caminhada e uma brasa subindo da lamparina acesa a cada BRASA_MS (± folga)
const PASSOS_POR_POEIRA = 4;
const BRASA_MS = 250;
const BRASA_FOLGA = 60;

// O faroleiro: anda em 8 direções, colide com paredes, leva a lamparina
// e instala lanternas fixas.
export class Player extends Renderable {
    constructor(x, y, settings) {
        // o objeto do Tiled ocupa um tile; o corpo fica centrado nele
        const largura = settings.width ?? CONFIG.tile;
        const altura = settings.height ?? CONFIG.tile;
        super(x + (largura - LARGURA) / 2, y + (altura - ALTURA) / 2, LARGURA, ALTURA);
        // pos é o canto superior esquerdo, como no Tiled
        this.anchorPoint.set(0, 0);
        // continua atualizando mesmo se sair da tela por um instante
        this.alwaysUpdate = true;

        this.bodyDef = {
            type: "dynamic",
            shapes: [new Rect(0, 0, LARGURA, ALTURA)],
            collisionType: collision.types.PLAYER_OBJECT,
            collisionMask:
                collision.types.WORLD_SHAPE |
                collision.types.ENEMY_OBJECT |
                collision.types.COLLECTABLE_OBJECT |
                collision.types.ACTION_OBJECT,
            // visão de cima: sem gravidade
            gravityScale: 0,
        };

        this.lamparinaAcesa = false;
        this.lamparina = null;

        // aparência: sprite da folha, direção da última entrada e se anda
        this.sprite = criarSpriteDaFolha(0, 0);
        for (const [direcao, quadros] of Object.entries(QUADROS)) {
            this.sprite.addAnimation(`parado-${direcao}`, quadros.parado, MS_PARADO);
            this.sprite.addAnimation(`andando-${direcao}`, quadros.andando, MS_ANDANDO);
        }
        this.direcao = "baixo";
        this.andando = false;
        // quadros de caminhada contados (poeira) e ms até a próxima brasa
        this.quadroAnterior = -1;
        this.passos = 0;
        this.brasaEspera = BRASA_MS;
        this.escolherAnimacao();
        const jogo = dadosDoEstilo().jogo;
        this.corLuz = jogo.luz;
        this.corChama = jogo.chama;

        // fonte de luz para systems/luz.js, sempre no centro do jogador
        const jogador = this;
        this.fonte = {
            get x() {
                return jogador.centroX;
            },
            get y() {
                return jogador.centroY;
            },
            raio: CONFIG.raioLamparina,
            get acesa() {
                return jogador.lamparinaAcesa;
            },
        };
    }

    get centroX() {
        return this.pos.x + LARGURA / 2;
    }

    get centroY() {
        return this.pos.y + ALTURA / 2;
    }

    onActivateEvent() {
        estado.jogador = this;
        registrarFonte(this.fonte);

        // a lamparina é um Light2d que segue o jogador; apagada, fica na
        // camada de visibilidade 0, que nenhuma câmera desenha nem recorta
        this.lamparina = new Light2d(
            this.centroX,
            this.centroY,
            CONFIG.raioLamparina,
            CONFIG.raioLamparina,
            this.corLuz,
        );
        this.lamparina.softness = 0.6;
        this.lamparina.intensity = CONFIG.intensidadeLuz;
        // o brilho é desenhado pela PlayStage, recortado nas paredes
        this.lamparina.illuminationOnly = true;
        this.atualizarLamparina();
        this.ancestor.addChild(this.lamparina, Z_LAMPARINA);
        registrarBrilho(this);

        // a câmera segue o jogador (os limites vêm do mapa, via level.load)
        const viewport = this.parentApp.viewport;
        viewport.follow(this, viewport.AXIS.BOTH, 0.1);
    }

    onDeactivateEvent() {
        removerFonte(this.fonte);
        removerBrilho(this);
        if (estado.jogador === this) {
            estado.jogador = null;
        }
        // a lamparina é filha do mundo e sai junto quando a fase é limpa
        this.lamparina = null;
        this.parentApp.viewport.unfollow();
    }

    // Mostra ou esconde a luz conforme o estado da lamparina.
    atualizarLamparina() {
        if (this.lamparina === null) {
            return;
        }
        this.lamparina.visibilityLayer = this.lamparinaAcesa ? 1 : 0;
        this.lamparina.centerX = this.centroX;
        this.lamparina.centerY = this.centroY;
    }

    update(dt) {
        if (jogoParado()) {
            // fase concluída ou morte: para de andar e de gastar óleo
            this.body.setVelocity(0, 0);
            this.andando = false;
        } else {
            this.mover();
            this.controlarLamparina(dt);
            if (input.isKeyPressed("lanterna")) {
                this.instalarLanterna();
            }
            this.atualizarLamparina();
        }
        this.escolherAnimacao();
        this.sprite.update(dt);
        this.soltarParticulas(dt);
        return true;
    }

    // Poeira nos pés ao andar e brasas da lamparina acesa.
    soltarParticulas(dt) {
        const quadro = this.sprite.getCurrentAnimationFrame();
        if (this.andando && quadro !== this.quadroAnterior) {
            this.passos++;
            if (this.passos % PASSOS_POR_POEIRA === 0) {
                emitirPoeira(this.centroX, this.pos.y + ALTURA);
            }
        }
        this.quadroAnterior = quadro;

        this.brasaEspera -= dt;
        if (this.brasaEspera <= 0) {
            this.brasaEspera = BRASA_MS + (Math.random() * 2 - 1) * BRASA_FOLGA;
            if (this.lamparinaAcesa) {
                const chama = this.posicaoDaChama();
                emitirBrasa(chama.x, chama.y - 1);
            }
        }
    }

    // Animação pela direção da última entrada; "lado" espelhado à esquerda.
    escolherAnimacao() {
        const lado = this.direcao === "esquerda" || this.direcao === "direita";
        const eixo = lado ? "lado" : this.direcao;
        this.sprite.setCurrentAnimation(`${this.andando ? "andando" : "parado"}-${eixo}`);
        this.sprite.flipX(this.direcao === "esquerda");
    }

    // Quadro da folha mostrado agora.
    quadroAtual() {
        const [modo, eixo] = this.sprite.current.name.split("-");
        return QUADROS[eixo][modo][this.sprite.getCurrentAnimationFrame()];
    }

    // Canto superior esquerdo do quadro: centrado na hitbox, pés na base dela.
    get quadroX() {
        return Math.round(this.pos.x + LARGURA / 2 - QUADRO / 2);
    }

    get quadroY() {
        return Math.round(this.pos.y + ALTURA - QUADRO);
    }

    // WASD e setas, 8 direções, diagonal normalizada.
    mover() {
        let dx = 0;
        let dy = 0;
        if (input.isKeyPressed("esquerda")) dx -= 1;
        if (input.isKeyPressed("direita")) dx += 1;
        if (input.isKeyPressed("cima")) dy -= 1;
        if (input.isKeyPressed("baixo")) dy += 1;
        // direção do sprite: na diagonal vale o eixo horizontal
        this.andando = dx !== 0 || dy !== 0;
        if (dx !== 0) {
            this.direcao = dx < 0 ? "esquerda" : "direita";
        } else if (dy !== 0) {
            this.direcao = dy < 0 ? "cima" : "baixo";
        }
        if (dx !== 0 && dy !== 0) {
            dx *= Math.SQRT1_2;
            dy *= Math.SQRT1_2;
        }
        this.body.setVelocity(dx * CONFIG.velocidadeJogador, dy * CONFIG.velocidadeJogador);
    }

    // Espaço liga/desliga; acesa, gasta óleo por segundo (dt em ms).
    controlarLamparina(dt) {
        if (input.isKeyPressed("lamparina")) {
            if (this.lamparinaAcesa) {
                this.lamparinaAcesa = false;
            } else if (estado.oleo > 0) {
                this.lamparinaAcesa = true;
            }
        }
        if (this.lamparinaAcesa) {
            estado.oleo -= (CONFIG.oleoPorSegundo * dt) / 1000;
            if (estado.oleo <= 0) {
                estado.oleo = 0;
                this.lamparinaAcesa = false;
            }
        }
    }

    // E: lanterna fixa no centro do tile do jogador, se houver óleo e o tile estiver livre.
    instalarLanterna() {
        if (estado.oleo < CONFIG.custoLanternaFixa) {
            return;
        }
        const tx = tileDe(this.centroX);
        const ty = tileDe(this.centroY);
        const chave = `${tx},${ty}`;
        if (estado.lanternas.has(chave)) {
            return;
        }
        estado.oleo -= CONFIG.custoLanternaFixa;
        estado.lanternas.add(chave);
        LanternaFixa.instalar(this.ancestor, centroDoTile(tx), centroDoTile(ty));
    }

    draw(renderer) {
        this.sprite.pos.set(this.quadroX, this.quadroY);
        desenharSprite(renderer, this.sprite);
    }

    // Chama da lamparina acesa por cima da escuridão: o miolo e, embaixo
    // dele, 1 px mais fraco.
    desenharBrilho(renderer) {
        if (!this.lamparinaAcesa) {
            return;
        }
        const { x, y } = this.posicaoDaChama();
        pintar(renderer, this.corChama, x, y);
        pintar(renderer, this.corChama, x, y + 1, 1, 1, 0.5);
    }

    // Pixel do miolo da chama da lamparina no quadro atual, em pixels do mundo.
    posicaoDaChama() {
        const quadro = this.quadroAtual();
        let x = LAMPARINA_X[quadro] + 1;
        if (this.direcao === "esquerda") {
            x = QUADRO - 1 - x;
        }
        const y = LINHA_DA_CHAMA - (quadro % 2);
        return { x: this.quadroX + x, y: this.quadroY + y };
    }
}