// Estado da fase em andamento.
export const estado = {
    // óleo atual (fracionário: a lamparina gasta um pouco a cada frame)
    oleo: 0,
    // tiles com lanterna fixa instalada, como "coluna,linha"
    lanternas: new Set(),
    // true depois de pisar na saída: a jogabilidade fica parada
    fimDeFase: false,
    // true quando o Rondador encostou: a jogabilidade fica parada até a
    // PlayStage mostrar o efeito de morte e pedir o reinício
    morreu: false,
    // pedido de reinício (morte ou tecla R), atendido pela PlayStage
    reinicioPedido: false,
    // latas de óleo pegas nesta fase (a interface pisca o óleo a cada nova)
    latasPegas: 0,
    // o jogador da fase atual (o Rondador persegue ele)
    jogador: null,
};

// Volta tudo ao começo da fase. `oleoInicial` vem da propriedade do mapa.
export function reiniciar(oleoInicial = 0) {
    estado.oleo = oleoInicial;
    estado.lanternas.clear();
    estado.fimDeFase = false;
    estado.morreu = false;
    estado.reinicioPedido = false;
    estado.latasPegas = 0;
    estado.jogador = null;
}

// Pede o reinício da fase. Não mexe no mundo aqui: pode ser chamado de dentro
// de um callback de colisão, e a PlayStage faz o reinício no próximo update.
export function pedirReinicio() {
    estado.reinicioPedido = true;
}

// Marca a morte do jogador (o Rondador encostou). Vale uma vez por fase: a
// PlayStage mostra o efeito e pede o reinício depois de um instante.
export function morrer() {
    estado.morreu = true;
}

// true enquanto a jogabilidade está parada (fase concluída ou morte).
export function jogoParado() {
    return estado.fimDeFase || estado.morreu;
}