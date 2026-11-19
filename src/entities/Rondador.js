import { collision, Rect, Renderable } from "melonjs";
import { CONFIG } from "../config.js";
import { centroDoTile, proximoPasso, tileDe } from "../systems/caminho.js";
import { registrarBrilho, removerBrilho } from "../systems/brilhos.js";
import { estado, jogoParado, morrer } from "../systems/estado.js";
import { dadosDoEstilo } from "../systems/estilo.js";
import { estaIluminado } from "../systems/luz.js";
import { criarSpriteDaFolha, desenharSprite, pintar } from "./folha.js";

const LADO = 12;
// o corpo ocupa as colunas e linhas 2 a 13 do quadro: quadro 2 px antes da hitbox
const RECUO_DO_QUADRO = 2;
// quadros da folha de sprites e ms por quadro
const QUADROS_ESCURO = [24, 25, 26, 27];
const MS_ESCURO = 140;
const QUADROS_CONGELADO = [28, 29];
const MS_CONGELADO = 90;
// olhos no quadro (tools/gerar-sprites.mjs): por olho, a coluna de cima
// (2 px de altura a partir da linha 6) e o canto de dentro (linha 7)
const OLHOS = [
    [5, 6],
    [10, 9],
];
const LINHA_DOS_OLHOS = 6;
// nos quadros 25 e 26 o corpo flutua 1 px para cima, com os olhos
const QUADROS_QUE_SOBEM = new Set([25, 26]);
// distância (px) em que o Rondador considera que chegou ao centro do tile alvo
const CHEGOU = 0.5;

// Criatura básica: no escuro anda até o jogador pela BFS; iluminado, congela.
export class Rondador extends Renderable {
    constructor(x, y, settings) {
        const largura = settings.width ?? CONFIG.tile;
        const altura = settings.height ?? CONFIG.tile;
        super(x + (largura - LADO) / 2, y + (altura - LADO) / 2, LADO, LADO);
        this.anchorPoint.set(0, 0);
        // persegue mesmo fora da tela
        this.alwaysUpdate = true;

        this.bodyDef = {
            type: "dynamic",
            shapes: [new Rect(0, 0, LADO, LADO)],
            collisionType: collision.types.ENEMY_OBJECT,
            collisionMask: collision.types.WORLD_SHAPE | collision.types.PLAYER_OBJECT,
            gravityScale: 0,
        };

        this.congelado = false;
        // centro (px) do tile para onde está andando; null = escolher o próximo
        this.alvo = null;
        // objeto reaproveitado para a consulta de luz
        this.centro = { x: 0, y: 0 };

        // sombra flutuando no escuro; pedra tremendo quando iluminado
        this.sprite = criarSpriteDaFolha(0, 0);
        this.sprite.addAnimation("escuro", QUADROS_ESCURO, MS_ESCURO);
        this.sprite.addAnimation("congelado", QUADROS_CONGELADO, MS_CONGELADO);
        this.sprite.setCurrentAnimation("escuro");
        this.corOlho = dadosDoEstilo().jogo.olho;
    }

    onActivateEvent() {
        registrarBrilho(this);
    }

    onDeactivateEvent() {
        removerBrilho(this);
    }

    update(dt) {
        this.atualizarRondador();
        this.sprite.setCurrentAnimation(this.congelado ? "congelado" : "escuro");
        this.sprite.update(dt);
        return true;
    }

    // Regra de movimento (perseguir no escuro, congelar iluminado).
    atualizarRondador() {
        if (jogoParado()) {
            this.body.setVelocity(0, 0);
            return;
        }

        this.centro.x = this.pos.x + LADO / 2;
        this.centro.y = this.pos.y + LADO / 2;

        this.congelado = estaIluminado(this.centro);
        const jogador = estado.jogador;
        if (this.congelado || jogador === null) {
            this.body.setVelocity(0, 0);
            return;
        }

        // só escolhe o próximo tile ao chegar no centro do atual: assim anda
        // sempre de centro a centro e não raspa nas quinas das paredes.
        // A BFS (em caminho.js) só é refeita quando o jogador muda de tile.
        if (this.alvo === null || this.distanciaAoAlvo() < CHEGOU) {
            this.escolherAlvo(jogador);
        }

        const dx = this.alvo.x - this.centro.x;
        const dy = this.alvo.y - this.centro.y;
        const distancia = Math.hypot(dx, dy);
        if (distancia < 0.001) {
            this.body.setVelocity(0, 0);
            return;
        }
        const passo = Math.min(CONFIG.velocidadeRondador, distancia);
        this.body.setVelocity((dx / distancia) * passo, (dy / distancia) * passo);
    }

    distanciaAoAlvo() {
        return Math.hypot(this.alvo.x - this.centro.x, this.alvo.y - this.centro.y);
    }

    escolherAlvo(jogador) {
        const de = { x: tileDe(this.centro.x), y: tileDe(this.centro.y) };
        const para = { x: tileDe(jogador.centroX), y: tileDe(jogador.centroY) };
        const passo = proximoPasso(de, para);
        if (passo !== null) {
            this.alvo = { x: centroDoTile(passo.x), y: centroDoTile(passo.y) };
        } else {
            // mesmo tile do jogador (ou sem caminho): vai direto até ele
            this.alvo = { x: jogador.centroX, y: jogador.centroY };
        }
    }

    // Encostar no jogador mata (uma vez por fase): a PlayStage mostra o efeito
    // e pede o reinício logo depois, fora da colisão.
    onCollisionStart(response, other) {
        if (jogoParado()) {
            return;
        }
        if (other.body && other.body.collisionType === collision.types.PLAYER_OBJECT) {
            morrer();
        }
    }

    // canto superior esquerdo do quadro do sprite
    get quadroX() {
        return Math.round(this.pos.x - RECUO_DO_QUADRO);
    }

    get quadroY() {
        return Math.round(this.pos.y - RECUO_DO_QUADRO);
    }

    draw(renderer) {
        this.sprite.pos.set(this.quadroX, this.quadroY);
        desenharSprite(renderer, this.sprite);
    }

    // Os dois olhos por cima da escuridão: no escuro o Rondador é visto só
    // por eles. Congelado (pedra), os olhos estão fechados.
    desenharBrilho(renderer) {
        if (this.congelado) {
            return;
        }
        const quadro = QUADROS_ESCURO[this.sprite.getCurrentAnimationFrame()];
        const y = this.quadroY + LINHA_DOS_OLHOS - (QUADROS_QUE_SOBEM.has(quadro) ? 1 : 0);
        for (const [fora, dentro] of OLHOS) {
            pintar(renderer, this.corOlho, this.quadroX + fora, y, 1, 2);
            pintar(renderer, this.corOlho, this.quadroX + dentro, y + 1);
        }
    }
}