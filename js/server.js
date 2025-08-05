// server.js - Versão Final com Express

const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// Esta linha mágica faz o servidor entregar os arquivos da pasta (como o index.html)
app.use(express.static(path.join(__dirname)));

// Agora, o WebSocket Server vai "pegar carona" no nosso servidor Express
const wss = new WebSocket.Server({ server });

console.log("Servidor de Truco Online iniciado.");

let jogadores = [];
let gameState = {};

// ... TODA A LÓGICA DO JOGO DE TRUCO CONTINUA IGUAL AQUI ...
// (As funções iniciarJogo, broadcastState, criarBaralho, etc. não mudam)

function iniciarJogo() {
    console.log("Dois jogadores conectados. Iniciando o jogo!");
    
    const baralho = criarBaralho();
    embaralhar(baralho);

    const vira = baralho.pop();
    const manilhas = definirManilhas(vira);

    gameState = {
        jogadores: [
            { id: jogadores[0].id, nome: `Jogador 1`, cartas: [], pontos: 0 },
            { id: jogadores[1].id, nome: `Jogador 2`, cartas: [], pontos: 0 }
        ],
        pontosNos: 0,
        pontosEles: 0,
        vira: vira,
        manilhas: manilhas,
        vez: 0, 
        cartasNaMesa: [],
        valorMao: 1,
        rodadaAtual: 1,
        resultadosRodada: [],
    };

    gameState.jogadores[0].cartas = baralho.splice(0, 3);
    gameState.jogadores[1].cartas = baralho.splice(0, 3);

    broadcastState();
}

function broadcastState() {
    const estadoParaCadaJogador = {
        type: 'ATUALIZAR_ESTADO',
        payload: gameState,
    };
    jogadores.forEach(jogador => {
        if (jogador.ws.readyState === WebSocket.OPEN) {
            const estadoPessoal = JSON.parse(JSON.stringify(estadoParaCadaJogador));
            const oponenteIndex = gameState.jogadores.findIndex(j => j.id !== jogador.id);
            if (oponenteIndex !== -1 && estadoPessoal.payload.jogadores[oponenteIndex]) {
                estadoPessoal.payload.jogadores[oponenteIndex].cartas = ['verso', 'verso', 'verso'];
            }
            jogador.ws.send(JSON.stringify(estadoPessoal));
        }
    });
}

wss.on('connection', ws => {
    if (jogadores.length >= 2) {
        ws.send(JSON.stringify({ type: 'ERRO', payload: 'Sala cheia.' }));
        ws.close();
        return;
    }

    const jogadorId = Date.now();
    jogadores.push({ id: jogadorId, ws: ws });
    console.log(`Jogador ${jogadores.length} conectado.`);

    if (jogadores.length === 2) {
        iniciarJogo();
    }

    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'JOGAR_CARTA') {
            const jogadorIndex = gameState.jogadores.findIndex(j => j.id === jogadorId);
            if (jogadorIndex !== gameState.vez) return;

            const cartaJogada = data.payload.carta;
            const maoDoJogador = gameState.jogadores[jogadorIndex].cartas;
            
            const indexCarta = maoDoJogador.findIndex(c => c.valor === cartaJogada.valor && c.naipe === cartaJogada.naipe);
            if (indexCarta > -1) {
                maoDoJogador.splice(indexCarta, 1);
            }

            gameState.cartasNaMesa.push({ jogadorIndex, carta: cartaJogada });
            gameState.vez = (gameState.vez + 1) % 2;
            
            if (gameState.cartasNaMesa.length === 2) {
                // TODO: Lógica para determinar vencedor da rodada
                gameState.cartasNaMesa = [];
                gameState.rodadaAtual++;
            }
            
            broadcastState();

             if (gameState.jogadores.every(j => j.cartas.length === 0)) {
                 console.log("Mão finalizada! Iniciando próxima...");
                 setTimeout(iniciarJogo, 3000);
             }
        }
    });

    ws.on('close', () => {
        console.log('Jogador desconectado.');
        jogadores = jogadores.filter(j => j.ws !== ws);
    });
});

function criarBaralho() {
    const naipes = ['Ouros', 'Espadas', 'Copas', 'Paus'];
    const valores = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
    return valores.flatMap(valor => naipes.map(naipe => ({ valor, naipe })));
}

function embaralhar(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function definirManilhas(vira) {
    const ordemValores = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
    const indexVira = ordemValores.indexOf(vira.valor);
    const valorManilha = ordemValores[(indexVira + 1) % ordemValores.length];
    return {
        ouros: { valor: valorManilha, naipe: 'Ouros' },
        espadas: { valor: valorManilha, naipe: 'Espadas' },
        copas: { valor: valorManilha, naipe: 'Copas' },
        paus: { valor: valorManilha, naipe: 'Paus' },
    };
}

// O Render fornece a porta correta através de uma variável de ambiente
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor web e WebSocket rodando na porta ${PORT}`);
});
