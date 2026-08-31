# Battle City Frontend

Frontend standalone em Angular 22 para uma versão inicial multiplayer inspirada em jogos de
tanques. A aplicação oferece sala de espera, chat, visualização dos jogadores e um campo de batalha
em Canvas 2D.

> O backend não faz parte deste repositório. Para testar a comunicação em tempo real entre
> navegadores, é necessário disponibilizar um servidor WebSocket compatível em
> `ws://localhost:8080/ws`.

Sem o servidor, a interface continua disponível e o tanque local pode ser movimentado. Lista de
jogadores, chat e sincronização entre navegadores dependem do backend.

## Requisitos

- Angular e Angular CLI `22.0.6`
- RxJS `7.8.2`
- TypeScript `6.0.3`
- Node.js `^22.22.3`, `^24.15.0` ou `>=26.0.0`
- npm `11.16.0`

## Instalação e execução

Restaure exatamente as dependências do lockfile:

```bash
npm ci
```

Inicie o servidor de desenvolvimento:

```bash
npm start
```

A aplicação estará disponível em `http://localhost:4200/`.

Build de produção:

```bash
npm run build
```

Testes unitários em execução única:

```bash
npm test -- --watch=false
```

## Configuração WebSocket

A URL está centralizada em `src/app/core/config/game.config.ts`:

```text
ws://localhost:8080/ws
```

Em uma implantação HTTPS, utilize um endpoint `wss://` para evitar bloqueio de conteúdo misto.

O cliente não realiza reconexão automática infinita. Se a conexão falhar, a sala mostra um erro e
oferece uma tentativa manual. O servidor deve aceitar e enviar objetos JSON com as propriedades
`type` e `payload`.

## Protocolo esperado

| Evento               | Direção            | Finalidade                  |
| -------------------- | ------------------ | --------------------------- |
| `player:join`        | Cliente → servidor | Registrar entrada           |
| `player:list`        | Servidor → cliente | Atualizar jogadores         |
| `player:move`        | Ambas              | Sincronizar posição         |
| `map:tile-destroyed` | Ambas              | Sincronizar bloco destruído |
| `chat:send`          | Cliente → servidor | Enviar mensagem             |
| `chat:message`       | Servidor → cliente | Receber mensagem            |
| `game:state`         | Servidor → cliente | Atualizar estado completo   |
| `error`              | Servidor → cliente | Informar erro               |

O cliente também reconhece `connection:success`, `player:joined` e `player:left`. Uma resposta
`connection:success` pode informar `id` ou `playerId`; esse identificador é usado para evitar
desenhar o jogador local duas vezes.

### Entrada na sala

```json
{
  "type": "player:join",
  "payload": {
    "name": "Erick"
  }
}
```

Lista retornada pelo servidor:

```json
{
  "type": "player:list",
  "payload": [
    {
      "id": "player-1",
      "name": "Erick",
      "position": { "x": 100, "y": 100, "direction": "up" }
    }
  ]
}
```

### Movimento

Cliente ou servidor:

```json
{
  "type": "player:move",
  "payload": {
    "x": 100,
    "y": 80,
    "direction": "right"
  }
}
```

Ao enviar posições de outros jogadores ao cliente, o servidor deve incluir o jogador completo:

```json
{
  "type": "player:move",
  "payload": {
    "id": "player-2",
    "name": "Ana",
    "position": { "x": 220, "y": 160, "direction": "left" }
  }
}
```

### Chat

Envio do cliente:

```json
{
  "type": "chat:send",
  "payload": {
    "message": "Olá!"
  }
}
```

Mensagem confirmada pelo servidor:

```json
{
  "type": "chat:message",
  "payload": {
    "id": "message-1",
    "playerId": "player-1",
    "playerName": "Erick",
    "message": "Olá!",
    "timestamp": "2026-07-17T19:00:00.000Z"
  }
}
```

### Estado completo do jogo

```json
{
  "type": "game:state",
  "payload": {
    "players": [
      {
        "id": "player-1",
        "name": "Erick",
        "position": { "x": 100, "y": 100, "direction": "up" }
      }
    ]
  }
}
```

### Erro do servidor

```json
{
  "type": "error",
  "payload": {
    "message": "A sala está cheia."
  }
}
```

Mensagens sem um tipo conhecido ou sem `payload` são ignoradas. Os payloads conhecidos passam por
validação básica antes de atualizar a interface.

## Controles

| Ação     | Teclas              |
| -------- | ------------------- |
| Cima     | `W` ou `ArrowUp`    |
| Baixo    | `S` ou `ArrowDown`  |
| Esquerda | `A` ou `ArrowLeft`  |
| Direita  | `D` ou `ArrowRight` |
| Disparar | `Espaço`            |

O movimento ocorre célula a célula com animação suave e permanece limitado à grade de 20 × 15.
O cliente transmite no máximo 20 atualizações de posição por segundo e não envia novos eventos
quando o tanque está parado.

## Funcionalidades

- arquitetura standalone com rotas lazy;
- conexão única com RxJS `WebSocketSubject`;
- estado de conexão e tentativa manual após falha;
- nome temporário preservado em `sessionStorage`;
- lista de jogadores derivada do servidor;
- chat limitado a 250 caracteres, sem inserção de HTML;
- Canvas 2D responsivo e ajustado ao `devicePixelRatio`;
- mapa JSON com paredes destrutíveis e indestrutíveis;
- movimento e disparos animados por `requestAnimationFrame`;
- destruição parcial de paredes, explosões e estado de mapa baseado em Angular Signals;
- renderização do tanque local e dos jogadores remotos;
- suporte aos eventos de posição e ao estado completo da partida;
- testes sem abertura de conexão WebSocket real.

## Limitações atuais

- não há servidor WebSocket neste repositório;
- não há confirmação real de entrada, persistência de sala ou autenticação;
- o protocolo ainda precisa ser alinhado com a implementação do backend;
- vidas e pontuação não foram implementados;
- não há reconexão automática nem restauração de partida após perda de conexão;
- a identificação local depende de o servidor retornar `id` ou `playerId` em
  `connection:success`.
