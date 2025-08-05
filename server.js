// server.js

const WebSocket = require('ws');

// Cria um servidor WebSocket na porta 8080.
const wss = new WebSocket.Server({ port: 8080 });

console.log("Servidor de Truco Online iniciado na porta 8080.");
console.log("Aguardando jogadores se conectarem...");

let jogadores = [];
let gameState = {};

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
        vez: 0, // Índice do jogador da vez
        cartasNaMesa: [],
        valorMao: 1,
        rodadaAtual: 1,
        resultadosRodada: [], // 0 para jogador 1, 1 para jogador 2
    };

    // Dar cartas
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
        const estadoPessoal = JSON.parse(JSON.stringify(estadoParaCadaJogador));
        // Esconde as cartas do oponente
        const oponenteIndex = gameState.jogadores.findIndex(j => j.id !== jogador.id);
        if (oponenteIndex !== -1) {
            estadoPessoal.payload.jogadores[oponenteIndex].cartas = ['verso', 'verso', 'verso'];
        }
        jogador.ws.send(JSON.stringify(estadoPessoal));
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
            if (jogadorIndex !== gameState.vez) return; // Não é a vez dele

            const cartaJogada = data.payload.carta;
            const maoDoJogador = gameState.jogadores[jogadorIndex].cartas;
            
            // Remove a carta da mão do jogador
            const indexCarta = maoDoJogador.findIndex(c => c.valor === cartaJogada.valor && c.naipe === cartaJogada.naipe);
            if (indexCarta > -1) {
                maoDoJogador.splice(indexCarta, 1);
            }

            gameState.cartasNaMesa.push({ jogadorIndex, carta: cartaJogada });

            // Troca a vez
            gameState.vez = (gameState.vez + 1) % 2;
            
            // Se ambos jogaram na rodada
            if (gameState.cartasNaMesa.length === 2) {
                // Lógica para determinar vencedor da rodada (simplificada)
                // TODO: Implementar lógica de força das cartas e manilhas
                gameState.vez = (gameState.vez + 1) % 2; // Vencedor começa a próxima
                gameState.cartasNaMesa = [];
                gameState.rodadaAtual++;
            }
            
            broadcastState();

             // Se a mão acabou
             if (gameState.jogadores[0].cartas.length === 0) {
                 // TODO: Lógica de pontuação da mão
                 console.log("Mão finalizada! Iniciando próxima...");
                 // Inicia nova mão (simplificado)
                 setTimeout(iniciarJogo, 3000);
             }
        }
    });

    ws.on('close', () => {
        console.log('Jogador desconectado.');
        jogadores = jogadores.filter(j => j.ws !== ws);
        // TODO: Lógica para resetar o jogo se um jogador sair
    });
});

// --- Funções de Lógica do Truco ---

function criarBaralho() {
    const naipes = ['Ouros', 'Espadas', 'Copas', 'Paus'];
    const valores = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
    const baralho = [];
    for (const naipe of naipes) {
        for (const valor of valores) {
            baralho.push({ valor, naipe });
        }
    }
    return baralho;
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
        ouros: { valor: valorManilha, naipe: 'Ouros' }, // Zap
        espadas: { valor: valorManilha, naipe: 'Espadas' }, // Espadilha
        copas: { valor: valorManilha, naipe: 'Copas' }, // Copas
        paus: { valor: valorManilha, naipe: 'Paus' }, // Pica-fumo (Gato)
    };
}