import { BitmapText, Color, event, FadeEffect, input, level, Stage, state } from "melonjs";
import { CONFIG } from "../config.js";
import { criarSpriteDaFolha, desenharSprite, pintar } from "../entities/folha.js";
import { desenharBrilhos, limparBrilhos } from "../systems/brilhos.js";
import { carregarGrade } from "../systems/caminho.js";
import { estado, pedirReinicio, reiniciar } from "../systems/estado.js";
import { dadosDoEstilo, estiloAtual, nomeDaFase } from "../systems/estilo.js";
import { limparFontes } from "../systems/luz.js";
import { Particulas } from "../systems/particulas.js";
import { aplicarPosEfeitos } from "../systems/posEfeitos.js";
import { AreaVisivel } from "../systems/visibilidade.js";

const FASE = "fase1";

// teclas de jogo: [código, ação, travada (uma vez por toque)]
const TECLAS = [
    [input.KEY.A, "esquerda", false],
    [input.KEY.LEFT, "esquerda", false],
    [input.KEY.D, "direita", false],
    [input.KEY.RIGHT, "direita", false],
    [input.KEY.W, "cima", false],
    [input.KEY.UP, "cima", false],
    [input.KEY.S, "baixo", false],
    [input.KEY.DOWN, "baixo", false],
    [input.KEY.SPACE, "lamparina", true],
    [input.KEY.E, "lanterna", true],
    [input.KEY.R, "reiniciar", true],
    [input.KEY.ESC, "titulo", true],
];

// z da camada de partículas: acima das entidades do mapa, abaixo do poste
// das lanternas (8) e das luzes (9)
const Z_PARTICULAS = 7;

// Transições e "suco" (só desenho; a regra de jogo não muda)
// cor das cortinas de fade
const COR_FADE = "#000000";
// fade de preto no início (ou reinício) da fase
const FADE_INICIO = 300;
// morte: tremor da câmera, flash e escurecimento antes do reinício
const MORTE_ESPERA = 400;
const TREMOR_INTENSIDADE = 3;
const TREMOR_DURACAO = 250;
const FLASH_DURACAO = 200;
// flash da morte por estilo: vermelho escuro
const FLASH_DA_MORTE = {
    mare: "rgba(140, 24, 24, 0.55)",
};

// Borda suave da luz: anéis de escuridão, do de fora para o de dentro. O anel
// i escurece tudo o que fica fora da área visível das luzes encolhida para
// ESCALAS_ANEL[i], com a cor ambiente na opacidade do anel. Os anéis se
// somam por composição: o centro fica limpo, a borda vai escurecendo e fora
// de todas as luzes passam os quatro, o que dá a opacidade escuridaoLonge do
// estilo (ver alfaDoAnel). Longe da luz o mundo aparece bem fraco, não some.
const ESCALAS_ANEL = [1.0, 0.85, 0.7, 0.55];

// Opacidade de cada anel para que N anéis iguais somem `longe`:
// 1 − (1 − a)^N = longe  ⇒  a = 1 − (1 − longe)^(1/N).
function alfaDoAnel(longe) {
    return 1 - Math.pow(1 - longe, 1 / ESCALAS_ANEL.length);
}

// Tremulação das luzes, só no desenho: o raio desenhado oscila até
// TREMOR_PX para mais ou para menos, somando dois senos com fases sorteadas
// por luz. O raio de gameplay (fonte.raio, em luz.js) não muda.
const TREMOR_PX = 1.5;
const TREMOR_ONDA_LENTA = (Math.PI * 2) / 730;
const TREMOR_ONDA_RAPIDA = (Math.PI * 2) / 270;

// Interface (coordenadas de tela 640×360)
const ICONE_X = 8;
const ICONE_Y = 6;
const QUADRO_DO_ICONE = 32;
const TEXTO_OLEO_X = 28;
const TEXTO_OLEO_Y = 6;
const BARRA_Y = 17;
const SEGMENTOS = 10;
const SEGMENTO_LARGURA = 6;
const SEGMENTO_ALTURA = 3;
const SEGMENTO_VAO = 1;
const OPACIDADE_TRILHO = 0.3;
const DICA = "Espaço lamparina · E lanterna · R recomeçar · Esc título";
const DICA_MARGEM = 6;
// a dica some depois de 10 s de jogo, num fade de 1 s
const DICA_DURACAO = 10000;
const DICA_FADE = 1000;
const FAIXA_ALTURA = 48;
const OPACIDADE_FAIXA = 0.75;
// o painel de fase concluída aparece num fade
const FAIXA_FADE = 500;
// o número do óleo pisca na cor de destaque ao pegar uma lata
const OLEO_PISCA_DURACAO = 300;
const OLEO_PISCA_PERIODO = 100;

