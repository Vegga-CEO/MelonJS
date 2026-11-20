import { ORDEM_DOS_ESTILOS } from "./estilos.js";
import { imagem, nomeDaFase } from "./systems/estilo.js";

// Assets do protótipo para o loader.preload: o mapa da fase 1
// (tools/gerar-fase1.mjs), as imagens geradas por tools/ e a fonte de pixel.
// Cada imagem se chama "<base>-<estilo>" (ver imagem() em
// src/systems/estilo.js) e fica em public/data/img/.

// imagens que existem uma vez por estilo
const IMAGENS_POR_TEMA = ["tileset", "sprites", "fx", "titulo", "logo"];

function montarLista() {
    const lista = [];
    for (const tema of ORDEM_DOS_ESTILOS) {
        // o mapa acha o tileset embutido pelo nome do arquivo sem extensão
        // ("tileset-mare"), então o nome da imagem precisa ser esse
        const fase = nomeDaFase("fase1", tema);
        lista.push({ name: fase, type: "tmx", src: `data/map/${fase}.tmj` });
        for (const base of IMAGENS_POR_TEMA) {
            const nome = imagem(base, tema);
            lista.push({ name: nome, type: "image", src: `data/img/${nome}.png` });
        }
    }
    // fonte de pixel (BMFont): descritor e página com o mesmo nome
    lista.push(
        { name: "pixel", type: "binary", src: "data/fnt/pixel.fnt" },
        { name: "pixel", type: "image", src: "data/fnt/pixel.png" },
    );
    return lista;
}

export const RECURSOS = montarLista();
