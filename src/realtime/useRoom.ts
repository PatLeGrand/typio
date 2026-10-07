"use client";

import { useEffect, useState, useCallback } from "react";
import { socket } from "./client";
import type {
  RoomState,
  RoomErrorCode,
  RoomConfigPatch,
  JoinPayload,
} from "./protocol";

export function useRoom() {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<RoomErrorCode | null>(null);

  useEffect(() => {
    socket.connect();

    const onState = (newState: RoomState) => {
      setState(newState);
      setError(null);
    };

    const onError = (err: RoomErrorCode) => {
      setError(err);
    };

    socket.on("room:state", onState);
    socket.on("room:error", onError);

    return () => {
      socket.off("room:state", onState);
      socket.off("room:error", onError);
    };
  }, []);

  const create = useCallback((config?: RoomConfigPatch) => {
    return new Promise<{ code: string }>((resolve, reject) => {
      socket.emit("room:create", config, (res) => {
        if (res.ok) {
          resolve(res.data);
        } else {
          setError(res.error);
          reject(new Error(res.error));
        }
      });
    });
  }, []);

  const join = useCallback((payload: JoinPayload) => {
    return new Promise<{ code: string }>((resolve, reject) => {
      socket.emit("room:join", payload, (res) => {
        if (res.ok) {
          resolve(res.data);
        } else {
          setError(res.error);
          reject(new Error(res.error));
        }
      });
    });
  }, []);

  const updateConfig = useCallback((patch: RoomConfigPatch) => {
    return new Promise<void>((resolve, reject) => {
      socket.emit("room:updateConfig", patch, (res) => {
        if (res.ok) {
          resolve();
        } else {
          setError(res.error);
          reject(new Error(res.error));
        }
      });
    });
  }, []);

  const leave = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      socket.emit("room:leave", (res) => {
        if (res.ok) {
          setState(null);
          resolve();
        } else {
          setError(res.error);
          reject(new Error(res.error));
        }
      });
    });
  }, []);

  return { state, error, create, join, updateConfig, leave };
}
