"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  getCardEffect,
  getUnitEffectBlock,
  resolveCardImageUrl,
  resolveRushAdditionalCondition,
} from "@rangers-strike/cards";
import { estimateCardUiCoverage } from "@/lib/estimateCardUiCoverage";

type CardModalProps = {
  card: CardDefinition;
  onClose: () => void;
};

export function CardModal({ card, onClose }: CardModalProps) {
  const [mounted, setMounted] = useState(false);
  const operationEffect = getCardEffect(card.id);
  const unitEffects = card.type === "unit" ? getUnitEffectBlock(card.id) : undefined;
  const rushAdditionalCondition = resolveRushAdditionalCondition(card.id, card);
  const imageUrl = resolveCardImageUrl(card.id);
  const coverage = estimateCardUiCoverage(card.id);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--card-preview"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal modal--card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
      >
        <button type="button" className="modal__close" onClick={onClose}>
          ✕
        </button>
        <div className="modal__content modal__content--card">
          {imageUrl && (
            <div className="modal__media">
              <Image
                src={imageUrl}
                alt={card.name}
                width={220}
                height={308}
                className="modal__image"
                unoptimized
              />
            </div>
          )}
          <div className="modal__info">
            <h3>{card.name}</h3>
            <p className="modal__id">{card.id}</p>
            {coverage.badges.length > 0 && (
              <div className="modal__coverage-badges">
                {coverage.badges.map((badge) => (
                  <span
                    key={badge}
                    className={`modal__coverage-badge${
                      badge === "DSL未実装"
                        ? " modal__coverage-badge--dsl-unimplemented"
                        : badge === "DSL対応"
                          ? " modal__coverage-badge--dsl-ready"
                          : ""
                    }`}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
            <dl className="modal__stats">
              <div>
                <dt>種類</dt>
                <dd>{card.type}</dd>
              </div>
              {card.powerCost !== undefined && (
                <div>
                  <dt>必要パワー</dt>
                  <dd>{card.powerCost}</dd>
                </div>
              )}
              {card.bp !== undefined && (
                <div>
                  <dt>BP</dt>
                  <dd>{card.bp}</dd>
                </div>
              )}
              {card.sp !== undefined && card.sp !== null && (
                <div>
                  <dt>SP</dt>
                  <dd>{card.sp === "special" ? "！" : String(card.sp)}</dd>
                </div>
              )}
              {card.size && (
                <div>
                  <dt>サイズ</dt>
                  <dd>{card.size}</dd>
                </div>
              )}
              {card.comboNumber !== undefined && card.comboNumber !== null && (
                <div>
                  <dt>CN</dt>
                  <dd>{card.comboNumber}</dd>
                </div>
              )}
              {card.features && card.features.length > 0 && (
                <div>
                  <dt>特徴</dt>
                  <dd>{card.features.join(" / ")}</dd>
                </div>
              )}
            </dl>
            {rushAdditionalCondition && (
              <section className="modal__effect">
                <h4>追加条件</h4>
                <p>{rushAdditionalCondition.text}</p>
              </section>
            )}
            {unitEffects && (
              <section className="modal__effect">
                <h4>効果</h4>
                {unitEffects.unnamedText.length > 0 && (
                  <ul className="modal__unnamed-effects">
                    {unitEffects.unnamedText.map((entry) => (
                      <li key={entry.text}>{entry.text}</li>
                    ))}
                  </ul>
                )}
                {unitEffects.namedEffects.map((named) => (
                  <div key={named.name} className="modal__named-effect">
                    <p className="modal__effect-name">【{named.name}】</p>
                    <p>{named.text || "—"}</p>
                  </div>
                ))}
              </section>
            )}
            {!unitEffects && (operationEffect?.text || card.text) && (
              <section className="modal__effect">
                <h4>効果</h4>
                <p>{operationEffect?.text ?? card.text}</p>
              </section>
            )}
            {card.tags && card.tags.length > 0 && (
              <p className="modal__tags">{card.tags.join(" / ")}</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
