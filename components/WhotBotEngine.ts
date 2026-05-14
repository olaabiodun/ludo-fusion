import { Player, Card, Seat, Color } from './WhotUtils';
import { getBotName } from './WhotUtils';

export interface BotDecision {
  type: 'PLAY' | 'PICK';
  cardIndex?: number;
}

/**
 * AI logic for decision making
 */
export const getBotDecision = (
  botCards: Card[],
  canPlayCard: (card: Card, handLength: number) => boolean
): BotDecision => {
  const playableIdx = botCards.findIndex(c => canPlayCard(c, botCards.length));
  if (playableIdx !== -1) {
    return { type: 'PLAY', cardIndex: playableIdx };
  }
  return { type: 'PICK' };
};

/**
 * Generates practice players based on requested count (2 or 4)
 */
export const createPracticePlayers = (
  localUserId: string,
  playerCount: number = 4
): Player[] => {
  const seats: Seat[] = playerCount === 2 ? ['DOWN', 'TOP'] : ['DOWN', 'LEFT', 'TOP', 'RIGHT'];
  const colors: Color[] = ['green', 'red', 'yellow', 'blue'];
  const botAvatars = [
    { uri: 'https://i.pravatar.cc/150?u=bot1' },
    { uri: 'https://i.pravatar.cc/150?u=bot2' },
    { uri: 'https://i.pravatar.cc/150?u=bot3' },
  ];

  const botNames = ['Amina', 'Tunde', 'Obinna', 'Zainab', 'Chidi', 'Folake', 'Ibrahim', 'Chioma'];

  return Array(playerCount).fill(0).map((_, i) => {
    const isBot = i !== 0;
    const name = i === 0 ? 'You' : botNames[i - 1];
    
    return {
      id: i === 0 ? (localUserId || 'local') : `bot${i}`,
      name: name,
      color: colors[i],
      cards: [],
      cardCount: 0,
      lives: 4,
      seat: seats[i],
      isBot: isBot,
      active: i === 0,
      avatar: i === 0 ? null : botAvatars[i - 1],
    };
  });
};