// Interface de óleo, dica de teclas e mensagem de fase
// concluída, em BitmapText com a fonte "pixel". Não fica no mundo: a
// PlayStage desenha depois da escuridão (ver drawLighting), então nada aqui
// é escurecido. Todo texto tem uma sombra 1 px abaixo, na cor da escuridão,
// para ler sobre qualquer fundo.
class Hud {
    constructor(app) {
        this.largura = app.viewport.width;
        this.altura = app.viewport.height;
        const rotulo = (texto, tamanho = 1) =>
            new BitmapText(0, 0, { font: "pixel", text: texto, size: tamanho });
        this.textoOleo = rotulo("Óleo 0");
        this.dica = rotulo(DICA);
        this.titulo = rotulo("Fase concluída", 2);
        this.subtitulo = rotulo("R para jogar de novo");
        this.oleoMostrado = -1;
        // ms restantes da piscada do óleo e latas já vistas
        this.oleoPiscaRestante = 0;
        this.latasVistas = 0;
        // ms desde o fim da fase (fade do painel)
        this.tempoDoFim = 0;
        // ícone da lata, criado no primeiro desenho (um por id de estilo)
        this.icones = new Map();
    }

    update(dt) {
        this.oleoPiscaRestante = Math.max(0, this.oleoPiscaRestante - dt);
        if (estado.latasPegas > this.latasVistas) {
            this.oleoPiscaRestante = OLEO_PISCA_DURACAO;
        }
        this.latasVistas = estado.latasPegas;
        this.tempoDoFim = estado.fimDeFase ? this.tempoDoFim + dt : 0;
    }

    icone() {
        const id = estiloAtual();
        let sprite = this.icones.get(id);
        if (sprite === undefined) {
            sprite = criarSpriteDaFolha(ICONE_X, ICONE_Y);
            sprite.addAnimation("lata", [QUADRO_DO_ICONE]);
            sprite.setCurrentAnimation("lata");
            this.icones.set(id, sprite);
        }
        return sprite;
    }

    // x inteiro que centraliza o rótulo na tela (evita meio pixel borrado)
    centroX(rotulo) {
        return Math.round((this.largura - rotulo.measureText().width) / 2);
    }

    // Texto com sombra: primeiro 1 px abaixo na cor da escuridão, depois na cor.
    escrever(renderer, rotulo, x, y, cor, sombra, opacidade = 1) {
        rotulo.alpha = opacidade;
        rotulo.fillStyle = sombra;
        rotulo.pos.set(x, y + 1);
        desenharSprite(renderer, rotulo);
        rotulo.fillStyle = cor;
        rotulo.pos.set(x, y);
        desenharSprite(renderer, rotulo);
    }

    desenhar(renderer, tempoDeJogo) {
        const { jogo } = dadosDoEstilo();
        renderer.setGlobalAlpha(1);

        // ícone da lata, quantidade de óleo e a barra embaixo dela
        desenharSprite(renderer, this.icone());
        // inteiro arredondado para cima: só mostra 0 quando acabou de verdade
        const oleo = Math.ceil(estado.oleo);
        if (oleo !== this.oleoMostrado) {
            this.oleoMostrado = oleo;
            this.textoOleo.setText(`Óleo ${oleo}`);
        }
        // lata pega: o número pisca na cor de destaque
        const piscando =
            this.oleoPiscaRestante > 0 && Math.floor(this.oleoPiscaRestante / OLEO_PISCA_PERIODO) % 2 === 0;
        const corOleo = piscando ? jogo.destaque : jogo.texto;
        this.escrever(renderer, this.textoOleo, TEXTO_OLEO_X, TEXTO_OLEO_Y, corOleo, jogo.escuridao);
        this.desenharBarra(renderer, jogo);

        // dica de teclas no rodapé, sumindo depois de um tempo
        const dicaOpacidade = 1 - Math.min(1, Math.max(0, (tempoDeJogo - DICA_DURACAO) / DICA_FADE));
        if (dicaOpacidade > 0) {
            const y = this.altura - DICA_MARGEM - this.dica.measureText().height;
            this.escrever(renderer, this.dica, this.centroX(this.dica), y, jogo.textoFraco, jogo.escuridao, dicaOpacidade);
        }

        if (estado.fimDeFase) {
            const meio = Math.round(this.altura / 2);
            const topo = meio - FAIXA_ALTURA / 2;
            const opacidade = Math.min(1, this.tempoDoFim / FAIXA_FADE);
            pintar(renderer, jogo.escuridao, 0, topo, this.largura, FAIXA_ALTURA, OPACIDADE_FAIXA * opacidade);
            this.escrever(renderer, this.titulo, this.centroX(this.titulo), topo + 6, jogo.destaque, jogo.escuridao, opacidade);
            this.escrever(renderer, this.subtitulo, this.centroX(this.subtitulo), topo + 31, jogo.texto, jogo.escuridao, opacidade);
        }
    }

