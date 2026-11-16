"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  emptyBoard,
  evaluate,
  nextPlayer,
  place,
  type Board,
  type Outcome,
  type Player,
  type WinLine,
} from "@/lib/game";

const STORAGE_KEY = "square-off-scores";
const BOARD_GAP = "0.75rem";

type Scores = {
  X: number;
  O: number;
  draws: number;
};

const EMPTY_SCORES: Scores = { X: 0, O: 0, draws: 0 };
const SCORE_EVENT = "square-off-scores";

function subscribeScores(onStoreChange: () => void) {
  window.addEventListener(SCORE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(SCORE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readScores() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function readScoresOnServer() {
  return "";
}

function parseScores(raw: string): Scores {
  if (!raw) return EMPTY_SCORES;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return EMPTY_SCORES;
    const record = data as Record<string, unknown>;
    return {
      X: count(record.X),
      O: count(record.O),
      draws: count(record.draws),
    };
  } catch {
    return EMPTY_SCORES;
  }
}

function writeScores(scores: Scores) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    window.dispatchEvent(new Event(SCORE_EVENT));
  } catch {
    // Storage can be blocked in private browsing. The round still finishes.
  }
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function statusCopy(outcome: Outcome, turn: Player) {
  if (outcome.kind === "win") {
    return {
      title: `Player ${outcome.player} wins`,
      detail: "Three in a row. Start a new game to play again.",
      player: outcome.player,
    };
  }

  if (outcome.kind === "draw") {
    return {
      title: "It's a draw",
      detail: "Every square is full, and nobody connected three.",
      player: null,
    };
  }

  return {
    title: `Player ${turn}'s turn`,
    detail:
      turn === "X" ? "X opens. Tap any open square." : "O answers. Tap any open square.",
    player: turn,
  };
}

function leadText(scores: Scores): string {
  if (scores.X === 0 && scores.O === 0 && scores.draws === 0) {
    return "No rounds yet. Scores stay on this device.";
  }
  if (scores.X === scores.O) return "The match is level.";
  return scores.X > scores.O ? "Player X leads." : "Player O leads.";
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Mark({
  player,
  drawn = true,
  className = "h-14 w-14",
}: {
  player: Player;
  drawn?: boolean;
  className?: string;
}) {
  const tone = player === "X" ? "text-playerx" : "text-playero";
  const stroke = drawn ? "mark-draw" : "mark-static";

  if (player === "X") {
    return (
      <svg viewBox="0 0 64 64" className={cx(className, tone)} aria-hidden>
        <path d="M16 16 L48 48" className={stroke} />
        <path
          d="M48 16 L16 48"
          className={cx(stroke, drawn && "mark-draw-delay")}
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className={cx(className, tone)} aria-hidden>
      <circle cx="32" cy="32" r="16" className={stroke} />
    </svg>
  );
}

const CENTER = [
  "calc((100% - 1.5rem) / 6)",
  "50%",
  "calc(5 * (100% - 1.5rem) / 6 + 1.5rem)",
] as const;

const SPAN = "calc(2 * (100% - 1.5rem) / 3 + 1.5rem)";
const DIAGONAL = `calc((${SPAN}) * 1.414213562)`;

function axisOffset(position: string) {
  return `calc(${position} - 2.5px)`;
}

function WinStrike({ line, player }: { line: WinLine; player: Player }) {
  const key = line.join(",");
  const tone =
    player === "X"
      ? "bg-playerx shadow-[0_0_16px_#49d6ff]"
      : "bg-playero shadow-[0_0_16px_#ff5d8f]";

  const horizontal = (row: 0 | 1 | 2) => ({
    axis: "x" as const,
    style: {
      left: CENTER[0],
      top: axisOffset(CENTER[row]),
      width: SPAN,
      height: "5px",
    },
  });

  const vertical = (column: 0 | 1 | 2) => ({
    axis: "y" as const,
    style: {
      top: CENTER[0],
      left: axisOffset(CENTER[column]),
      height: SPAN,
      width: "5px",
    },
  });

  const specs = {
    "0,1,2": horizontal(0),
    "3,4,5": horizontal(1),
    "6,7,8": horizontal(2),
    "0,3,6": vertical(0),
    "1,4,7": vertical(1),
    "2,5,8": vertical(2),
    "0,4,8": {
      axis: "x" as const,
      style: {
        left: CENTER[0],
        top: axisOffset(CENTER[0]),
        width: DIAGONAL,
        height: "5px",
        transformOrigin: "left center",
        transform: "rotate(45deg)",
      },
    },
    "2,4,6": {
      axis: "x" as const,
      style: {
        left: CENTER[0],
        top: axisOffset(CENTER[2]),
        width: DIAGONAL,
        height: "5px",
        transformOrigin: "left center",
        transform: "rotate(-45deg)",
      },
    },
  };

  const spec = specs[key as keyof typeof specs];
  if (!spec) return null;

  return (
    <div className="pointer-events-none absolute" style={spec.style} aria-hidden>
      <div
        className={cx(
          "h-full w-full rounded-full",
          tone,
          spec.axis === "y" ? "win-line-y" : "win-line-x",
        )}
      />
    </div>
  );
}

function Confetti({ seed }: { seed: number }) {
  const pieces = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: 22 }, (_, index) => ({
      id: index,
      left: `${random() * 100}%`,
      delay: `${random() * 0.2}s`,
      duration: `${0.9 + random() * 0.6}s`,
      color: ["#49d6ff", "#ff5d8f", "#f6c15b", "#ffffff"][index % 4],
      drift: `${(random() - 0.5) * 90}px`,
      spin: `${random() * 280 - 140}deg`,
      size: `${6 + random() * 6}px`,
    }));
  }, [seed]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-36 overflow-hidden" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece rounded-[2px]"
          style={{
            left: piece.left,
            width: piece.size,
            height: `calc(${piece.size} * 0.55)`,
            background: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            ["--drift" as string]: piece.drift,
            ["--spin" as string]: piece.spin,
          }}
        />
      ))}
    </div>
  );
}

