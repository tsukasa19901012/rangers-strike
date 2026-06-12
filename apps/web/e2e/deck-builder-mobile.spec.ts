import { expect, test } from "@playwright/test";

const STORAGE_KEY = "rangers-strike/custom-decks/v1";

test.describe("AC-06 — mobile deck builder E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  });

  test("shows catalog on load, load starter, search, and save deck on mobile viewport", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "デッキを作る" }).click();
    await expect(page.getByRole("heading", { name: "デッキ作成" })).toBeVisible();

    await expect(page.getByText(/全 .* 枚を表示中/)).toBeVisible();
    await expect(
      page.locator(".deck-builder__catalog-item, .deck-builder__grid-cell").first(),
    ).toBeVisible();

    await page.getByPlaceholder("マイデッキ").fill("E2E Mobile Deck");

    await page.getByRole("button", { name: /Type A: アバレンオー/ }).click();
    await expect(page.getByText("40 / 40 枚")).toBeVisible();

    const search = page.getByPlaceholder("検索");
    await search.fill("BK-001");
    await expect(page.locator(".deck-builder__catalog-id").filter({ hasText: "BK-001" })).toBeVisible();
    await expect(
      page.locator(".deck-builder__catalog-item button[aria-label$='を追加']").first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /保存（40\/40）/ }).click();
    await expect(page.getByRole("button", { name: "ゲーム開始" })).toBeVisible();

    const decks = await page.evaluate(
      (key) => JSON.parse(window.localStorage.getItem(key) ?? "[]") as Array<{
        name: string;
        entries: Array<{ cardId: string; count: number }>;
      }>,
      STORAGE_KEY,
    );
    expect(decks).toHaveLength(1);
    expect(decks[0]?.name).toBe("E2E Mobile Deck");
    expect(decks[0]?.entries.length).toBeGreaterThan(0);
    expect(decks[0]?.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(40);
  });
});
