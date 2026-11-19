// Valores globais do jogo (versão 2). Os valores de equilíbrio de cada fase
// ficam em src/fase1/config.js e src/fase2/config.js.

// ?debug na URL liga o modo de teste (src/systems/depuracao.js)
function lerDebug() {
    try {
        return new URLSearchParams(globalThis.location?.search ?? "").has("debug");
    } catch {
        return false;
    }
}

export const CONFIG = {
    // largura da tela do jogo, em pixels
    largura: 640,
    // altura da tela do jogo, em pixels
    altura: 360,
    // lado de um tile, em pixels
    tile: 16,
    // segundos reais por hora de jogo fora dos chefes
    segundosPorHora: 60,
    // segundos reais por hora de jogo na hora dos chefes (23h e 5h)
    segundosHoraChefe: 150,
    // modo de teste: teclas 0 a 6 (src/systems/depuracao.js)
    debug: lerDebug(),
    // ---- protótipo (src/stages/PlayStage.js e src/entities/) ----
    // velocidade do jogador, em pixels por frame
    velocidadeJogador: 1.6,
    // velocidade do rondador (inimigo), em pixels por frame
    velocidadeRondador: 0.9,
    // raio de luz da lamparina do jogador, em pixels
    raioLamparina: 64,
    // raio de luz de uma lanterna fixa, em pixels
    raioLanternaFixa: 56,
    // óleo consumido pela lamparina, em óleo por segundo
    oleoPorSegundo: 1,
    // custo para acender uma lanterna fixa, em óleo
    custoLanternaFixa: 10,
    // óleo recuperado ao pegar uma lata, em óleo
    oleoPorLata: 20,
    // óleo que enche a barra da interface (só visual; o óleo pode passar disso)
    oleoBarraCheia: 60,
    // força do brilho quente das luzes (0 a 1); alto demais lava a arte
    intensidadeLuz: 0.3,
};