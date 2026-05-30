import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import {
  readDeployProfile,
  resolveStudioRoot,
  validateDeployProfileShape,
} from "../deploy-profile-utils.mjs";

describe("deploy profile utilities", () => {
  test("resolves the studio root from the validator script path", () => {
    const scriptPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/scripts/validate-deploy-profile.mjs";

    expect(resolveStudioRoot(scriptPath)).toBe("/Users/pranay/Projects/SentinelTwin/apps/studio");
  });

  test("accepts the checked-in local-only profile contract", () => {
    const profilePath = resolve(
      "/Users/pranay/Projects/SentinelTwin/apps/studio/deploy/profiles/local-only.json",
    );
    const profile = readDeployProfile(profilePath);

    expect(validateDeployProfileShape(profile, profilePath, "local-only")).toEqual([]);
  });

  test("flags a mismatched requested profile id", () => {
    const profilePath = resolve(
      "/Users/pranay/Projects/SentinelTwin/apps/studio/deploy/profiles/local-only.json",
    );
    const profile = readDeployProfile(profilePath);

    expect(validateDeployProfileShape(profile, profilePath, "self-hosted")).toContain(
      `${profilePath}: profile id "local-only" does not match requested profile "self-hosted"`,
    );
  });
});

