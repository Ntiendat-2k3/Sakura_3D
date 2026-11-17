'use client';
import { useEffect, useRef, useState } from 'react';
import { KOHAKU_NPC_PERSONAS, type useKohakuInteraction } from '../systems/useKohakuInteraction';
import { KOHAKU_GAME_RULES } from './kohakuGameRules';

const DRINK_MENU = [
  { name: 'Yamazaki 18 Single Malt', note: 'Ủ thùng gỗ sồi Mizunara · Hổ phách đậm' },
  { name: 'Hibiki Harmony Rocks', note: 'Phối trộn cổ điển Nhật Bản · Đá viên tinh khiết' },
  { name: 'Kohaku Old Fashioned', note: 'Rye Whisky · Đường nâu · Vỏ cam cháy' },
  { name: 'Dom Pérignon Vintage', note: 'Sâm panh hảo hạng ướp lạnh' },
] as const;

/** Hộp thoại tương tác phím F và gợi ý nổi cho Shinku, Hinata và Bartender Caca trong Kohaku Club. */
export function KohakuNpcDialog({
  interaction,
  dealerSeated,
  seatedPlayersCount,
}: {
  interaction: ReturnType<typeof useKohakuInteraction>;
  dealerSeated: boolean;
  seatedPlayersCount: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const activeId = interaction.openNpc;
  const nearId = interaction.nearNpc;
  const persona = activeId
    ? KOHAKU_NPC_PERSONAS[activeId]
    : nearId
      ? KOHAKU_NPC_PERSONAS[nearId]
      : null;
  const opened = !!activeId;
  // Quầy bar có 2 mục: gọi đồ uống, hoặc nghe Caca giải thích luật từng trò. null = đang ở menu đồ uống.
  const [rulesId, setRulesId] = useState<string | null>(null);
  const rules = KOHAKU_GAME_RULES.find(game => game.id === rulesId);

  useEffect(() => {
    const element = dialog.current;
    if (opened && element && !element.open) element.showModal();
    if (!opened && element?.open) element.close();
    if (!opened) setRulesId(null);
  }, [opened]);

  return (
    <>
      {nearId && persona && (
        <button hidden={opened} className="npc-interact graphics-toggle" onClick={interaction.open}>
          {nearId === 'bartender'
            ? `F · Gọi đồ uống & hỏi luật chơi với ${persona.name}`
            : nearId === 'hinata'
              ? `F · Chào hỏi & Kiss ${persona.name} ♥`
              : `F · Trò chuyện với ${persona.name}`}
        </button>
      )}
      <dialog
        ref={dialog}
        className="npc-dialog dj-music-dialog"
        aria-labelledby="kohaku-npc-title"
        onCancel={event => {
          event.preventDefault();
          interaction.close();
        }}
      >
        {activeId && persona && (
          <>
            <small>{persona.badge}</small>
            <h2 id="kohaku-npc-title">{persona.title}</h2>
            <p>{persona.description}</p>

            {activeId === 'shinku' && (
              <p style={{ color: dealerSeated ? '#ffe08a' : '#d6c198', fontWeight: 600 }}>
                {dealerSeated
                  ? `Trạng thái bàn Poker: Shinku đã ngồi vào ghế Dealer phục vụ (${seatedPlayersCount}/4 người chơi đang ngồi).`
                  : 'Trạng thái bàn Poker: Đang trống khách — hãy lại gần ghế PLAYER 1–4 và bấm ngồi để Shinku vào ghế Dealer.'}
              </p>
            )}

            {activeId === 'bartender' && (
              <>
                <div className="npc-dialog-actions" role="tablist" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
                  <button type="button" role="tab" aria-selected={!rules} onClick={() => setRulesId(null)}>
                    Đồ uống
                  </button>
                  {KOHAKU_GAME_RULES.map(game => (
                    <button key={game.id} type="button" role="tab" aria-selected={rulesId === game.id} onClick={() => setRulesId(game.id)}>
                      Luật: {game.title}
                    </button>
                  ))}
                </div>
                {rules ? (
                  <div className="npc-game-rules">
                    <p>
                      <b>{rules.title}</b> · {rules.players} · {rules.where}
                    </p>
                    {rules.sections.map(section => (
                      <section key={section.heading}>
                        <h3>{section.heading}</h3>
                        <ul>
                          {section.items.map(item => <li key={item}>{item}</li>)}
                        </ul>
                      </section>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="npc-dialog-actions" style={{ flexWrap: 'wrap' }}>
                      {DRINK_MENU.map(drink => (
                        <button
                          key={drink.name}
                          type="button"
                          onClick={() => interaction.orderDrink(drink.name)}
                        >
                          {drink.name}
                        </button>
                      ))}
                    </div>
                    {interaction.lastOrder && (
                      <p style={{ color: '#ffd985', marginTop: 10 }}>{interaction.lastOrder}</p>
                    )}
                  </>
                )}
              </>
            )}

            {activeId === 'hinata' && interaction.hinataFeedback && (
              <p style={{ color: '#ffb8df', fontWeight: 600, marginTop: 10 }}>
                {interaction.hinataFeedback}
              </p>
            )}

            <div className="npc-dialog-actions" style={{ flexWrap: 'wrap' }}>
              {activeId === 'hinata' && (
                <button
                  autoFocus
                  type="button"
                  style={{ background: '#a83279', borderColor: '#ff99cc', fontWeight: 700 }}
                  onClick={interaction.triggerHinataKiss}
                >
                  Hôn Hinata (Kiss) ♥
                </button>
              )}
              <button autoFocus={activeId !== 'hinata'} type="button" onClick={interaction.close}>
                Đóng (Esc)
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
