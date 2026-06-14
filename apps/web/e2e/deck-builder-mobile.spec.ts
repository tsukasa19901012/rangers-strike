import { expect, test } from "@playwright/test";

test.describe("AC-06 — mobile deck builder E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows catalog grid, filter modal, deck adjust, and save on mobile viewport", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "デッキを作る" }).click();
    await expect(page.getByRole("heading", { name: "デッキ作成" })).toBeVisible();

    await expect(page.getByRole("status").filter({ hasText: /件$/ })).toBeVisible();
    await expect(
      page.locator(".deck-builder__catalog-pane .deck-builder__deck-thumb").first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "検索・フィルタ" }).click();
    await expect(page.getByRole("dialog", { name: "検索・フィルタ" })).toBeVisible();
    await page.getByRole("dialog").getByPlaceholder("例: BK-001, アバレ").fill("BK-001");
    await page.getByRole("button", { name: "閉じる" }).click();

    await page.locator(".deck-builder__catalog-pane .deck-builder__deck-thumb").first().click();
    await expect(page.getByRole("toolbar").first()).toBeVisible();
    await page.getByRole("button", { name: /を増やす/ }).first().click();

    await expect(
      page.locator(".deck-builder__deck-pane .deck-builder__deck-thumb").first(),
    ).toBeVisible();
    await page.locator(".deck-builder__deck-pane .deck-builder__deck-thumb").first().click();
    await expect(page.getByRole("toolbar").first()).toBeVisible();

    await page.locator("body").click({ position: { x: 8, y: 8 } });
    await expect(
      page.locator(".deck-builder__catalog-pane .deck-builder__deck-thumb").first(),
    ).toBeVisible();

    const saveButton = page.locator(".deck-builder__save");
    await expect(saveButton).toBeDisabled();
    await expect(saveButton).toContainText("/40");
    await page.getByRole("button", { name: "戻る" }).click();
    await page.getByRole("button", { name: "破棄して戻る" }).click();
    await expect(page.getByRole("button", { name: "ゲーム開始" })).toBeVisible();
  });
});
