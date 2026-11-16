import assert from "node:assert/strict";
import { evaluate, emptyBoard, LINES, nextPlayer, place, type Player } from "./game.ts";

const drawBoard = ["X", "O", "X", "X", "O", "O", "O", "X", "X"] as const;

assert.equal(nextPlayer("X"), "O");
assert.equal(nextPlayer("O"), "X");
assert.equal(evaluate(emptyBoard()).kind, "ongoing");

for (const line of LINES) {
  for (const player of ["X", "O"] as const) {
    const board = emptyBoard();
    for (const index of line) board[index] = player;
    const outcome = evaluate(board);
    assert.equal(outcome.kind, "win");
    if (outcome.kind === "win") {
      assert.equal(outcome.player, player);
      assert.deepEqual(outcome.line, line);
    }
  }
}

assert.equal(evaluate([...drawBoard]).kind, "draw");

const winningFullBoard = emptyBoard();
winningFullBoard[0] = "X";
winningFullBoard[1] = "X";
winningFullBoard[2] = "X";
for (let index = 3; index < 9; index += 1) {
  winningFullBoard[index] = index % 2 === 0 ? "O" : "X";
}
assert.equal(evaluate(winningFullBoard).kind, "win");

let board = emptyBoard();
let player: Player = "X";
const script = [0, 3, 1, 4, 2];
for (const index of script) {
  const next = place(board, index, player);
  assert.ok(next);
  board = next;
  player = nextPlayer(player);
}

const finish = evaluate(board);
assert.equal(finish.kind, "win");
if (finish.kind === "win") assert.equal(finish.player, "X");

assert.equal(place(board, 6, "O"), null);
assert.equal(place(emptyBoard(), 0, "X")?.[0], "X");

const occupied = place(emptyBoard(), 0, "X");
assert.ok(occupied);
assert.equal(place(occupied, 0, "O"), null);
assert.equal(place(emptyBoard(), -1, "X"), null);
assert.equal(place(emptyBoard(), 1.5, "X"), null);

console.log("game logic ok");
