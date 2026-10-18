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
    <div className="save-modal-overlay" data-layout="save-load-backdrop" onClick={() => setSaveLoadOpen(false)}>
      <div className="save-modal" data-layout="save-load" onClick={(event) => event.stopPropagation()}>
        <div className="save-modal__header">
          <div>
            <h3>Save / Load</h3>
            <p>{saveLoadMode === "save" ? "Create or overwrite save slots." : "Select a slot and load instantly."}</p>
          </div>
          <button className="float-panel__close" onClick={() => setSaveLoadOpen(false)}>×</button>
        </div>
        <div className="save-modal__body">
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
                    <span className="save-slot__turn">T{slot.envelope.turn}</span>
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
              <button className="top-bar__btn top-bar__btn--secondary" onClick={() => saveToSlot(saveSlotInput)}>Save New</button>
              <button
                className="top-bar__btn top-bar__btn--secondary"
                onClick={() => selectedSaveSlotName ? saveToSlot(selectedSaveSlotName) : addToast("Select a slot first", "warning")}
              >
                Overwrite Selected
              </button>
              <button className="top-bar__btn top-bar__btn--primary" onClick={handleLoadSelectedSlot}>Load Selected</button>
              <button className="top-bar__btn top-bar__btn--secondary" onClick={handleDeleteSelectedSlot}>Delete Selected</button>
              <button className="top-bar__btn top-bar__btn--secondary" onClick={handleLoadLegacyQuickSave}>Load Legacy Quick Save</button>
            </div>
            {selectedSaveSlot && (
              <div className="save-modal__selected">
                Selected: <strong>{selectedSaveSlot.name}</strong> (Turn {selectedSaveSlot.envelope.turn})
                {selectedSaveSlot.isLegacyPayload ? " - Legacy Slot" : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
