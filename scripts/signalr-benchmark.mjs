import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const hubUrl = process.env.SIGNALR_HUB_URL ?? 'http://localhost:5049/hubs/game';
const roomCode = process.env.ROOM_CODE?.trim().toUpperCase();
const tokens = (process.env.SIGNALR_TOKENS ?? '')
  .split(',')
  .map((token) => token.trim())
  .filter(Boolean);
const eventsPerClient = readPositiveInteger(process.env.EVENTS_PER_CLIENT, 30);
const intervalMs = readPositiveInteger(process.env.EVENT_INTERVAL_MS, 50);

if (!roomCode || tokens.length < 2 || tokens.length > 3) {
  console.error('Informe ROOM_CODE e SIGNALR_TOKENS com 2 ou 3 JWTs separados por vírgula.');
  process.exitCode = 1;
} else {
  await runBenchmark();
}

async function runBenchmark() {
  const receivedLatencies = [];
  const roundTripLatencies = [];
  let receivedEvents = 0;
  const connections = tokens.map((token, clientIndex) => {
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    const recordReceived = (event) => {
      receivedEvents += 1;
      if (Number.isFinite(event?.clientSentAtUnixMs)) {
        receivedLatencies.push(Math.max(0, Date.now() - event.clientSentAtUnixMs));
      }
    };
    connection.on('ReceivePlayerMove', recordReceived);
    connection.on('ReceiveChatMessage', recordReceived);
    connection.on('ReceiveLocalPlayerId', () => {});
    connection.on('ReceiveChatHistory', () => {});
    connection.on('ReceivePlayersUpdated', () => {});
    connection.onclose((error) => {
      if (error) console.error(`Cliente ${clientIndex + 1} desconectou:`, error.message);
    });
    return connection;
  });

  try {
    await Promise.all(connections.map((connection) => connection.start()));
    await Promise.all(connections.map((connection) => connection.invoke('JoinRoom', roomCode)));

    const startedAt = Date.now();
    for (let eventIndex = 0; eventIndex < eventsPerClient; eventIndex += 1) {
      await Promise.all(
        connections.map(async (connection, clientIndex) => {
          const request = {
            x: (eventIndex + clientIndex) % 20,
            y: (eventIndex * 2 + clientIndex) % 15,
            direction: ['up', 'right', 'down', 'left'][eventIndex % 4],
            eventId: `move-${clientIndex}-${eventIndex}-${Date.now()}`,
            clientSentAtUnixMs: Date.now(),
          };
          const beforeInvoke = performance.now();
          await connection.invoke('MovePlayer', request);
          roundTripLatencies.push(performance.now() - beforeInvoke);
        }),
      );
      await delay(intervalMs);
    }

    await Promise.all(
      connections.map(async (connection, clientIndex) => {
        const request = {
          message: `Benchmark client ${clientIndex + 1}`,
          eventId: `chat-${clientIndex}-${Date.now()}`,
          clientSentAtUnixMs: Date.now(),
        };
        const beforeInvoke = performance.now();
        await connection.invoke('SendChatMessage', request);
        roundTripLatencies.push(performance.now() - beforeInvoke);
      }),
    );

    await delay(1_000);
    const durationMs = Date.now() - startedAt;
    const sentEvents = connections.length * (eventsPerClient + 1);
    const expectedReceivedEvents =
      connections.length * eventsPerClient * (connections.length - 1) +
      connections.length * connections.length;
    const report = {
      clients: connections.length,
      durationMs,
      sentEvents,
      receivedEvents,
      expectedReceivedEvents,
      eventsPerSecond: round((sentEvents * 1_000) / durationMs),
      roundTripMs: summarize(roundTripLatencies),
      receiverLatencyMs: summarize(receivedLatencies),
      possibleCongestion:
        receivedEvents < expectedReceivedEvents || percentile(roundTripLatencies, 95) > 250,
      congestionHeuristic:
        'true quando há eventos ausentes ou quando o p95 do round-trip supera 250 ms',
      collectedAt: new Date().toISOString(),
    };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await Promise.allSettled(connections.map((connection) => connection.stop()));
  }
}

function summarize(values) {
  if (values.length === 0) return { samples: 0, average: 0, p95: 0, maximum: 0 };
  return {
    samples: values.length,
    average: round(values.reduce((total, value) => total + value, 0) / values.length),
    p95: round(percentile(values, 95)),
    maximum: round(Math.max(...values)),
  };
}

function percentile(values, requestedPercentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const index = Math.ceil((requestedPercentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
