'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Pause, RotateCw, ArrowLeft, ArrowRight, ArrowDown, Trophy, Flame } from 'lucide-react';

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const COLORS: Record<string, { fill: string; border: string; glow: string }> = {
  I: { fill: '#06b6d4', border: '#22d3ee', glow: 'rgba(6,182,212,0.7)' }, // Cyan
  J: { fill: '#3b82f6', border: '#60a5fa', glow: 'rgba(59,130,246,0.7)' }, // Blue
  L: { fill: '#f97316', border: '#fb923c', glow: 'rgba(249,115,22,0.7)' }, // Orange
  O: { fill: '#eab308', border: '#facc15', glow: 'rgba(234,179,8,0.7)' }, // Yellow
  S: { fill: '#22c55e', border: '#4ade80', glow: 'rgba(34,197,94,0.7)' }, // Green
  T: { fill: '#a855f7', border: '#c084fc', glow: 'rgba(168,85,247,0.7)' }, // Purple
  Z: { fill: '#ef4444', border: '#f87171', glow: 'rgba(239,68,68,0.7)' }, // Red
};

const ROWS = 20;
const COLS = 10;

type ShapeKey = keyof typeof SHAPES;
const PIECE_TYPES: ShapeKey[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

const createEmptyBoard = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const checkCollision = (
  px: number,
  py: number,
  shape: number[][],
  grid: (string | 0)[][],
) => {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const newX = px + c;
        const newY = py + r;

        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return true;
        }
        if (newY >= 0 && grid[newY][newX]) {
          return true;
        }
      }
    }
  }
  return false;
};

