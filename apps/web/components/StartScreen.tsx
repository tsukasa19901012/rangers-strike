import type { PlayerId, CpuLevel } from "@rangers-strike/engine";
import type { CustomDeck } from "@/lib/deckBuilder";
import { encodeDeckSelection, FULL_PLAYABLE_DECK_OPTIONS } from "@/lib/deckSelection";
import { CPU_LEVEL_OPTIONS, STARTER_OPTIONS } from "@/lib/labels";

type StartScreenProps = {
  humanDeckKey: string;
  cpuDeckKey: string;
  cpuLevel: CpuLevel;
  firstPlayer: PlayerId;
  customDecks: CustomDeck[];
  onHumanDeckChange: (key: string) => void;
  onCpuDeckChange: (key: string) => void;
  onCpuLevelChange: (level: CpuLevel) => void;
  onFirstPlayerChange: (id: PlayerId) => void;
  onOpenDeckBuilder: (editDeckId?: string) => void;
  onStart: () => void;
  startError?: string | null;
};

function parseCustomId(key: string): string | null {
  if (!key.startsWith("custom:")) return null;
  return key.slice("custom:".length);
}

export function StartScreen({
  humanDeckKey,
  cpuDeckKey,
  cpuLevel,
  firstPlayer,
  customDecks,
  onHumanDeckChange,
  onCpuDeckChange,
  onCpuLevelChange,
  onFirstPlayerChange,
  onOpenDeckBuilder,
  onStart,
  startError,
}: StartScreenProps) {
  const humanCustomId = parseCustomId(humanDeckKey);
  const cpuCustomId = parseCustomId(cpuDeckKey);

  return (
    <div className="start-screen">
      <header className="start-screen__hero">
        <h1 className="start-screen__title">レンジャーズストライク</h1>
        <p className="start-screen__subtitle">Legend 1〜3 / フルプレイアブル — CPU対戦（Lv1〜5）</p>
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
                      {deck.name}
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
                      {deck.name}
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

        <button type="button" className="btn btn--primary start-screen__start" onClick={onStart}>
          ゲーム開始
        </button>
      </div>
    </div>
  );
}
