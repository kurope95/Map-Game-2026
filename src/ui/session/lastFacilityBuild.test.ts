import { describe, expect, it } from "vitest";
import { canRepeatFacilityBuild } from "./lastFacilityBuild";

const build = { regionId: "moscow", facilityType: "farm" as const, countryId: "RUSSIA" as const };
const controlled = { controllerCountryId: "RUSSIA" as const };

describe("canRepeatFacilityBuild", () => {
  it("allows a repeat during the player's turn in a player-controlled region", () => {
    expect(canRepeatFacilityBuild(build, controlled, "RUSSIA", true)).toBe(true);
  });

  it("rejects when nothing was built", () => {
    expect(canRepeatFacilityBuild(null, controlled, "RUSSIA", true)).toBe(false);
  });

  it("rejects when it is not the player's turn", () => {
    expect(canRepeatFacilityBuild(build, controlled, "RUSSIA", false)).toBe(false);
  });

  it("rejects when the remembered region is no longer player-controlled", () => {
    expect(canRepeatFacilityBuild(build, { controllerCountryId: "GERMANY" }, "RUSSIA", true)).toBe(false);
  });

  it("rejects a build remembered in another country's game (a new game or a load as someone else)", () => {
    expect(canRepeatFacilityBuild(build, { controllerCountryId: "GERMANY" }, "GERMANY", true)).toBe(false);
    expect(canRepeatFacilityBuild({ ...build, countryId: "GERMANY" }, { controllerCountryId: "GERMANY" }, "GERMANY", true)).toBe(true);
  });

  it("rejects when the remembered region no longer exists", () => {
    expect(canRepeatFacilityBuild(build, undefined, "RUSSIA", true)).toBe(false);
  });
});
