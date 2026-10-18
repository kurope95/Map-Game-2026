import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { CountryId, GameState } from "../../game/state/types";
import { parseSaveSlot, SAVE_SLOT_PREFIX, sortSaveSlots } from "./saveSlots";
import type { SaveLoadMode, SaveSlotEnvelope, SaveSlotEntry } from "./types";
import type { AddToast } from "./useToasts";

interface SaveSlotsOptions {
  gameState: GameState;
  playerCountryId: CountryId;
  addToast: AddToast;
  onLoad: (nextState: GameState, label: string) => void;
}

export function useSaveSlots({ gameState, playerCountryId, addToast, onLoad }: SaveSlotsOptions) {
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);
  const [saveLoadMode, setSaveLoadMode] = useState<SaveLoadMode>("save");
  const [saveSlots, setSaveSlots] = useState<SaveSlotEntry[]>([]);
  const [selectedSaveSlotName, setSelectedSaveSlotName] = useState<string | null>(null);
  const [saveSlotInput, setSaveSlotInput] = useState("");

  const selectedSaveSlot = selectedSaveSlotName ? saveSlots.find((slot) => slot.name === selectedSaveSlotName) : undefined;

  const refreshSaveSlots = useCallback(() => {
    const slots: SaveSlotEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SAVE_SLOT_PREFIX)) continue;
      const slotName = key.slice(SAVE_SLOT_PREFIX.length);
      if (!slotName) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const entry = parseSaveSlot(slotName, raw, playerCountryId);
      if (entry) slots.push(entry);
    }
    const sorted = sortSaveSlots(slots);
    setSaveSlots(sorted);
    setSelectedSaveSlotName((previous) => {
      if (previous && sorted.some((slot) => slot.name === previous)) {
        return previous;
      }
      return sorted[0]?.name ?? null;
    });
  }, [playerCountryId]);

  useEffect(() => {
    if (saveLoadOpen) {
      refreshSaveSlots();
    }
  }, [saveLoadOpen, refreshSaveSlots]);

  function openSaveLoadPanel(mode: SaveLoadMode) {
    setSaveLoadMode(mode);
    setSaveSlotInput(`${playerCountryId.toLowerCase()}-t${gameState.turn}`);
    refreshSaveSlots();
    setSaveLoadOpen(true);
  }

  function saveToSlot(slotNameInput: string) {
    const slotName = slotNameInput.trim();
    if (!slotName) {
      addToast("Enter a slot name first", "warning");
      return;
    }
    try {
      const envelope: SaveSlotEnvelope = {
        savedAt: new Date().toISOString(),
        turn: gameState.turn,
        countryId: playerCountryId,
        state: gameState,
      };
      localStorage.setItem(`${SAVE_SLOT_PREFIX}${slotName}`, JSON.stringify(envelope));
      // Keep legacy quick-save key for backward compatibility.
      localStorage.setItem("mapgame_save", JSON.stringify(gameState));
      setSelectedSaveSlotName(slotName);
      setSaveSlotInput(slotName);
      refreshSaveSlots();
      addToast(`Saved to slot: ${slotName}`, "success");
    } catch {
      addToast("Save failed", "danger");
    }
  }

  function handleSaveGame() {
    openSaveLoadPanel("save");
  }

  function handleLoadGame() {
    openSaveLoadPanel("load");
  }

  function handleLoadSelectedSlot() {
    const selected = saveSlots.find((slot) => slot.name === selectedSaveSlotName);
    if (!selected) {
      addToast("Select a save slot first", "warning");
      return;
    }
    onLoad(selected.envelope.state, `Loaded slot: ${selected.name}`);
  }

  function handleLoadLegacyQuickSave() {
    try {
      const fallback = localStorage.getItem("mapgame_save") ?? localStorage.getItem("mapgame_autosave");
      if (!fallback) {
        addToast("No legacy save found", "warning");
        return;
      }
      onLoad(JSON.parse(fallback) as GameState, "Loaded legacy quick save");
    } catch {
      addToast("Load failed", "danger");
    }
  }

  function handleDeleteSelectedSlot() {
    if (!selectedSaveSlotName) {
      addToast("Select a slot to delete", "warning");
      return;
    }
    const confirmed = window.confirm(`Delete save slot "${selectedSaveSlotName}"?`);
    if (!confirmed) return;
    try {
      localStorage.removeItem(`${SAVE_SLOT_PREFIX}${selectedSaveSlotName}`);
      refreshSaveSlots();
      addToast(`Deleted slot: ${selectedSaveSlotName}`, "info");
    } catch {
      addToast("Delete failed", "danger");
    }
  }

  return {
    saveLoadOpen,
    setSaveLoadOpen,
    saveLoadMode,
    setSaveLoadMode,
    saveSlots,
    setSaveSlots,
    selectedSaveSlotName,
    setSelectedSaveSlotName,
    saveSlotInput,
    setSaveSlotInput,
    selectedSaveSlot,
    refreshSaveSlots,
    openSaveLoadPanel,
    saveToSlot,
    handleSaveGame,
    handleLoadGame,
    handleLoadSelectedSlot,
    handleLoadLegacyQuickSave,
    handleDeleteSelectedSlot,
  };
}
