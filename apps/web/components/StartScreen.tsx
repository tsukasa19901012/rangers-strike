import { FULL_PLAYABLE_CARD_COUNT } from "@rangers-strike/cards";
import type { PlayerId, CpuLevel } from "@rangers-strike/engine";
import { countEntries, type CustomDeck } from "@/lib/deckBuilder";
import type { DeckWarningEstimate } from "@/lib/deckWarnings";
import { encodeDeckSelection, FULL_PLAYABLE_DECK_OPTIONS } from "@/lib/deckSelection";
import { CPU_LEVEL_OPTIONS, STARTER_OPTIONS } from "@/lib/labels";
import { DeckWarningBanner, SS06_SUPPLEMENT } from "./DeckWarningBanner";

type StartScreenProps = {
  humanDeckKey: string;
  cpuDeckKey: string;
  cpuLevel: CpuLevel;
  firstPlayer: PlayerId;
  customDecks: CustomDeck[];
  deckWarningsById?: ReadonlyMap<string, DeckWarningEstimate>;
  humanDeckWarnings?: DeckWarningEstimate | null;
  cpuDeckWarnings?: DeckWarningEstimate | null;
  onHumanDeckChange: (key: string) => void;
  onCpuDeckChange: (key: string) => void;
  onCpuLevelChange: (level: CpuLevel) => void;
  onFirstPlayerChange: (id: PlayerId) => void;
  onOpenDeckBuilder: (editDeckId?: string) => void;
  onStart: () => void;
  startError?: string | null;
  effectDebugToggleVisible?: boolean;
  effectDebugEnabled?: boolean;
  onToggleEffectDebug?: () => void;
};

function parseCustomId(key: string): string | null {
  if (!key.startsWith("custom:")) return null;
  return key.slice("custom:".length);
}

function formatCustomDeckLabel(
  deck: CustomDeck,
  warnings?: DeckWarningEstimate | null,
): string {
  const total = countEntries(deck.entries);
  const warningSuffix =
    warnings && warnings.uiUncertainCount > 0
      ? ` · UI未確認${warnings.uiUncertainCount}枚`
      : "";
  return `${deck.name}（${total}枚${warningSuffix}）`;
}