export default function SpaceTetris() {
  const [board, setBoard] = useState<(string | 0)[][]>(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState<{
    shape: number[][];
    type: ShapeKey;
    x: number;
    y: number;
  } | null>(null);
  const [nextPiece, setNextPiece] = useState<ShapeKey>('T');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chandrasetu_tetris_hi');
      return saved ? parseInt(saved, 10) || 0 : 0;
    }
    return 0;
  });
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const getRandomPieceType = (): ShapeKey => {
    return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  };

  const spawnPiece = useCallback((typeToSpawn?: ShapeKey) => {
    const type = typeToSpawn || nextPiece;
    const shape = SHAPES[type];
    const newNext = getRandomPieceType();
    setNextPiece(newNext);

    const piece = {
      shape,
      type,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: 0,
    };

    if (checkCollision(piece.x, piece.y, shape, board)) {
      setGameOver(true);
      setIsPlaying(false);
      return null;
    }

    setCurrentPiece(piece);
    return piece;
  }, [nextPiece, board]);

  const mergePieceToBoard = useCallback(() => {
    if (!currentPiece) return;

    const newBoard = board.map((row) => [...row]);
    const { shape, type, x, y } = currentPiece;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          if (y + r >= 0 && y + r < ROWS && x + c >= 0 && x + c < COLS) {
            newBoard[y + r][x + c] = type;
          }
        }
      }
    }

    let clearedLines = 0;
    const filteredBoard = newBoard.filter((row) => {
      const isFull = row.every((cell) => cell !== 0);
      if (isFull) clearedLines++;
      return !isFull;
    });

    while (filteredBoard.length < ROWS) {
      filteredBoard.unshift(Array(COLS).fill(0));
    }

    if (clearedLines > 0) {
      const points = [0, 100, 300, 500, 800][clearedLines] * level;
      const newScore = score + points;
      setScore(newScore);
      setLines((prev) => prev + clearedLines);
      setLevel(Math.floor((lines + clearedLines) / 10) + 1);

      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem('chandrasetu_tetris_hi', newScore.toString());
      }
    }

    setBoard(filteredBoard);
    spawnPiece();
  }, [currentPiece, board, level, score, lines, highScore, spawnPiece]);

  const moveDown = useCallback(() => {
    if (!currentPiece || gameOver || !isPlaying) return;

    if (!checkCollision(currentPiece.x, currentPiece.y + 1, currentPiece.shape, board)) {
      setCurrentPiece((prev) => (prev ? { ...prev, y: prev.y + 1 } : null));
    } else {
      mergePieceToBoard();
    }
  }, [currentPiece, gameOver, isPlaying, board, mergePieceToBoard]);

  const moveLeft = useCallback(() => {
    if (!currentPiece || gameOver || !isPlaying) return;
    if (!checkCollision(currentPiece.x - 1, currentPiece.y, currentPiece.shape, board)) {
      setCurrentPiece((prev) => (prev ? { ...prev, x: prev.x - 1 } : null));
    }
  }, [currentPiece, gameOver, isPlaying, board]);

  const moveRight = useCallback(() => {
    if (!currentPiece || gameOver || !isPlaying) return;
    if (!checkCollision(currentPiece.x + 1, currentPiece.y, currentPiece.shape, board)) {
      setCurrentPiece((prev) => (prev ? { ...prev, x: prev.x + 1 } : null));
    }
  }, [currentPiece, gameOver, isPlaying, board]);

  const rotate = useCallback(() => {
    if (!currentPiece || gameOver || !isPlaying) return;

    const matrix = currentPiece.shape;
    const rotated = matrix[0].map((_, index) =>
      matrix.map((row) => row[index]).reverse(),
    );

    let offset = 0;
    if (checkCollision(currentPiece.x, currentPiece.y, rotated, board)) {
      if (!checkCollision(currentPiece.x + 1, currentPiece.y, rotated, board)) offset = 1;
      else if (!checkCollision(currentPiece.x - 1, currentPiece.y, rotated, board)) offset = -1;
      else return;
    }

    setCurrentPiece((prev) => (prev ? { ...prev, shape: rotated, x: prev.x + offset } : null));
  }, [currentPiece, gameOver, isPlaying, board]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || !isPlaying) return;
    let targetY = currentPiece.y;
    while (!checkCollision(currentPiece.x, targetY + 1, currentPiece.shape, board)) {
      targetY++;
    }
    setCurrentPiece((prev) => (prev ? { ...prev, y: targetY } : null));
    setTimeout(mergePieceToBoard, 30);
  }, [currentPiece, gameOver, isPlaying, board, mergePieceToBoard]);

  const startGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setIsPlaying(true);
    const firstType = getRandomPieceType();
    const nextType = getRandomPieceType();
    setNextPiece(nextType);
    setCurrentPiece({
      shape: SHAPES[firstType],
      type: firstType,
      x: Math.floor((COLS - SHAPES[firstType][0].length) / 2),
      y: 0,
    });
  }, []);

  const togglePause = useCallback(() => {
    if (gameOver) {
      startGame();
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [gameOver, startGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (!isPlaying || gameOver) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          moveLeft();
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          moveRight();
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          rotate();
          break;
        case 'Space':
          e.preventDefault();
          hardDrop();
          break;
        case 'KeyP':
          e.preventDefault();
          togglePause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gameOver, moveDown, moveLeft, moveRight, rotate, hardDrop, togglePause]);

  useEffect(() => {
    if (isPlaying && !gameOver) {
      const dropSpeed = Math.max(120, 800 - (level - 1) * 70);
      gameLoopRef.current = setInterval(moveDown, dropSpeed);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameOver, level, moveDown]);

  const displayGrid = board.map((row) => [...row]);
  if (currentPiece) {
    const { shape, type, x, y } = currentPiece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] && y + r >= 0 && y + r < ROWS && x + c >= 0 && x + c < COLS) {
          displayGrid[y + r][x + c] = type;
        }
      }
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-black select-none text-slate-100 font-mono">

      <div className="p-3 border-b border-cyan-500/20 bg-slate-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold tracking-wider text-cyan-200 uppercase">
            {`// LUNAR TETRIS`}
          </h2>
        </div>

        <button
          type="button"
          onClick={togglePause}
          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-bold flex items-center gap-1.5 border border-cyan-500/30 transition-colors cursor-pointer"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3 h-3 text-amber-400" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 text-emerald-400" />
              <span>{gameOver ? 'RETRY' : 'PLAY'}</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full grid grid-cols-4 gap-1.5 p-2 bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="p-1 rounded bg-slate-900 border border-slate-800 text-center flex flex-col justify-center">
          <div className="text-[7px] text-slate-500 font-bold uppercase">SCORE</div>
          <div className="font-bold text-[11px] text-cyan-300 truncate">{score}</div>
        </div>
        <div className="p-1 rounded bg-slate-900 border border-slate-800 text-center flex flex-col justify-center">
          <div className="text-[7px] text-slate-500 font-bold uppercase">HI-SCORE</div>
          <div className="font-bold text-[11px] text-amber-300 truncate" suppressHydrationWarning>
            {highScore}
          </div>
        </div>
        <div className="p-1 rounded bg-slate-900 border border-slate-800 text-center flex flex-col justify-center">
          <div className="text-[7px] text-slate-500 font-bold uppercase">LINES/LVL</div>
          <div className="font-bold text-[11px] text-emerald-300 truncate">{lines} · L{level}</div>
        </div>

        <div className="p-1 rounded bg-slate-900 border border-slate-800 flex flex-col items-center justify-center">
          <div className="text-[7px] text-slate-500 font-bold uppercase mb-0.5">NEXT</div>
          <div className="grid grid-cols-4 gap-[1px] w-6 h-6 items-center justify-center">
            {SHAPES[nextPiece].map((row, r) =>
              row.map((cell, c) => (
                <div
                  key={`next-${r}-${c}`}
                  className="w-1.5 h-1.5 rounded-[0.5px]"
                  style={{
                    backgroundColor: cell ? COLORS[nextPiece].fill : 'transparent',
                    border: cell ? `1px solid ${COLORS[nextPiece].border}` : 'none',
                  }}
                />
              )),
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col justify-between overflow-hidden relative bg-black">

        <div className="relative w-full flex-1 flex items-center justify-center bg-black border-y border-cyan-500/20">
          <div
            className="grid gap-[1px] bg-slate-950/90 w-full h-full p-0.5"
            style={{
              gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
            }}
          >
            {displayGrid.map((row, r) =>
              row.map((cell, c) => {
                const style = cell ? COLORS[cell] : null;
                return (
                  <div
                    key={`${r}-${c}`}
                    className="w-full h-full transition-colors duration-75 flex items-center justify-center"
                    style={{
                      backgroundColor: style ? style.fill : 'rgba(2, 6, 23, 0.7)',
                      border: style ? `1px solid ${style.border}` : '1px solid rgba(15, 23, 42, 0.5)',
                      boxShadow: style ? `inset 0 0 6px ${style.glow}` : 'none',
                    }}
                  />
                );
              }),
            )}
          </div>

          {gameOver && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in">
              <div className="text-rose-400 font-bold text-sm tracking-widest mb-1 font-mono">
                MISSION ABORTED
              </div>
              <div className="text-xs text-slate-400 mb-4 font-mono">
                Final Score: <span className="text-cyan-300 font-bold">{score}</span>
              </div>
              <button
                type="button"
                onClick={startGame}
                className="px-5 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.6)] cursor-pointer active:scale-95 transition-all"
              >
                RETRY MISSION
              </button>
            </div>
          )}

          {!isPlaying && !gameOver && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 text-center z-10">
              <Trophy className="w-8 h-8 text-amber-400 mb-2 animate-bounce" />
              <button
                type="button"
                onClick={startGame}
                className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-widest uppercase shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-pointer active:scale-95 transition-all"
              >
                START GAME
              </button>
              <div className="text-[9px] text-slate-400 mt-3 font-mono">
                Controls: [←] [→] [↑ Rotate] [↓] [Space Drop]
              </div>
            </div>
          )}
        </div>

        <div className="w-full px-2 py-2 bg-slate-950/80 border-t border-slate-900 flex items-center justify-between gap-1.5 shrink-0">
          <button
            type="button"
            onClick={moveLeft}
            className="flex-1 h-8 rounded bg-slate-900 hover:bg-slate-800 active:scale-95 flex items-center justify-center border border-slate-800 text-cyan-400 cursor-pointer transition-colors"
            title="Left (A / ←)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={rotate}
            className="flex-1 h-8 rounded bg-slate-900 hover:bg-slate-800 active:scale-95 flex items-center justify-center border border-slate-800 text-cyan-400 cursor-pointer transition-colors"
            title="Rotate (W / ↑)"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={moveDown}
            className="flex-1 h-8 rounded bg-slate-900 hover:bg-slate-800 active:scale-95 flex items-center justify-center border border-slate-800 text-cyan-400 cursor-pointer transition-colors"
            title="Soft Drop (S / ↓)"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={moveRight}
            className="flex-1 h-8 rounded bg-slate-900 hover:bg-slate-800 active:scale-95 flex items-center justify-center border border-slate-800 text-cyan-400 cursor-pointer transition-colors"
            title="Right (D / →)"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={hardDrop}
            className="px-3 h-8 rounded bg-cyan-950 hover:bg-cyan-900 active:scale-95 flex items-center justify-center border border-cyan-500/60 text-cyan-300 font-bold text-[10px] cursor-pointer transition-colors"
            title="Hard Drop (Space)"
          >
            DROP
          </button>
        </div>

      </div>

      <div className="py-2.5 px-3 border-t border-cyan-500/20 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center justify-between text-[10px] font-mono tracking-wider shrink-0 shadow-inner">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <span className="font-semibold bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
            Need a rest? Play Tetris :)
          </span>
        </div>
      </div>
    </div>
  );
}
