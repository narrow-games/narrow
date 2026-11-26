Optional: add the Stockfish engine for Medium/Hard strength
===========================================================
The chess game works as-is with a built-in (weaker) computer opponent.
For a much stronger opponent, put these two files in THIS folder (game/chess/):

    stockfish-19-lite-single.js
    stockfish-19-lite-single.wasm

Download both from the Stockfish.js releases page:
    https://github.com/nmrugg/stockfish.js/releases
(about 1.7 MB total, no special server settings needed)

The game detects them automatically; the label under the board changes to "Engine: Stockfish".
Stockfish is GPL-3.0 licensed (license text included here). Rules logic uses chess.js (BSD).
