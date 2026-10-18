import { Save } from "lucide-react";
import { Badge } from "../kit/Badge";
import { Button } from "../kit/Button";
import { Window } from "../kit/Window";
import { useGame } from "../session/GameProvider";
import "./SaveLoadWindow.css";

export function SaveLoadWindow() {
  const {
    gameState,
    saveLoadOpen,
    setSaveLoadOpen,
    saveLoadMode,
    saveSlots,
    selectedSaveSlotName,
    setSelectedSaveSlotName,
    saveSlotInput,
    setSaveSlotInput,
    selectedSaveSlot,
    saveToSlot,
    addToast,
    handleLoadSelectedSlot,
    handleDeleteSelectedSlot,
    handleLoadLegacyQuickSave,
  } = useGame();

  if (!saveLoadOpen) return null;

  return (
    <Window
      title="Save / Load"
      icon={Save}
      onClose={() => setSaveLoadOpen(false)}
      variant="modal"
      className="save-modal"
      backdropClassName="save-modal-overlay"
      bodyClassName="save-modal__body"
      layoutId="save-load"
    >
      <p className="save-modal__hint">
        {saveLoadMode === "save" ? "Create or overwrite save slots." : "Select a slot and load instantly."}
      </p>
      <div className="save-modal__grid">
        <div className="save-modal__list">
          {saveSlots.length === 0 && (
            <div className="save-slot save-slot--empty">No saved slots yet.</div>
          )}
          {saveSlots.map((slot) => {
            const savedAtLabel =
              slot.envelope.savedAt && slot.envelope.savedAt !== new Date(0).toISOString()
                ? new Date(slot.envelope.savedAt).toLocaleString()
                : "Legacy";
            return (
              <button
                key={slot.name}
                className={`save-slot ${selectedSaveSlotName === slot.name ? "save-slot--active" : ""}`}
                onClick={() => setSelectedSaveSlotName(slot.name)}
              >
                <div className="save-slot__title-row">
                  <span className="save-slot__name">{slot.name}</span>
                  <Badge tone="plain">T{slot.envelope.turn}</Badge>
                </div>
                <div className="save-slot__meta">{savedAtLabel}</div>
                <div className="save-slot__meta">{gameState.countries[slot.envelope.countryId]?.name ?? slot.envelope.countryId}</div>
              </button>
            );
          })}
        </div>
        <div className="save-modal__actions">
          <label className="save-modal__label" htmlFor="save-slot-input">Slot Name</label>
          <input
            id="save-slot-input"
            className="save-modal__input"
            value={saveSlotInput}
            onChange={(event) => setSaveSlotInput(event.target.value)}
            placeholder="my-campaign-turn12"
          />
          <div className="save-modal__buttons">
            <Button size="sm" variant="secondary" onClick={() => saveToSlot(saveSlotInput)}>Save New</Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => selectedSaveSlotName ? saveToSlot(selectedSaveSlotName) : addToast("Select a slot first", "warning")}
            >
              Overwrite Selected
            </Button>
            <Button size="sm" variant="primary" onClick={handleLoadSelectedSlot}>Load Selected</Button>
            <Button size="sm" variant="danger" onClick={handleDeleteSelectedSlot}>Delete Selected</Button>
            <Button size="sm" variant="ghost" onClick={handleLoadLegacyQuickSave}>Load Legacy Quick Save</Button>
          </div>
          {selectedSaveSlot && (
            <div className="save-modal__selected">
              Selected: <strong>{selectedSaveSlot.name}</strong> (Turn {selectedSaveSlot.envelope.turn})
              {selectedSaveSlot.isLegacyPayload ? " - Legacy Slot" : ""}
            </div>
          )}
        </div>
      </div>
    </Window>
  );
}
