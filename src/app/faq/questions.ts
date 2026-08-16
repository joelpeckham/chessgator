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
];