export function StartScreen({
  humanDeckKey,
  cpuDeckKey,
  cpuLevel,
  firstPlayer,
  customDecks,
  deckWarningsById,
  humanDeckWarnings,
  cpuDeckWarnings,
  onHumanDeckChange,
  onCpuDeckChange,
  onCpuLevelChange,
  onFirstPlayerChange,
  onOpenDeckBuilder,
  onStart,
  startError,
  effectDebugToggleVisible = false,
  effectDebugEnabled = false,
  onToggleEffectDebug,
}: StartScreenProps) {
  const humanCustomId = parseCustomId(humanDeckKey);
  const cpuCustomId = parseCustomId(cpuDeckKey);
  const selectedWarnings = [humanDeckWarnings, cpuDeckWarnings].filter(
    (estimate): estimate is DeckWarningEstimate =>
      !!estimate && estimate.uiUncertainCount > 0,
  );
  const combinedWarningEstimate =
    selectedWarnings.length > 0
      ? {
          uiUncertainCount: selectedWarnings.reduce(
            (sum, estimate) => sum + estimate.uiUncertainCount,
            0,
          ),
          uncertainCardIds: [...new Set(selectedWarnings.flatMap((estimate) => estimate.uncertainCardIds))],
        }
      : null;

  return (
    <div className="start-screen">
      <header className="start-screen__hero">
        <h1 className="start-screen__title">レンジャーズストライク</h1>
        <p className="start-screen__subtitle">全カード（{FULL_PLAYABLE_CARD_COUNT.toLocaleString()}枚）— CPU対戦（Lv1〜5）</p>
      </header>

      <section className="start-screen__panel" aria-label="対戦設定">
        <h2 className="start-screen__section-title">対戦設定</h2>

        <div className="start-screen__deck-row">
          <label className="start-screen__field start-screen__field--grow">
            <span className="start-screen__label">あなたのデッキ</span>
            <select
              value={humanDeckKey}
              onChange={(event) => onHumanDeckChange(event.target.value)}
            >
              <optgroup label="スターター">
                {STARTER_OPTIONS.map((option) => (
                  <option
                    key={option.id}
                    value={encodeDeckSelection({ kind: "starter", id: option.id })}
                  >
                    {option.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="フルプレイアブル">
                {FULL_PLAYABLE_DECK_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
              {customDecks.length > 0 && (
                <optgroup label="自作デッキ">
                  {customDecks.map((deck) => (
                    <option
                      key={deck.id}
                      value={encodeDeckSelection({ kind: "custom", id: deck.id })}
                    >
                      {formatCustomDeckLabel(deck, deckWarningsById?.get(deck.id))}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {humanCustomId && (
            <button
              type="button"
              className="btn btn--ghost start-screen__edit"
              onClick={() => onOpenDeckBuilder(humanCustomId)}
            >
              編集
            </button>
          )}
        </div>

        <div className="start-screen__deck-row">
          <label className="start-screen__field start-screen__field--grow">
            <span className="start-screen__label">CPUのデッキ</span>
            <select
              value={cpuDeckKey}
              onChange={(event) => onCpuDeckChange(event.target.value)}
            >
              <optgroup label="スターター">
                {STARTER_OPTIONS.map((option) => (
                  <option
                    key={option.id}
                    value={encodeDeckSelection({ kind: "starter", id: option.id })}
                  >
                    {option.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="フルプレイアブル">
                {FULL_PLAYABLE_DECK_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
              {customDecks.length > 0 && (
                <optgroup label="自作デッキ">
                  {customDecks.map((deck) => (
                    <option
                      key={deck.id}
                      value={encodeDeckSelection({ kind: "custom", id: deck.id })}
                    >
                      {formatCustomDeckLabel(deck, deckWarningsById?.get(deck.id))}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {cpuCustomId && (
            <button
              type="button"
              className="btn btn--ghost start-screen__edit"
              onClick={() => onOpenDeckBuilder(cpuCustomId)}
            >
              編集
            </button>
          )}
        </div>

        <label className="start-screen__field">
          <span className="start-screen__label">CPUレベル</span>
          <select
            value={cpuLevel}
            onChange={(event) => onCpuLevelChange(Number(event.target.value) as CpuLevel)}
          >
            {CPU_LEVEL_OPTIONS.map((option) => (
              <option key={option.level} value={option.level}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="start-screen__field">
          <span className="start-screen__label">先攻</span>
          <select
            value={firstPlayer}
            onChange={(event) => onFirstPlayerChange(event.target.value as PlayerId)}
          >
            <option value="player1">あなた</option>
            <option value="player2">CPU</option>
          </select>
        </label>
      </section>

      <div className="start-screen__actions">
        <button
          type="button"
          className="btn start-screen__secondary"
          onClick={() => onOpenDeckBuilder()}
        >
          デッキを作る
        </button>

        {startError && (
          <div className="action-error" role="alert">
            {startError}
          </div>
        )}

        {combinedWarningEstimate && (
          <DeckWarningBanner estimate={combinedWarningEstimate} showSupplement={false} />
        )}

        <button type="button" className="btn btn--primary start-screen__start" onClick={onStart}>
          ゲーム開始
        </button>

        {effectDebugToggleVisible && onToggleEffectDebug && (
          <button
            type="button"
            className="btn btn--ghost start-screen__debug"
            onClick={onToggleEffectDebug}
            aria-pressed={effectDebugEnabled}
          >
            効果デバッグ{effectDebugEnabled ? " ON" : ""}
          </button>
        )}

        <p className="start-screen__notice" role="note">
          {SS06_SUPPLEMENT}
        </p>
      </div>
    </div>
  );
}
