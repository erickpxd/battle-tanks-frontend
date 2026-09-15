import { mkdir, writeFile } from 'node:fs/promises';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import mqtt from 'mqtt';

const hubUrl = process.env.SIGNALR_HUB_URL ?? 'http://localhost:5049/hubs/game';
const apiUrl = process.env.API_URL ?? 'http://localhost:5049';
const roomId = process.env.ROOM_CODE?.trim().toUpperCase();
const tokens = (process.env.SIGNALR_TOKENS ?? '')
  .split(',')
  .map((token) => token.trim())
  .filter(Boolean);
const eventCount = Number(process.env.EVENT_COUNT ?? 100);
const timeoutMs = Number(process.env.BENCHMARK_TIMEOUT_MS ?? 15_000);
const allowedCounts = new Set([10, 50, 100, 500]);

if (!roomId || tokens.length < 2) {
  console.error('Informe ROOM_CODE e SIGNALR_TOKENS com dois JWTs separados por vírgula.');
  process.exit(1);
}
if (!allowedCounts.has(eventCount)) {
  console.error('EVENT_COUNT deve ser 10, 50, 100 ou 500.');
  process.exit(1);
}

await Promise.all(
  tokens.slice(0, 2).map((token, index) => ensureRoomMembership(token, index + 1)),
);

const sentAtByEvent = new Map();
const samples = [];
const receivedIds = { MQTT: new Set(), SignalR: new Set() };
const duplicates = { MQTT: 0, SignalR: 0 };
const mqttConfigResponse = await fetch(`${apiUrl}/api/mqtt/config`, {
  headers: { Authorization: `Bearer ${tokens[0]}` },
});
if (!mqttConfigResponse.ok) {
  throw new Error(`Não foi possível obter a configuração MQTT (${mqttConfigResponse.status}).`);
}
const mqttConfig = await mqttConfigResponse.json();
const mqttClient = mqtt.connect(mqttConfig.webSocketUrl, {
  clientId: `battle-tanks-benchmark-${Date.now()}`,
  username: mqttConfig.username,
  password: mqttConfig.password,
  clean: true,
  reconnectPeriod: 1_000,
});

const mqttReady = new Promise((resolve, reject) => {
  mqttClient.once('error', reject);
  mqttClient.once('connect', () => {
    mqttClient.subscribe(`battle-tanks/${roomId}/events/#`, { qos: 1 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

mqttClient.on('message', (_topic, payload) => {
  try {
    const gameEvent = JSON.parse(payload.toString());
    if (gameEvent.roomId === roomId && gameEvent.eventType === 'map.tile-destroyed') {
      record('MQTT', gameEvent.eventType, gameEvent.eventId);
    }
  } catch {
    // Invalid broker payloads are excluded from benchmark measurements.
  }
});

const sender = createConnection(tokens[0]);
const signalRReceiver = createConnection(tokens[1]);
signalRReceiver.on('ReceiveMapTileDestroyed', (event) => {
  record('SignalR', 'map.tile-destroyed', event.eventId);
});

try {
  await Promise.all([mqttReady, sender.start(), signalRReceiver.start()]);
  await Promise.all([
    sender.invoke('JoinRoom', roomId),
    signalRReceiver.invoke('JoinRoom', roomId),
  ]);

  const requests = Array.from({ length: eventCount }, (_, index) => ({
    column: index % 60,
    row: Math.floor(index / 60) % 45,
    eventId: `lab06-${Date.now()}-${index}`,
    clientSentAtUnixMs: Date.now(),
  }));
  for (const request of requests) {
    request.clientSentAtUnixMs = Date.now();
    sentAtByEvent.set(request.eventId, request.clientSentAtUnixMs);
  }

  // Batches cap concurrent invocations so the 500-event case remains controlled.
  for (let index = 0; index < requests.length; index += 25) {
    await Promise.all(
      requests.slice(index, index + 25).map((request) =>
        sender.invoke('DestroyMapTile', request),
      ),
    );
  }

  await waitForResults(timeoutMs);
  const summaries = ['MQTT', 'SignalR'].map((protocol) => summarize(protocol, eventCount));
  const result = {
    generatedAt: new Date().toISOString(),
    roomId,
    eventType: 'map.tile-destroyed',
    eventCount,
    summaries,
    samples,
  };

  const outputDirectory = 'benchmark-results';
  const outputName = `lab06-${new Date().toISOString().replaceAll(':', '-')}`;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(`${outputDirectory}/${outputName}.json`, JSON.stringify(result, null, 2));
  await writeFile(`${outputDirectory}/${outputName}.csv`, toCsv(samples));

  // EVIDÊNCIA LAB 06: tirar screenshot desta saída e usar os arquivos nos gráficos.
  console.table(summaries);
  console.log(`Resultados: ${outputDirectory}/${outputName}.{json,csv}`);
} finally {
  mqttClient.end(true);
  await Promise.allSettled([sender.stop(), signalRReceiver.stop()]);
}

function createConnection(token) {
  return new HubConnectionBuilder()
    .withUrl(hubUrl, { accessTokenFactory: () => token })
    .withAutomaticReconnect([0, 1_000, 2_000])
    .configureLogging(LogLevel.Warning)
    .build();
}

async function ensureRoomMembership(token, playerNumber) {
  const response = await fetch(`${apiUrl}/api/room/join`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomCode: roomId }),
  });
  if (response.ok) {
    return;
  }

  let details = '';
  try {
    const body = await response.json();
    details = body.error ? `: ${body.error}` : '';
  } catch {
    // Keep the status-only diagnostic when the API does not return JSON.
  }
  throw new Error(
    `Jogador ${playerNumber} não pôde entrar na sala ${roomId} (HTTP ${response.status})${details}. ` +
      'Copie novamente o JWT da janela correta ou confira ROOM_CODE.',
  );
}

function record(protocol, eventType, eventId) {
  const sentAt = sentAtByEvent.get(eventId);
  if (sentAt === undefined) return;
  if (receivedIds[protocol].has(eventId)) {
    duplicates[protocol] += 1;
    return;
  }

  receivedIds[protocol].add(eventId);
  const receivedAt = Date.now();
  samples.push({
    protocol,
    eventType,
    eventId,
    sentAt,
    receivedAt,
    latencyMs: receivedAt - sentAt,
    roomId,
  });
}

async function waitForResults(maximumWaitMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maximumWaitMs) {
    if (
      receivedIds.MQTT.size >= eventCount &&
      receivedIds.SignalR.size >= eventCount
    ) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function summarize(protocol, sent) {
  const latencies = samples
    .filter((sample) => sample.protocol === protocol)
    .map((sample) => sample.latencyMs)
    .sort((left, right) => left - right);
  return {
    protocol,
    sent,
    received: latencies.length,
    lost: Math.max(0, sent - latencies.length),
    duplicates: duplicates[protocol],
    minimumLatencyMs: latencies[0] ?? 0,
    averageLatencyMs: round(average(latencies)),
    maximumLatencyMs: latencies.at(-1) ?? 0,
    p95LatencyMs: latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0,
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function toCsv(rows) {
  const header = 'protocol,eventType,eventId,sentAt,receivedAt,latencyMs,roomId';
  return [
    header,
    ...rows.map((row) =>
      [
        row.protocol,
        row.eventType,
        row.eventId,
        row.sentAt,
        row.receivedAt,
        row.latencyMs,
        row.roomId,
      ].join(','),
    ),
  ].join('\n');
}
