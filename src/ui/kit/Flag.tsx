import type { CountryId } from "../../game/state/types";
import { flagSvgMarkup } from "./flags";
import "./kit.css";

export function Flag({ countryId, width = 22 }: { countryId: CountryId; width?: number }) {
  const height = (width * 2) / 3;
  return (
    <span
      className="flag"
      style={{ width, height }}
      dangerouslySetInnerHTML={{ __html: flagSvgMarkup(countryId, width, height) }}
    />
  );
}