    // Barra segmentada: cheia em CONFIG.oleoBarraCheia; o último segmento
    // aceso pode estar pela metade.
    desenharBarra(renderer, jogo) {
        const fracao = Math.min(1, Math.max(0, estado.oleo / CONFIG.oleoBarraCheia));
        const cheios = fracao * SEGMENTOS;
        for (let i = 0; i < SEGMENTOS; i++) {
            const x = TEXTO_OLEO_X + i * (SEGMENTO_LARGURA + SEGMENTO_VAO);
            pintar(renderer, jogo.textoFraco, x, BARRA_Y, SEGMENTO_LARGURA, SEGMENTO_ALTURA, OPACIDADE_TRILHO);
            const largura = Math.round(Math.min(1, cheios - i) * SEGMENTO_LARGURA);
            if (largura > 0) {
                pintar(renderer, jogo.destaque, x, BARRA_Y, largura, SEGMENTO_ALTURA);
            }
        }
    }

    destroy() {
        this.textoOleo.destroy();
        this.dica.destroy();
        this.titulo.destroy();
        this.subtitulo.destroy();
        for (const sprite of this.icones.values()) {
            sprite.destroy();
        }
        this.icones.clear();
    }
}

// Fase principal: escuridão, fase 1, interface, reinício e fim de fase.
export class PlayStage extends Stage {
    constructor() {
        super();
        // referências fixas para poder tirar os ouvintes depois
        this.aoApertar = this.aoApertar.bind(this);
        this.aoSoltar = this.aoSoltar.bind(this);
        this.app = null;
        this.hud = null;
        this.carregando = false;
        this.rSegurado = false;
        // área visível de cada Light2d (criada na primeira vez que a luz aparece)
        this.areas = new WeakMap();
        // áreas das luzes deste quadro, na mesma ordem da lista de luzes
        this.areasDoQuadro = [];
        // cor ambiente com a opacidade de cada anel (não mexe em ambientLight)
        this.corAnel = new Color();
        this.alfaAnel = 1;
        // raio original e fases da tremulação de cada Light2d
        this.tremores = new WeakMap();
        // ms desde a entrada no estado (tremulação) e desde o início da fase (dica)
        this.tempo = 0;
        this.tempoDeJogo = 0;
        // morte em andamento: ms até pedir o reinício (-1 = nenhuma)
        this.morteRestante = -1;
        // cortina preta que segura a tela escura da morte até a fase recarregar
        this.cortina = null;
    }

    // roda a cada entrada no estado; recebe a Application
    async onResetEvent(app) {
        this.app = app;
        this.rSegurado = false;
        this.morteRestante = -1;
        aplicarPosEfeitos(app);

        for (const [codigo, acao, travada] of TECLAS) {
            // preventDefault: as teclas do jogo não rolam nem mexem na página
            input.bindKey(codigo, acao, travada, true);
        }
        // R por evento: um toque nunca se perde, mesmo curto
        event.on(event.KEYDOWN, this.aoApertar);
        event.on(event.KEYUP, this.aoSoltar);

        this.hud = new Hud(app);
        await this.carregarFase();
    }

    onDestroyEvent() {
        for (const [codigo] of TECLAS) {
            input.unbindKey(codigo);
        }
        event.off(event.KEYDOWN, this.aoApertar);
        event.off(event.KEYUP, this.aoSoltar);
        this.tirarCortina();
        limparFontes();
        limparBrilhos();
        reiniciar();
        if (this.hud !== null) {
            this.hud.destroy();
            this.hud = null;
        }
    }

