export type Player = "X" | "O";

export type Cell = Player | null;

export type Board = Cell[];

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export type WinLine = (typeof LINES)[number];

export type Outcome =
  | { kind: "win"; player: Player; line: WinLine }
  | { kind: "draw" }
  | { kind: "ongoing" };

export function emptyBoard(): Board {
  return Array<Cell>(9).fill(null);
}

export function nextPlayer(player: Player): Player {
  return player === "X" ? "O" : "X";
}

export function evaluate(board: Board): Outcome {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return { kind: "win", player: mark, line };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { kind: "draw" };
  }

  return { kind: "ongoing" };
}

export function place(board: Board, index: number, player: Player): Board | null {
  if (!Number.isInteger(index) || index < 0 || index > 8) return null;
  if (board[index] !== null) return null;
  if (evaluate(board).kind !== "ongoing") return null;

  const next = board.slice();
  next[index] = player;
  return next;
}
