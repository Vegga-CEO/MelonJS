import { BitmapText, event, input, loader, Polygon, Renderable, Stage, state, Vector2d } from "melonjs";
import { CONFIG } from "../config.js";
import { desenharSprite, pintar } from "../entities/folha.js";
import { dadosDoEstilo, imagem } from "../systems/estilo.js";
import { aplicarPosEfeitos } from "../systems/posEfeitos.js";

// teclas do título: [código, ação]; todas por evento (um toque nunca se perde)
const TECLAS = [
    [input.KEY.ENTER, "jogar"],
    [input.KEY.SPACE, "jogar"],
];

// lanterna do farol na imagem titulo-<estilo> (tools/gerar-titulo.mjs)
const LANTERNA_X = 520;
const LANTERNA_Y = 101;

// Facho do farol: duas cunhas opostas girando uma volta a cada FACHO_VOLTA
// ms. O giro é em torno do eixo da torre, visto quase de lado: a componente
// vertical é achatada por FACHO_ACHATAMENTO, então o facho varre o
// horizonte e encurta quando aponta para perto ou para longe de quem olha.
// Duas camadas somadas (abertura cheia e metade) deixam o miolo mais forte
// que a borda: FACHO_OPACIDADE é a do miolo.
const FACHO_VOLTA = 6000;
const FACHO_ABERTURA = 0.6;
const FACHO_COMPRIMENTO = 700;
const FACHO_ACHATAMENTO = 0.3;
const FACHO_OPACIDADE = 0.18;
// ponto de luz da lanterna: halo e miolo
const HALO_RAIO = 9;
const HALO_OPACIDADE = 0.35;
const MIOLO_LADO = 4;

// estrelas piscando no céu (acima do horizonte, y < 226), por semente fixa
const ESTRELAS = 36;
const SEMENTE = 20261103;
const CEU_ALTURA = 190;

// logo centrado no alto, flutuando 1 a 2 px
const LOGO_LARGURA = 310;
const LOGO_Y = 26;
const LOGO_PERIODO = 3000;
const LOGO_AMPLITUDE = 1.5;

// textos (coordenadas da tela 640×360)
const JOGAR_Y = 258;
const JOGAR_PERIODO = 1600;

