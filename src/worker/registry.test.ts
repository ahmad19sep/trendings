import { describe, expect, it } from "vitest";

import {
  connectorDescriptorsForQueue,
  sourceFlagEnabled,
} from "./registry";
import { queueNames } from "./schedules";

describe("worker source flags", () => {
  it("uses the documented enabled default only when a flag is absent", () => {
    expect(sourceFlagEnabled("SRC_GTRENDS_RSS", {})).toBe(true);
    expect(sourceFlagEnabled("SRC_GNEWS_RSS", { SRC_GNEWS_RSS: "" })).toBe(
      true,
    );
  });

  it.each([
    ["true", true],
    ["YES", true],
    ["on", true],
    ["1", true],
    ["false", false],
    ["NO", false],
    ["off", false],
    ["0", false],
  ] as const)("parses %s explicitly", (value, expected) => {
    expect(sourceFlagEnabled("SRC_RSS", { SRC_RSS: value })).toBe(expected);
  });

  it("rejects malformed values rather than silently enabling a source", () => {
    expect(() =>
      sourceFlagEnabled("SRC_RSS", { SRC_RSS: "sometimes" }),
    ).toThrow(/SRC_RSS must be one of/);
  });

  it("omits disabled Google Trends and Google News descriptors", async () => {
    await expect(
      connectorDescriptorsForQueue(queueNames.googleTrends, {
        environment: { SRC_GTRENDS_RSS: "false" },
      }),
    ).resolves.toEqual([]);
    await expect(
      connectorDescriptorsForQueue(queueNames.googleNews, {
        environment: { SRC_GNEWS_RSS: "0" },
      }),
    ).resolves.toEqual([]);
  });

  it("does not touch the publisher registry when publisher RSS is disabled", async () => {
    let loaderCalled = false;
    const descriptors = await connectorDescriptorsForQueue(
      queueNames.publisherTierOne,
      {
        environment: { SRC_RSS: "off" },
        loadFeeds: async () => {
          loaderCalled = true;
          throw new Error("disabled registry should not load");
        },
      },
    );

    expect(descriptors).toEqual([]);
    expect(loaderCalled).toBe(false);
  });

  it("keeps implemented sources available when explicitly enabled", async () => {
    const trends = await connectorDescriptorsForQueue(queueNames.googleTrends, {
      environment: { SRC_GTRENDS_RSS: "true" },
    });
    const news = await connectorDescriptorsForQueue(queueNames.googleNews, {
      environment: { SRC_GNEWS_RSS: "yes" },
    });

    expect(trends.length).toBeGreaterThan(0);
    expect(news.length).toBeGreaterThan(0);
    const gdelt = await connectorDescriptorsForQueue(queueNames.gdelt, {
      environment: { SRC_GDELT: "true" },
    });
    expect(gdelt).toHaveLength(4);
  });
});
