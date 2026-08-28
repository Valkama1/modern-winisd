import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Driver } from "../types";

export function useDriverDatabase() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [browserCallback, setBrowserCallback] = useState<((d: Driver) => void) | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  const refreshDrivers = async () => {
    try {
      const dbDrivers: Driver[] = await invoke("get_drivers");
      setDrivers(dbDrivers);
    } catch (err) {
      console.error("Failed to fetch drivers:", err);
    }
  };

  useEffect(() => {
    refreshDrivers();
  }, []);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const search = searchQuery.toLowerCase();
      return (
        d.manufacturer.toLowerCase().includes(search) ||
        d.model.toLowerCase().includes(search)
      );
    });
  }, [drivers, searchQuery]);

  const openDriverBrowser = (onSelect: (d: Driver) => void) => {
    setBrowserCallback(() => onSelect);
    setShowBrowser(true);
  };

  return {
    drivers, setDrivers, searchQuery, setSearchQuery, filteredDrivers,
    showBrowser, setShowBrowser, showAddForm, setShowAddForm,
    browserCallback, setBrowserCallback, editingDriverId, setEditingDriverId,
    openDriverBrowser, refreshDrivers,
  };
}
