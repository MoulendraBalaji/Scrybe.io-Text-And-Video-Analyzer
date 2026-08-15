/* ============================================================
   useSocket — React binding over services/socket.js
   Provides connection state + latest message, cleans up on unmount.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { connect, disconnect, subscribe, onStateChange, getConnectionState } from '../services/socket';

export function useSocket(clientId) {
  const [state, setState] = useState(getConnectionState());
  const [lastMessage, setLastMessage] = useState(null);
  const [connected, setConnected] = useState(getConnectionState() === 'open');
  const lastMessageRef = useRef(null);

  useEffect(() => {
    const offState = onStateChange(() => {
      const s = getConnectionState();
      setState(s);
      setConnected(s === 'open');
    });
    return offState;
  }, []);

  useEffect(() => {
    const offMsg = subscribe((message) => {
      lastMessageRef.current = message;
      setLastMessage(message);
    });
    return offMsg;
  }, []);

  useEffect(() => {
    if (clientId) connect(clientId);
    return () => disconnect();
  }, [clientId]);

  return { state, connected, lastMessage, lastMessageRef };
}