// Gerador pseudoaleatório com semente (mulberry32): as estrelas ficam sempre
// no mesmo lugar.
function aleatorioComSemente(semente) {
    let s = semente >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Posições das estrelas, fora da lua, do logo e da torre do farol.
function sortearEstrelas() {
    const sorte = aleatorioComSemente(SEMENTE);
    const estrelas = [];
    while (estrelas.length < ESTRELAS) {
        const x = Math.floor(sorte() * CONFIG.largura);
        const y = Math.floor(Math.pow(sorte(), 1.4) * CEU_ALTURA);
        const fase = sorte() * Math.PI * 2;
        const ritmo = 0.001 + sorte() * 0.002;
        const naLua = Math.hypot(x - 112, y - 64) < 26;
        const noLogo = x > 155 && x < 485 && y > 18 && y < 88;
        const noFarol = x > 495 && x < 545 && y > 80;
        if (!naLua && !noLogo && !noFarol) {
            estrelas.push({ x, y, fase, ritmo });
        }
    }
    return estrelas;
}

// Texto com sombra 1 px abaixo, como na interface da PlayStage.
function escrever(renderer, rotulo, x, y, cor, sombra, opacidade = 1) {
    rotulo.alpha = opacidade;
    rotulo.fillStyle = sombra;
    rotulo.pos.set(x, y + 1);
    desenharSprite(renderer, rotulo);
    rotulo.fillStyle = cor;
    rotulo.pos.set(x, y);
    desenharSprite(renderer, rotulo);
}

// A tela inteira: fundo, estrelas, facho, logo e textos, em pixels de tela.
class TelaDeTitulo extends Renderable {
    constructor() {
        super(0, 0, CONFIG.largura, CONFIG.altura);
        this.anchorPoint.set(0, 0);
        this.floating = true;
        this.alwaysUpdate = true;
        this.tempo = 0;
        this.estrelas = sortearEstrelas();
        // três vértices reaproveitados por cunha (sem alocar por quadro)
        this.pontos = [new Vector2d(), new Vector2d(), new Vector2d()];
        this.cunha = new Polygon(0, 0, this.pontos);
        const rotulo = (texto) => new BitmapText(0, 0, { font: "pixel", text: texto });
        this.jogar = rotulo("Enter para jogar");
    }

    update(dt) {
        this.tempo += dt;
        return true;
    }

    // x inteiro que centraliza o rótulo na tela
    centroX(rotulo) {
        return Math.round((CONFIG.largura - rotulo.measureText().width) / 2);
    }

    // Uma cunha do facho a partir da lanterna, apontando para o ângulo dado.
    desenharCunha(renderer, angulo, abertura) {
        const [origem, a, b] = this.pontos;
        origem.set(LANTERNA_X, LANTERNA_Y);
        const metade = abertura / 2;
        a.set(
            LANTERNA_X + Math.cos(angulo - metade) * FACHO_COMPRIMENTO,
            LANTERNA_Y + Math.sin(angulo - metade) * FACHO_COMPRIMENTO * FACHO_ACHATAMENTO,
        );
        b.set(
            LANTERNA_X + Math.cos(angulo + metade) * FACHO_COMPRIMENTO,
            LANTERNA_Y + Math.sin(angulo + metade) * FACHO_COMPRIMENTO * FACHO_ACHATAMENTO,
        );
        this.cunha.setVertices(this.pontos);
        renderer.fill(this.cunha);
    }

    // Cunhas e halo somados à cena (blend aditivo); o miolo da lanterna por cima.
    desenharFacho(renderer, jogo) {
        const angulo = (this.tempo / FACHO_VOLTA) * Math.PI * 2;
        renderer.save();
        renderer.setBlendMode("additive");
        // a cor vem depois da opacidade: nos renderizadores de GPU o setColor
        // guarda a opacidade do momento
        renderer.setGlobalAlpha(FACHO_OPACIDADE / 2);
        renderer.setColor(jogo.luz);
        for (const lado of [0, Math.PI]) {
            this.desenharCunha(renderer, angulo + lado, FACHO_ABERTURA);
            this.desenharCunha(renderer, angulo + lado, FACHO_ABERTURA / 2);
        }
        renderer.setGlobalAlpha(HALO_OPACIDADE);
        renderer.setColor(jogo.luz);
        renderer.fillEllipse(LANTERNA_X, LANTERNA_Y, HALO_RAIO, HALO_RAIO);
        renderer.setBlendMode("normal");
        renderer.restore();
        pintar(renderer, jogo.chama, LANTERNA_X - MIOLO_LADO / 2, LANTERNA_Y - MIOLO_LADO / 2, MIOLO_LADO, MIOLO_LADO);
    }

    draw(renderer) {
        const { jogo } = dadosDoEstilo();
        const t = this.tempo;
        renderer.save();
        renderer.setGlobalAlpha(1);
        renderer.drawImage(loader.getImage(imagem("titulo")), 0, 0);

        for (const estrela of this.estrelas) {
            const brilho = 0.5 + 0.5 * Math.sin(t * estrela.ritmo + estrela.fase);
            pintar(renderer, jogo.texto, estrela.x, estrela.y, 1, 1, 0.25 + 0.75 * brilho);
        }

        this.desenharFacho(renderer, jogo);

        const logo = loader.getImage(imagem("logo"));
        const flutua = Math.round(Math.sin((t / LOGO_PERIODO) * Math.PI * 2) * LOGO_AMPLITUDE);
        renderer.setGlobalAlpha(1);
        renderer.drawImage(logo, Math.round((CONFIG.largura - LOGO_LARGURA) / 2), LOGO_Y + flutua);

        const piscar = 0.55 + 0.45 * Math.sin((t / JOGAR_PERIODO) * Math.PI * 2);
        escrever(renderer, this.jogar, this.centroX(this.jogar), JOGAR_Y, jogo.destaque, jogo.escuridao, piscar);
        renderer.restore();
    }

    destroy() {
        this.jogar.destroy();
        super.destroy();
    }
}

// Tela de título: Enter ou Espaço começam o jogo.
export class TituloStage extends Stage {
    constructor() {
        super();
        this.aoApertar = this.aoApertar.bind(this);
        this.aoSoltar = this.aoSoltar.bind(this);
        this.app = null;
        // ações seguradas: o KEYDOWN se repete com a tecla segurada
        this.segurando = new Set();
    }

    onResetEvent(app) {
        this.app = app;
        this.segurando.clear();
        for (const [codigo, acao] of TECLAS) {
            input.bindKey(codigo, acao, true, true);
        }
        event.on(event.KEYDOWN, this.aoApertar);
        event.on(event.KEYUP, this.aoSoltar);
        aplicarPosEfeitos(app);
        app.world.addChild(new TelaDeTitulo(), 1);
    }

    onDestroyEvent() {
        for (const [codigo] of TECLAS) {
            input.unbindKey(codigo);
        }
        event.off(event.KEYDOWN, this.aoApertar);
        event.off(event.KEYUP, this.aoSoltar);
    }

    aoApertar(acao) {
        if (acao === undefined || this.segurando.has(acao)) {
            return;
        }
        this.segurando.add(acao);
        if (acao === "jogar") {
            state.change(state.PLAY);
        }
    }

    aoSoltar(acao) {
        this.segurando.delete(acao);
    }
}