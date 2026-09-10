# Laboratório 05 — Atividade 3 — Erick

## Sincronização multiplayer

### Movimento

1. O canvas altera e anima o tanque local.
2. `GameService.sendPlayerMove` envia posição, direção, ID do evento e timestamp.
3. `GameHub.MovePlayer` valida coordenadas/direção e atualiza o estado da sala.
4. O hub usa `OthersInGroup`, evitando eco para o emissor.
5. Outros clientes recebem `ReceivePlayerMove`.
6. O serviço despacha `Player Moved`; reducer e selectors atualizam o canvas.

### Chat

1. A sala envia uma mensagem normalizada, limitada a 250 caracteres.
2. O hub obtém ID/nome exclusivamente das claims JWT.
3. A mensagem é gravada no repositório de chat existente.
4. `ReceiveChatMessage` é enviado a todos, inclusive ao emissor.
5. O reducer acrescenta a confirmação do servidor uma única vez.
6. Ao entrar/reconectar, `ReceiveChatHistory` restaura o histórico.

### Mapa

A destruição existente de partes do mapa foi integrada por `DestroyMapTile` e `ReceiveMapTileDestroyed`. O evento não volta ao emissor, pois ele já aplicou a destruição localmente. Os outros clientes recebem a action NgRx e o canvas aplica a alteração.

### Power-ups

Não foi encontrado modelo, store, componente ou mecânica de power-up no projeto. Nenhum sistema artificial foi criado para evitar uma funcionalidade isolada e sem integração com o jogo atual.

## Estado e reconexão

- Cada sala é um grupo SignalR separado.
- O backend considera múltiplas conexões do mesmo jogador.
- A lista de jogadores é republicada em entradas e saídas.
- A reconexão automática reinscreve o cliente na sala.
- Handlers são registrados somente na criação da conexão.
- Movimento e mapa usam `OthersInGroup`; chat usa o grupo inteiro.

## Benchmark reproduzível

O script `scripts/signalr-benchmark.mjs` cria 2 ou 3 clientes reais, entra com todos na mesma sala, envia movimentos e uma mensagem por cliente e imprime JSON.

Métricas coletadas:

- eventos enviados, recebidos e esperados;
- duração e eventos por segundo;
- média, p95 e máximo do round-trip dos `invoke`;
- média, p95 e máximo da latência observada pelos receptores;
- sinal heurístico de congestionamento.

O sinal `possibleCongestion` fica verdadeiro se houver eventos ausentes ou se o p95 do round-trip passar de 250 ms. É um alerta operacional simples, não uma prova isolada de congestionamento de rede.

### Pré-requisitos

1. Backend e frontend executando.
2. Uma sala criada pela API REST.
3. Dois ou três usuários registrados e associados à mesma sala.
4. Um JWT válido de cada usuário.

### Execução

```bash
SIGNALR_TOKENS='jwt-cliente-1,jwt-cliente-2,jwt-cliente-3' \
ROOM_CODE='ABCD-1234' \
EVENTS_PER_CLIENT=30 \
EVENT_INTERVAL_MS=50 \
npm run benchmark:signalr
```

Para outro endereço:

```bash
SIGNALR_HUB_URL='https://servidor/hubs/game' \
SIGNALR_TOKENS='jwt-1,jwt-2' \
ROOM_CODE='ABCD-1234' \
npm run benchmark:signalr
```

Não salve tokens no repositório. Copie o JSON do terminal para o relatório somente após uma execução real.

## Resultado neste ambiente

O benchmark foi executado em localhost em 10/08/2026, com o backend ASP.NET Core e três clientes Node reais. Foram usados JWTs temporários assinados localmente com a chave de desenvolvimento do projeto. Portanto, a medição cobre autenticação do hub, transporte SignalR, grupos, broadcast e ACK, mas não mede cadastro/login REST, banco de dados nem rede externa.

```json
{
  "clients": 3,
  "durationMs": 2597,
  "sentEvents": 93,
  "receivedEvents": 189,
  "expectedReceivedEvents": 189,
  "eventsPerSecond": 35.81,
  "roundTripMs": {
    "samples": 93,
    "average": 2.24,
    "p95": 2.94,
    "maximum": 3.15
  },
  "receiverLatencyMs": {
    "samples": 189,
    "average": 1.98,
    "p95": 3,
    "maximum": 4
  },
  "possibleCongestion": false,
  "collectedAt": "2026-08-10T07:11:08.459Z"
}
```

Todos os 189 eventos esperados foram recebidos. Nessas condições locais não houve sinal heurístico de congestionamento. Esses números não devem ser generalizados para produção; o comando documentado deve ser repetido no ambiente de entrega com usuários/JWTs reais.

## Procedimento manual de aceitação

1. Abrir 2–3 perfis/janelas anônimas.
2. Autenticar usuários diferentes e entrar no mesmo código de sala.
3. Confirmar a lista idêntica de jogadores.
4. Mover cada tanque e verificar os demais canvas sem duplicação local.
5. Enviar chat de cada janela e verificar uma ocorrência por mensagem.
6. Desconectar/recarregar uma janela e confirmar reconexão e histórico.
7. Executar o script e guardar o JSON real.

## Capturas necessárias

[CAPTURA DE TELA 1 — Dois ou três clientes sincronizados]

Mostrar 2–3 janelas na mesma sala, com os mesmos jogadores e indicador “Conectado”.

[CAPTURA DE TELA 2 — Movimento remoto]

Mostrar posições distintas dos tanques em dois canvas após movimento e a action correspondente no Redux DevTools.

[CAPTURA DE TELA 3 — Chat multiplayer]

Mostrar uma mensagem enviada em uma janela aparecendo uma única vez em todas as janelas.

[CAPTURA DE TELA 4 — Reconexão]

Mostrar o cliente recuperado após interrupção temporária, novamente na sala e com o histórico de chat.

[CAPTURA DE TELA 5 — Resultado real do benchmark]

Mostrar o comando com 2–3 clientes e o JSON completo, incluindo contagens, p95, máximo e `possibleCongestion`. Oculte os JWTs da captura.

## Referências oficiais

- [ASP.NET Core SignalR JavaScript client](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-8.0)
- [Use hubs in ASP.NET Core SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/hubs?view=aspnetcore-8.0)
- [NgRx Store](https://ngrx.io/guide/store)
- [NgRx selectors](https://ngrx.io/guide/store/selectors)