    aoApertar(acao) {
        // KEYDOWN se repete com a tecla segurada: age uma vez por toque
        if (acao === "reiniciar" && !this.rSegurado) {
            this.rSegurado = true;
            pedirReinicio();
        } else if (acao === "titulo") {
            // com a transição de fade, pedidos repetidos viram uma troca só
            state.change(state.MENU);
        }
    }

    aoSoltar(acao) {
        if (acao === "reiniciar") {
            this.rSegurado = false;
        }
    }

    // Escuridão do estilo atual.
    aplicarEstilo() {
        const { jogo } = dadosDoEstilo();
        // sem cor ambiente o Light2d não tem o que recortar
        this.ambientLight.parseCSS(jogo.escuridao);
        this.alfaAnel = alfaDoAnel(jogo.escuridaoLonge);
    }

    // Caminho único de (re)início: morte, tecla R e a primeira entrada.
    async carregarFase() {
        this.carregando = true;
        // zera óleo, lanternas, fim de fase e os registros de luzes e brilhos
        limparFontes();
        limparBrilhos();
        reiniciar();
        this.aplicarEstilo();
        this.tempoDeJogo = 0;
        this.morteRestante = -1;
        // level.load limpa o mundo (entidades, luzes, lanternas) e recria a fase
        await level.load(nomeDaFase(FASE), { container: this.app.world, async: true });
        const mapa = level.getCurrentLevel();
        carregarGrade(mapa);
        estado.oleo = mapa.oleoInicial ?? 0;
        // partículas da fase (somem com o próximo level.load)
        const particulas = new Particulas(mapa.cols * mapa.tilewidth, mapa.rows * mapa.tileheight);
        particulas.prepararVagalumes(mapa);
        this.app.world.addChild(particulas, Z_PARTICULAS);
        // a fase entra num fade de preto; a cortina da morte, se houver, sai
        this.tirarCortina();
        this.app.viewport.fadeOut(COR_FADE, FADE_INICIO);
        this.carregando = false;
    }

    // Efeito da morte: tremor, flash e a tela escurecendo; o reinício vem
    // depois de MORTE_ESPERA ms (ver update), uma vez só.
    comecarMorte() {
        const camera = this.app.viewport;
        this.morteRestante = MORTE_ESPERA;
        camera.shake(TREMOR_INTENSIDADE, TREMOR_DURACAO);
        camera.fadeOut(FLASH_DA_MORTE[estiloAtual()], FLASH_DURACAO);
        // persistente: continua escura depois de completa e no reset da
        // câmera (level.load), até carregarFase tirar
        this.cortina = new FadeEffect(camera, { color: COR_FADE, duration: MORTE_ESPERA, direction: "in" });
        this.cortina.isPersistent = true;
        camera.addCameraEffect(this.cortina);
    }

    tirarCortina() {
        if (this.cortina !== null) {
            this.app.viewport.removeCameraEffect(this.cortina);
            this.cortina = null;
        }
    }

    update(dt) {
        const sujo = super.update(dt);
        if (state.isPaused()) {
            return sujo;
        }
        this.tempo += dt;
        this.tempoDeJogo += dt;
        if (this.hud !== null) {
            this.hud.update(dt);
        }
        if (estado.morreu && this.morteRestante < 0 && !this.carregando) {
            this.comecarMorte();
        } else if (this.morteRestante > 0) {
            this.morteRestante -= dt;
            if (this.morteRestante <= 0) {
                this.morteRestante = 0;
                pedirReinicio();
            }
        }
        if (estado.reinicioPedido && !this.carregando) {
            this.carregarFase().catch((erro) => {
                this.carregando = false;
                console.error("Faroleiro: falha ao reiniciar a fase", erro);
            });
        }
        return true;
    }

    // A escuridão é pintada depois do mundo, dentro do passe da câmera.
    drawLighting(renderer, camera, translateX, translateY) {
        this.desenharLuzes(renderer, camera, translateX, translateY);
    }

    // A interface vem depois do passe da câmera, em coordenadas de tela, como
    // o Container faz com filhos "floating": assim os pós-efeitos da câmera
    // (vinheta) não passam por cima dela. Os efeitos da
    // câmera (fades e flash) são pintados de novo no fim, para a cortina
    // cobrir também a escuridão, os brilhos e a interface; a câmera já os
    // pinta antes da escuridão, e por cima dela eles sairiam pela metade.
    draw(renderer, world) {
        super.draw(renderer, world);
        const camera = this.cameras.get("default");
        if (this.hud === null || camera === undefined) {
            return;
        }
        renderer.save();
        renderer.resetTransform();
        renderer.setProjection(camera.screenProjection);
        renderer.setBlendMode("normal");
        this.hud.desenhar(renderer, this.tempoDeJogo);
        camera.drawFX(renderer);
        renderer.setProjection(camera.projectionMatrix);
        renderer.restore();
    }