function mulberry32(seed: number) {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function ScoreColumn({
  label,
  value,
  accent,
  pulse,
}: {
  label: string;
  value: number;
  accent: "playerx" | "playero" | "gold";
  pulse: boolean;
}) {
  const text =
    accent === "playerx" ? "text-playerx" : accent === "playero" ? "text-playero" : "text-gold";
  const pill =
    accent === "playerx"
      ? "border-playerx/40 bg-playerx/10 text-playerx"
      : accent === "playero"
        ? "border-playero/40 bg-playero/10 text-playero"
        : "border-gold/40 bg-gold/10 text-gold";

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={cx(
          "rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap sm:px-3 sm:text-xs",
          pill,
        )}
      >
        {label}
      </span>
      <span
        key={value}
        className={cx("text-3xl font-semibold tabular-nums sm:text-4xl", text, pulse && "score-pop")}
      >
        {value}
      </span>
    </div>
  );
}

export function Game() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [turn, setTurn] = useState<Player>("X");
  const [pulse, setPulse] = useState<keyof Scores | null>(null);
  const newGameRef = useRef<HTMLButtonElement>(null);
  const previousKind = useRef<Outcome["kind"]>("ongoing");
  const storedScores = useSyncExternalStore(subscribeScores, readScores, readScoresOnServer);
  const scores = useMemo(() => parseScores(storedScores), [storedScores]);

  const outcome = useMemo(() => evaluate(board), [board]);
  const status = statusCopy(outcome, turn);
  const winning = outcome.kind === "win" ? new Set<number>(outcome.line) : null;

  useEffect(() => {
    if (previousKind.current === "ongoing" && outcome.kind !== "ongoing") {
      newGameRef.current?.focus();
    }
    previousKind.current = outcome.kind;
  }, [outcome]);

  function play(index: number) {
    const next = place(board, index, turn);
    if (!next) return;

    setBoard(next);
    const result = evaluate(next);
    if (result.kind === "win") {
      const player = result.player;
      writeScores({ ...scores, [player]: scores[player] + 1 });
      setPulse(player);
      return;
    }
    if (result.kind === "draw") {
      writeScores({ ...scores, draws: scores.draws + 1 });
      setPulse("draws");
      return;
    }
    setTurn(nextPlayer(turn));
  }

  function newGame() {
    setBoard(emptyBoard());
    setTurn("X");
  }

  function resetAll() {
    setBoard(emptyBoard());
    setTurn("X");
    writeScores(EMPTY_SCORES);
    setPulse(null);
  }

  const newGameTone =
    outcome.kind === "win" && outcome.player === "O"
      ? "bg-playero text-ink hover:brightness-110"
      : outcome.kind === "win"
        ? "bg-playerx text-ink hover:brightness-110"
        : "bg-white text-ink hover:bg-white/90";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-playerx/20 blur-3xl" />
        <div className="absolute -right-16 -bottom-24 h-80 w-80 rounded-full bg-playero/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        <div className="my-auto flex flex-col">
          <header className="text-center">
            <p className="text-xs font-semibold tracking-[0.32em] text-playerx">
              PASS AND PLAY
            </p>
            <h1 className="mt-2 font-display text-[clamp(2.15rem,9vw,3.75rem)] font-extrabold leading-none tracking-tight whitespace-nowrap text-white">
              Square Off
            </h1>
            <p className="mx-auto mt-3 max-w-md text-base text-white/70 sm:text-lg">
              Challenge a friend on the same screen. First to three in a row takes the round.
            </p>
          </header>

          <div className="mx-auto mt-8 grid w-full items-start gap-4 lg:grid-cols-[20.5rem_minmax(0,1fr)] lg:gap-6">
            <div className="relative mx-auto w-full max-w-[20.5rem]">
              {outcome.kind === "win" ? (
                <Confetti seed={scores.X * 100 + scores.O * 10 + scores.draws} />
              ) : null}
              <div className="rounded-[2rem] bg-gradient-to-br from-playerx/50 via-white/15 to-playero/50 p-px shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                <div className="rounded-[calc(2rem-1px)] bg-panel p-3">
                  <div className="relative">
                    <div
                      className="grid grid-cols-3"
                      style={{ gap: BOARD_GAP }}
                      role="group"
                      aria-label="Tic-tac-toe board"
                    >
                      {board.map((cell, index) => {
                        const row = Math.floor(index / 3) + 1;
                        const column = (index % 3) + 1;
                        const isWinning = winning?.has(index) ?? false;
                        const locked = cell !== null || outcome.kind !== "ongoing";
                        return (
                          <button
                            key={index}
                            type="button"
                            aria-label={
                              cell
                                ? `Row ${row}, column ${column}, ${cell}`
                                : `Row ${row}, column ${column}, empty`
                            }
                            disabled={locked}
                            onClick={() => play(index)}
                            className={cx(
                              "group relative flex aspect-square items-center justify-center rounded-[1.2rem] border bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-150",
                              isWinning && cell === "X" && "border-playerx/60 bg-playerx/15",
                              isWinning && cell === "O" && "border-playero/60 bg-playero/15",
                              !isWinning && "border-white/10",
                              !locked && "cursor-pointer hover:border-white/25 hover:bg-white/[0.07] active:scale-[0.98]",
                              locked && !isWinning && cell && outcome.kind !== "ongoing" && "opacity-45",
                            )}
                          >
                            {cell ? (
                              <Mark player={cell} />
                            ) : outcome.kind === "ongoing" ? (
                              <span className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                                <Mark player={turn} drawn={false} className="h-14 w-14 opacity-25" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {outcome.kind === "win" ? (
                      <WinStrike line={outcome.line} player={outcome.player} />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <section className="rounded-[1.75rem] bg-gradient-to-br from-white/15 to-white/5 p-px">
                <div className="flex flex-col items-center rounded-[calc(1.75rem-1px)] bg-panel px-5 py-6 text-center">
                  <div key={status.title} className="status-rise flex flex-col items-center">
                    {status.player ? (
                      <Mark player={status.player} drawn={false} className="h-11 w-11" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mark player="X" drawn={false} className="h-8 w-8" />
                        <Mark player="O" drawn={false} className="h-8 w-8" />
                      </div>
                    )}
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white" role="status" aria-live="polite">
                      {status.title}
                    </h2>
                    <p className="mt-1 max-w-xs text-sm text-white/65">{status.detail}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] bg-gradient-to-br from-white/15 to-white/5 p-px">
                <div className="rounded-[calc(1.75rem-1px)] bg-panel px-4 py-5 sm:px-5">
                  <h2 className="text-center text-lg font-semibold tracking-tight">Scoreboard</h2>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <ScoreColumn
                      label="Player X"
                      value={scores.X}
                      accent="playerx"
                      pulse={pulse === "X"}
                    />
                    <ScoreColumn
                      label="Draws"
                      value={scores.draws}
                      accent="gold"
                      pulse={pulse === "draws"}
                    />
                    <ScoreColumn
                      label="Player O"
                      value={scores.O}
                      accent="playero"
                      pulse={pulse === "O"}
                    />
                  </div>
                  <p className="mt-4 text-center text-sm text-white/60">{leadText(scores)}</p>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <button
                  ref={newGameRef}
                  type="button"
                  onClick={newGame}
                  className={cx(
                    "h-12 cursor-pointer rounded-2xl text-sm font-semibold transition sm:text-base",
                    newGameTone,
                  )}
                >
                  New Game
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="h-12 cursor-pointer rounded-2xl border border-white/15 bg-white/[0.03] text-sm font-semibold text-white transition hover:bg-white/10 sm:text-base"
                >
                  Reset All
                </button>
              </div>
            </div>
          </div>

          <footer className="mt-8 text-center text-sm text-white/55">
            Built with React 19, Next.js 16, and Tailwind CSS
          </footer>
        </div>
      </main>
    </div>
  );
}
