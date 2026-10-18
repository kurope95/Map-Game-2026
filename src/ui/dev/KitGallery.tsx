import { useState } from "react";
import { Handshake, Save } from "lucide-react";
import { MAX_UNIT_STRENGTH } from "../../game/content/economyRecipes";
import { createInitialState } from "../../game/state/createInitialState";
import type { CountryId, StockpileKey, UnitType } from "../../game/state/types";
import { Badge } from "../kit/Badge";
import { Button } from "../kit/Button";
import { Flag } from "../kit/Flag";
import { Pips } from "../kit/Pips";
import { ProgressBar } from "../kit/ProgressBar";
import { ResourceAmount } from "../kit/ResourceAmount";
import { ResourceIcon } from "../kit/ResourceIcon";
import { StatRow } from "../kit/StatRow";
import { Tabs } from "../kit/Tabs";
import { UnitSymbol } from "../kit/UnitSymbol";
import { Window } from "../kit/Window";
import { RESOURCE_META } from "../kit/resources";
import { UNIT_TYPE_LABELS } from "../kit/unitSymbols";
import "./KitGallery.css";

type GalleryTab = "one" | "two" | "three";

export function KitGallery() {
  const [activeTab, setActiveTab] = useState<GalleryTab>("one");
  const state = createInitialState();
  const countryIds = Object.keys(state.countries) as CountryId[];
  const unitTypes = Object.keys(MAX_UNIT_STRENGTH) as UnitType[];
  const resources = Object.keys(RESOURCE_META) as StockpileKey[];

  return (
    <div className="kit-gallery">
      <h1 className="kit-gallery__title">Style C kit gallery</h1>

      <section className="kit-gallery__section">
        <h2 className="kit-gallery__heading">Flags</h2>
        <div className="kit-gallery__flags">
          {countryIds.map((countryId) => (
            <figure key={countryId} className="kit-gallery__flag">
              <Flag countryId={countryId} width={44} />
              <figcaption>{state.countries[countryId].name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="kit-gallery__section">
        <h2 className="kit-gallery__heading">Unit symbols</h2>
        <div className="kit-gallery__row">
          {unitTypes.map((type) => (
            <figure key={type} className="kit-gallery__unit">
              <UnitSymbol type={type} size={36} />
              <figcaption>{UNIT_TYPE_LABELS[type]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="kit-gallery__section">
        <h2 className="kit-gallery__heading">Buttons</h2>
        <div className="kit-gallery__row">
          <Button variant="primary">Primary md</Button>
          <Button variant="secondary">Secondary md</Button>
          <Button variant="ghost">Ghost md</Button>
          <Button variant="danger">Danger md</Button>
        </div>
        <div className="kit-gallery__row">
          <Button size="sm">Secondary sm</Button>
          <Button size="sm" variant="primary" icon={Save}>
            With icon
          </Button>
          <Button size="sm" disabled title="Disabled with a title">
            Disabled
          </Button>
        </div>
      </section>

      <section className="kit-gallery__section">
        <h2 className="kit-gallery__heading">Badges, stats, progress, pips and tabs</h2>
        <div className="kit-gallery__row">
          <Badge tone="brics">BRICS</Badge>
          <Badge tone="nato">EU NATO</Badge>
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="good">Good</Badge>
          <Badge tone="warn">Warn</Badge>
          <Badge tone="bad">Bad</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="plain">Plain</Badge>
        </div>
        <div className="kit-gallery__stats">
          <StatRow label="Stability" value="82%" tone="good" />
          <StatRow label="Supply" value="3 turns" tone="warn" />
          <StatRow label="Strength" value="4 / 9" tone="bad" />
          <StatRow label="Population" value="12,000k" />
        </div>
        <div className="kit-gallery__row kit-gallery__row--wide">
          <ProgressBar value={0.8} tone="good" />
          <ProgressBar value={0.5} tone="warn" />
          <ProgressBar value={0.2} tone="bad" />
          <ProgressBar value={0.65} tone="gold" />
        </div>
        <div className="kit-gallery__row">
          <Pips count={1} />
          <Pips count={3} max={5} />
        </div>
        <Tabs<GalleryTab>
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "one", label: "First", icon: Handshake },
            { id: "two", label: "Second", count: 3 },
            { id: "three", label: "Third" }
          ]}
        />
      </section>

      <section className="kit-gallery__section">
        <h2 className="kit-gallery__heading">Resources</h2>
        <div className="kit-gallery__resources">
          {resources.map((resource) => (
            <div key={resource} className="kit-gallery__resource">
              <ResourceIcon resource={resource} size={18} />
              <span>{RESOURCE_META[resource].label}</span>
              <ResourceAmount resource={resource} amount={12} />
            </div>
          ))}
        </div>
      </section>

      <section className="kit-gallery__section">
        <h2 className="kit-gallery__heading">Windows</h2>
        <Window
          variant="panel"
          title="Static panel"
          icon={Handshake}
          className="kit-gallery__panel"
          footer={<Button variant="secondary" size="sm">Footer action</Button>}
        >
          <StatRow label="Stability" value="82%" tone="good" />
          <StatRow label="Supply" value="3 turns" />
          <p className="kit-gallery__text">
            Panel windows are anchored by the caller's positioning class and keep their body scroll.
          </p>
        </Window>
        <div className="kit-gallery__modal-flow">
          <Window variant="modal" title="Modal window" layoutId="gallery-modal">
            <p className="kit-gallery__text">
              Modal windows center themselves over the backdrop and carry a gold header rule.
            </p>
          </Window>
        </div>
      </section>
    </div>
  );
}