    // Raio desenhado da luz neste instante (tremulação só visual).
    tremer(luz) {
        let tremor = this.tremores.get(luz);
        if (tremor === undefined) {
            tremor = {
                raio: luz.radiusX,
                faseLenta: Math.random() * Math.PI * 2,
                faseRapida: Math.random() * Math.PI * 2,
            };
            this.tremores.set(luz, tremor);
        }
        // 0.6 + 0.4 = 1: a soma fica entre −TREMOR_PX e +TREMOR_PX
        const onda =
            0.6 * Math.sin(this.tempo * TREMOR_ONDA_LENTA + tremor.faseLenta) +
            0.4 * Math.sin(this.tempo * TREMOR_ONDA_RAPIDA + tremor.faseRapida);
        luz.setRadii(tremor.raio + TREMOR_PX * onda);
    }

    // Substitui o passe de luz do Stage: o recorte na escuridão e o brilho de
    // cada luz param nas paredes (AreaVisivel), em vez de um círculo inteiro.
    // Uma luz fora da camada da câmera (a lamparina apagada fica na camada 0)
    // não entra na lista de _lightsFor e não ilumina nada. Por cima de tudo
    // vêm os brilhos (olhos, chamas), que não são escurecidos.
    desenharLuzes(renderer, camera, translateX, translateY) {
        const ambiente = this.ambientLight;
        if (ambiente.alpha === 0) {
            return;
        }
        renderer.save();
        // mesmo deslocamento e mesma área do Stage#drawLighting do MelonJS:
        // desenha em pixels do mundo, cobrindo a vista com uma margem
        if (translateX !== 0 || translateY !== 0) {
            renderer.translate(-translateX, -translateY);
        }
        const margem = Math.ceil(camera.zoom) / camera.zoom;
        const x = translateX - margem;
        const y = translateY - margem;
        const largura = camera.width / camera.zoom + margem * 2;
        const altura = camera.height / camera.zoom + margem * 2;

        // os raios de cada luz, uma vez por quadro, já com a tremulação
        const luzes = this._lightsFor(camera);
        const areas = this.areasDoQuadro;
        areas.length = 0;
        for (const luz of luzes) {
            let area = this.areas.get(luz);
            if (area === undefined) {
                area = new AreaVisivel();
                this.areas.set(luz, area);
            }
            this.tremer(luz);
            const limites = luz.getBounds();
            area.calcular(limites.centerX, limites.centerY, luz.radiusX);
            areas.push(area);
        }

        // escuridão em anéis: cada anel recorta a união das áreas das luzes
        renderer.setBlendMode("normal");
        for (let i = 0; i < ESCALAS_ANEL.length; i++) {
            for (const area of areas) {
                renderer.setMask(area.poligono(ESCALAS_ANEL[i]), true);
            }
            this.corAnel.copy(ambiente);
            this.corAnel.alpha = ambiente.alpha * this.alfaAnel;
            // save/restore em volta da cor: nos renderizadores de GPU o
            // setColor multiplica a opacidade pela cor anterior, e no Canvas
            // ela fica valendo para o que vem depois (o brilho sairia apagado)
            renderer.save();
            renderer.setColor(this.corAnel);
            renderer.fillRect(x, y, largura, altura);
            renderer.restore();
            renderer.clearMask();
        }

        // brilho de cada luz, recortado pela própria área visível. As luzes
        // têm illuminationOnly e não se desenham no mundo; aqui fazemos o que
        // o Light2d faria (preDraw, drawLight, postDraw), com a máscara posta
        // antes do preDraw para ficar em pixels do mundo.
        for (let i = 0; i < luzes.length; i++) {
            const luz = luzes[i];
            renderer.setMask(areas[i].poligono(1), false);
            luz.preDraw(renderer);
            renderer.drawLight(luz);
            luz.postDraw(renderer);
            renderer.clearMask();
        }
        renderer.setBlendMode("normal");

        // olhos, chamas e a luz da saída, por cima da escuridão
        desenharBrilhos(renderer);
        renderer.restore();
    }
}