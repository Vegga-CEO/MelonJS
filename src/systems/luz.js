import { fracaoAteParede } from "./caminho.js";

// Regra de iluminação de gameplay. O Light2d só desenha; quem decide se algo
// está iluminado é este módulo.
//
// Uma fonte é qualquer objeto com { x, y, raio, acesa } (podem ser getters):
// x, y é o centro da luz em pixels do mundo.
//
// A checagem de parede caminha pela grade de tiles da camada "paredes"
// (DDA de Amanatides-Woo: fracaoAteParede, em caminho.js, a mesma que o
// desenho da luz usa em visibilidade.js) em vez de usar adapter.raycast: o
// raycast do MelonJS devolve só o acerto mais próximo, e o corpo do jogador
// ou do próprio Rondador no caminho seria esse acerto. A grade não tem esse
// problema, não depende do broadphase já montado e coincide com os
// retângulos da camada "collision" (os dois saem do mesmo desenho do mapa).

const fontes = new Set();

// Registra uma fonte de luz e devolve a própria fonte.
export function registrarFonte(fonte) {
    fontes.add(fonte);
    return fonte;
}

// Tira uma fonte do registro.
export function removerFonte(fonte) {
    fontes.delete(fonte);
}

// Esvazia o registro (fim ou reinício da fase).
export function limparFontes() {
    fontes.clear();
}

// Quantidade de fontes registradas (usada para conferir vazamentos).
export function totalDeFontes() {
    return fontes.size;
}

// true se nenhum tile de parede fica entre (x0, y0) e (x1, y1).
function linhaLivre(x0, y0, x1, y1) {
    return fracaoAteParede(x0, y0, x1, y1) === Infinity;
}

// Um ponto { x, y } está iluminado se alguma fonte acesa está a menos de
// `raio` dele e nenhuma parede fica entre a fonte e o ponto.
export function estaIluminado(ponto) {
    for (const fonte of fontes) {
        if (!fonte.acesa) {
            continue;
        }
        const dx = ponto.x - fonte.x;
        const dy = ponto.y - fonte.y;
        if (dx * dx + dy * dy >= fonte.raio * fonte.raio) {
            continue;
        }
        if (linhaLivre(fonte.x, fonte.y, ponto.x, ponto.y)) {
            return true;
        }
    }
    return false;
}