export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is chessgator?",
    answer:
      "chessgator is a free chess coach that runs in your browser. You play as White or Black against Maia, a human-like opponent, and a coach mascot explains the ideas behind better moves after you play.",
  },
  {
    question: "How does the coaching work?",
    answer:
      "After each of your moves, Stockfish analyzes the position on your device. The coach uses that analysis to classify the move, point out the idea you missed or found, and suggest a stronger continuation when one exists.",
  },
  {
    question: "What are Maia and Stockfish?",
    answer:
      "Maia is a neural-network chess engine trained on human games, so it plays more like a person than a perfect computer. Stockfish is a strong traditional engine used here only for coaching analysis, not as your opponent.",
  },
  {
    question: "Does chessgator upload my games?",
    answer:
      "No. Your game tree, settings, and coaching notes stay in this browser's local storage. Engines and models load from chessgator.com; nothing about your moves is sent to a server.",
  },
  {
    question: "Does it work offline?",
    answer:
      "After the page and engine files have loaded once, play and analysis continue without a network. A later visit still needs the site and assets if your browser cache has cleared them.",
  },
  {
    question: "Why is the first visit a large download?",
    answer:
      "The first time you open the board, the browser downloads Maia, Stockfish, and the ONNX Runtime — about 30 MB total. You can move while they load; Maia replies when it is ready. Later visits reuse the cached files.",
  },
  {
    question: "Which browsers work?",
    answer:
      "chessgator needs a modern browser with WebAssembly and Web Workers. Current Chrome, Edge, Firefox, and Safari should work. Automated tests run in Chromium.",
  },
  {
    question: "Is chessgator free?",
    answer: "Yes. There are no accounts, subscriptions, or in-app purchases.",
  },
  {
    question: "How do I start over or clear a game?",
    answer:
      "Use New game in the app settings to reset the board. To wipe stored data entirely, clear this site's data in your browser settings.",
  },
  {
    question: "What is the most human-like chess bot?",
    answer:
      "Maia is the usual answer. It was trained on millions of human games to predict what a player at a given rating would play, rather than the objectively best move. chessgator uses Maia as the opponent at Elo 1100–1900. Other sites offer personality bots; those are often strong engines with added noise, not models trained on human play.",
  },
  {
    question: "Is there a free chess coach that explains moves?",
    answer:
      "Yes. On chessgator, Stockfish runs locally after each of your moves. The coach classifies the move, names the idea, and can show a better line. There is no account and no subscription. Lichess and Chess.com also explain games, usually after the game and, on Chess.com, with more detail behind a paid plan.",
  },
  {
    question: "Can I play Maia outside Lichess?",
    answer:
      "Yes. Lichess is the best-known place to play Maia against their hosted bots. chessgator runs a browser build of Maia3 on your device, so you can play Maia without a Lichess account and with a coach after every move.",
  },
  {
    question: "How do I play chess against a computer with no sign up?",
    answer:
      "Open chessgator.com/game, pick a side and a Maia strength, and move. There is no account. The first visit downloads the engines (about 30 MB). You can also start from a level page such as /play/beginner.",
  },
  {
    question: "What is Maia chess?",
    answer:
      "Maia is a neural-network chess engine from the University of Toronto CSSLab. It learns to imitate human moves at a target rating instead of maximizing engine strength. On this site you face Maia at Elo 1100, 1200, …, 1900.",
  },
  {
    question: "How is Maia different from Stockfish?",
    answer:
      "Stockfish searches for the strongest move and will outplay almost anyone. Maia predicts a human move at a chosen rating, including the kinds of mistakes people make. chessgator uses Maia as the opponent and Stockfish only as the coach.",
  },
  {
    question: "Can I play chess in the browser without an account?",
    answer:
      "Yes. chessgator has no accounts. Open the board and play. Games are stored in this browser only. Lichess also lets guests play; Chess.com expects a login for most features.",
  },
  {
    question: "What Elo can I play against?",
    answer:
      "Maia on chessgator covers Elo 1100 through 1900 in 100-point steps. Pick a level from the play pages or change strength in the game settings.",
  },
  {
    question: "Do I need to download a chess app?",
    answer:
      "No. chessgator is a website. The first visit pulls Maia, Stockfish, and ONNX Runtime into the browser (about 30 MB). There is no store install and no account.",
  },
  {
    question: "Is chessgator a Chess.com or Lichess alternative?",
    answer:
      "Not as a full platform. Use Lichess or Chess.com to play other people, solve puzzles, and join clubs. Use chessgator when you want a human-like bot, move-by-move coaching, and no sign-up, with engines running on your device.",
  },
  {
    question: "Can I play as Black against the computer?",
    answer:
      "Yes. Choose Black in the game settings. Maia still replies, and the coach still reviews each of your moves.",
  },
  {
    question: "Does the coach play the moves for me?",
    answer:
      "No. You play every move. The coach comments after you move and can show a stronger line. You can step back and try that line yourself.",
  },
];
