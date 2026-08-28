import { useMemo, useState } from "react";
import { EqFilter, RoomConfig, CabinConfig } from "../types";
import { loadSavedSession } from "../lib/session";

export function useSignalProcessing() {
  const savedSession = useMemo(() => loadSavedSession(), []);

  const [filters, setFilters] = useState<EqFilter[]>(() => savedSession?.filters || []);

  const [roomConfig, setRoomConfig] = useState<RoomConfig>(() => savedSession?.roomConfig || {
    enabled: false,
    length: 5.0, width: 4.0, height: 2.5,
    speakers: [{ x: 0.5, y: 0.5, z: 0.9 }],
    listenerX: 2.0, listenerY: 3.5, listenerZ: 1.2,
    absorption: 0.15,
  });
  const [cabinConfig, setCabinConfig] = useState<CabinConfig>(() => savedSession?.cabinConfig || {
    enabled: false,
    fCabin: 60.0,
  });

  return { filters, setFilters, roomConfig, setRoomConfig, cabinConfig, setCabinConfig };
}
