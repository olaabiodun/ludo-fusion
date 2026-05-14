import { Card, Color, Player, canPlayCard, findNextActivePlayer } from './WhotUtils';

/**
 * Diagnostic suite to verify Whot! game logic.
 * Prints results to the console.
 */
export const runWhotTests = () => {
  console.log("%c 🔍 STARTING WHOT! LOGIC AUDIT ", "background: #111; color: #FFD030; font-weight: bold; padding: 4px;");

  const results = {
    passed: 0,
    failed: 0,
    logs: [] as string[]
  };

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      results.passed++;
      // console.log(`%c ✅ PASS: ${message}`, "color: #4AE65C");
    } else {
      results.failed++;
      console.error(`%c ❌ FAIL: ${message}`, "color: #FF4A42; font-weight: bold;");
      results.logs.push(`FAILED: ${message}`);
    }
  };

  // ─── Test 1: House Rule - No Special Card Checkouts ────────────────────────
  const specialCards: number[] = [1, 2, 5, 8, 14, 20];
  specialCards.forEach(val => {
    const card: Card = { shape: val === 20 ? 'whot' : 'circle', value: val };
    const canPlay = canPlayCard(card, { shape: 'circle', value: 3 }, null, 0, 1);
    assert(!canPlay, `House Rule: Should NOT allow checkout with special card ${val}`);
  });

  const normalCard: Card = { shape: 'circle', value: 3 };
  assert(canPlayCard(normalCard, { shape: 'circle', value: 7 }, null, 0, 1), 
    "Should allow checkout with normal card (value 3)");

  // ─── Test 2: Penalty Defense ───────────────────────────────────────────────
  const pickTwo: Card = { shape: 'circle', value: 2 };
  const matchingTwo: Card = { shape: 'square', value: 2 };
  const nonMatchingFive: Card = { shape: 'circle', value: 5 };
  
  assert(canPlayCard(matchingTwo, pickTwo, null, 2, 4), 
    "Should allow defending Pick-2 with another 2");
  assert(!canPlayCard(nonMatchingFive, pickTwo, null, 2, 4), 
    "Should NOT allow defending Pick-2 with a 5");
  assert(!canPlayCard({ shape: 'whot', value: 20 }, pickTwo, null, 2, 4), 
    "Whot (20) should NOT be able to defend a pick-two");

  // ─── Test 3: findNextActivePlayer Logic ──────────────────────────────────
  const mockPlayers: Player[] = [
    { id: '1', name: 'P1', lives: 3, cardCount: 5, cards: [], color: 'red', seat: 'DOWN' },
    { id: '2', name: 'P2', lives: 0, cardCount: 5, cards: [], color: 'blue', seat: 'LEFT' }, // Dead
    { id: '3', name: 'P3', lives: 3, cardCount: 0, cards: [], color: 'green', seat: 'TOP' }, // Won
    { id: '4', name: 'P4', lives: 3, cardCount: 3, cards: [], color: 'yellow', seat: 'RIGHT' },
  ];

  assert(findNextActivePlayer(0, 1, mockPlayers) === 3, 
    "Next player from P1 should be P4 (skipping dead P2 and finished P3)");
  
  assert(findNextActivePlayer(0, 0, mockPlayers) === 0, 
    "Step 0 (Hold On) should return current player index");

  // ─── Test 4: Scoring Calculations ─────────────────────────────────────────
  const hand: Card[] = [
    { shape: 'circle', value: 5 },
    { shape: 'star', value: 3 }, // Stars double (3 * 2 = 6)
    { shape: 'whot', value: 20 },
  ];
  // 5 + 6 + 20 = 31
  const score = hand.reduce((sum, card) => {
    if (card.shape === 'whot') return sum + 20;
    const val = typeof card.value === 'number' ? card.value : parseInt(card.value as string) || 0;
    if (card.shape === 'star') return sum + (val * 2);
    return sum + val;
  }, 0);
  assert(score === 31, `Scoring: Hand total should be 31, got ${score}`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`%c AUDIT SUMMARY: ${results.passed} PASSED, ${results.failed} FAILED `, 
    `background: ${results.failed > 0 ? '#FF4A42' : '#4AE65C'}; color: #000; font-weight: bold;`);
  
  if (results.failed > 0) {
    console.table(results.logs);
  }

  return results;
};
