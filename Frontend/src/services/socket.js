/* ============================================================
   Scrybe — WebSocket client for live coaching (Scrybe Pulse)
   Connects to /ws/{client_id}, multiplexes inbound messages to
   subscribers, and guards against stale/duplicate connections.
   ============================================================ */

import { WS_BASE } from '../types';

let socket = null;
let clientId = null;
let reconnectTimer = null;
let intentionalClose = false;

const listeners = new Set();
let connectionState = 'idle'; // idle | connecting | open | closed

const subscribers = new Set();

function notifyState() {
  subscribers.forEach((fn) => fn(connectionState));
}

function emit(message) {
  listeners.forEach((fn) => fn(message));
}

function onOpen() {
  connectionState = 'open';
  notifyState();
}

function onMessage(event) {
  try {
    const message = JSON.parse(event.data);
    emit(message);
  } catch {
    // ignore malformed frames
  }
}

function onClose() {
  connectionState = 'closed';
  notifyState();
  if (!intentionalClose) scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!intentionalClose) connect(clientId);
  }, 2500);
}

export function connect(id) {
  if (!id) return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket && connectionState === 'open' && clientId === id) return;

  intentionalClose = false;
  clientId = id;
  if (socket) {
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try { socket.close(); } catch { /* noop */ }
    socket = null;
  }

  connectionState = 'connecting';
  notifyState();

  try {
    socket = new WebSocket(`${WS_BASE()}/ws/${encodeURIComponent(id)}`);
  } catch {
    connectionState = 'closed';
    notifyState();
    return;
  }

  socket.onopen = onOpen;
  socket.onmessage = onMessage;
  socket.onclose = onClose;
  socket.onerror = () => { /* onclose handles recovery */ };
}

export function disconnect() {
  intentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.onclose = null;
    try { socket.close(); } catch { /* noop */ }
    socket = null;
  }
  connectionState = 'closed';
  notifyState();
}

export function send(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    emit({ type: 'ws_error', error: 'No live connection. Frame telemetry is paused.' });
    return false;
  }
  socket.send(JSON.stringify(message));
  return true;
}

export function sendFrame(imageDataUrl) {
  return send({ type: 'frame_analysis', image: imageDataUrl });
}

export function sendTelemetry(telemetry) {
  return send({ type: 'telemetry', data: telemetry });
}

export function sendTranscribe(text) {
  return send({ type: 'transcribe', text });
}

export function sendPing() {
  return send({ type: 'ping' });
}

/* Message bus — subscribe(cb) returns an unsubscribe fn */
export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function onStateChange(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function getConnectionState() {
  return connectionState;
}
