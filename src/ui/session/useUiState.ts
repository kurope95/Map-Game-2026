import { useState } from "react";
import type { BottomTab } from "./types";

function tabs(orderCount: number): { id: BottomTab; label: string }[] {
  return [
    { id: "region", label: "Region" },
    { id: "stockpile", label: "Stockpile" },
    { id: "economy", label: "Economy" },
    { id: "military", label: "Recruitment 🎖" },
    { id: "orders", label: `Orders (${orderCount})` },
    { id: "ai", label: "AI Intel" },
    { id: "war", label: "War Status" },
    { id: "log", label: "Event Log" },
  ];
}

export function useUiState() {
  const [bottomOpen, setBottomOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<BottomTab>("region");
  const [unitDrawerOpen, setUnitDrawerOpen] = useState(true);
  const [globalUnitsOpen, setGlobalUnitsOpen] = useState(false);
  const [stockpileOpen, setStockpileOpen] = useState(false);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [logicMapOpen, setLogicMapOpen] = useState(false);
  const [doctrineOpen, setDoctrineOpen] = useState(false);
  const [showSupplyOverlay, setShowSupplyOverlay] = useState(false);

  return {
    bottomOpen,
    setBottomOpen,
    activeTab,
    setActiveTab,
    unitDrawerOpen,
    setUnitDrawerOpen,
    globalUnitsOpen,
    setGlobalUnitsOpen,
    stockpileOpen,
    setStockpileOpen,
    diplomacyOpen,
    setDiplomacyOpen,
    logicMapOpen,
    setLogicMapOpen,
    doctrineOpen,
    setDoctrineOpen,
    showSupplyOverlay,
    setShowSupplyOverlay,
    tabs,
  };
}
