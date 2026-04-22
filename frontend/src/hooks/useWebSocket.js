import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api';
const SOCKET_URL = API_URL.replace('/api', '');

export const useWebSocket = (eventMap) => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        socketRef.current = io(SOCKET_URL, {
            reconnectionAttempts: 5,
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            setIsConnected(false);
        });

        if (eventMap) {
            Object.entries(eventMap).forEach(([event, handler]) => {
                socketRef.current.on(event, handler);
            });
        }

        return () => {
            if (socketRef.current) {
                if (eventMap) {
                    Object.entries(eventMap).forEach(([event, handler]) => {
                        socketRef.current.off(event, handler);
                    });
                }
                socketRef.current.disconnect();
            }
        };
    }, []); // Empty dependency array to ensure single connection

    return { socket: socketRef.current, isConnected };
};
