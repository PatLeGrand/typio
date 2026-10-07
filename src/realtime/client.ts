"use client";

import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(REALTIME_URL, {
  withCredentials: true,
  autoConnect: true,
});
