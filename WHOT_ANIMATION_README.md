# Whot Card Animation — Pixel-Perfect Implementation Guide

## Overview

4 animation systems. Every card starts from the **exact screen pixel** of its source and ends on the **exact screen pixel** of its destination. Positions measured at runtime with `measureInWindow`.

**Tech:** `@react-spring/native`, `expo-image`, React Native `animated.View`

---

## Coordinate System

Everything is in **absolute screen space** (px from top-left of screen).

The root game `View` calls `measureInWindow` on mount → `rootScreenPos: {x, y}`.  
All animated views are `position: absolute, top: 0, left: 0` inside the root.  
To place a card at screen point `(sx, sy)`:
```
translateX = sx - rootScreenPos.x - CARD_W/2
translateY = sy - rootScreenPos.y - CARD_H/2
```

### Constants
```ts
const rs = (v) => Math.round(v * (screenWidth / 750)); // responsive scale
const CARD_W = rs(50);
const CARD_H = Math.round(CARD_W * 1.4);

// Root-relative pile positions
const MARKET_X = rootW/2 - (CARD_W/2 + 16); // left = draw pile
const MARKET_Y = rootH/2 - 8;
const DISCARD_X = rootW/2 + (CARD_W/2 + 16); // right = played pile
const DISCARD_Y = rootH/2 - 8;
```

---

## Fan Position Math (used by ALL animations)

```ts
function getCardInFanPos(seat, cardIndex, totalCards, isLocal) {
  // Step 1: chip screen center
  // DOWN:  { x: screenW/2,            y: screenH - rs(6) - rs(20) }
  // TOP:   { x: screenW/2,            y: rs(14) + rs(20) }
  // LEFT:  { x: rs(10)+rs(55),        y: screenH/2 }
  // RIGHT: { x: screenW-rs(10)-rs(55),y: screenH/2 }

  // Step 2: offset to fan container center
  if (seat==='DOWN')  fy -= (rs(20) + rs(isLocal ? 52 : 8) + CARD_H/2);
  if (seat==='TOP')   fy += (rs(20) + rs(6) + CARD_H/2);
  if (seat==='LEFT')  fx += (rs(60) + rs(-14) + CARD_W/2);
  if (seat==='RIGHT') fx -= (rs(60) + rs(-14) + CARD_W/2);

  // Step 3: arc math
  const n        = Math.min(totalCards, 7);
  const isVert   = seat==='LEFT' || seat==='RIGHT';
  const maxAngle = seat==='DOWN' ? Math.min(n*7,45) : Math.min(n*9,68);
  const arcStart = -maxAngle/2;
  const arcStep  = n<=1 ? 0 : maxAngle/(n-1);
  const arcR     = seat==='DOWN' ? rs(190) : rs(100);
  const angle    = arcStart + arcStep * cardIndex;
  const rad      = angle * Math.PI / 180;

  let tx=0, ty=0, rot=0;
  if (isVert) {
    ty  = Math.sin(rad)*arcR;
    tx  = seat==='RIGHT' ? (1-Math.cos(rad))*arcR : -(1-Math.cos(rad))*arcR;
    rot = seat==='RIGHT' ? 90-angle : -90+angle;
  } else {
    tx  = Math.sin(rad)*arcR;
    ty  = seat==='DOWN' ? (1-Math.cos(rad))*arcR : -(1-Math.cos(rad))*arcR;
    rot = seat==='DOWN' ? angle : -angle;
  }
  // Returns SCREEN coordinates
  return { x: fx+tx, y: fy+ty, rot };
}
```

> Result is screen coords. Subtract `rootScreenPos` + `CARD_W/2` to get translateX for animated.View.

---

## Animation 1: Distribution (`CardDistributionOverlay`)

Deals 5 cards round-robin to each player, then flips starting top card to discard pile.

### Build job list
```ts
const jobs = [];
for (let r = 0; r < 5; r++) {
  players.forEach((p, pi) => {
    const t = getCardInFanPos(p.seat, r, 5, p.isLocal);
    jobs.push({
      key: `${pi}-${r}`,
      targetX: t.x - rootScreenPos.x,  // root-relative
      targetY: t.y - rootScreenPos.y,
      targetRot: t.rot,
      delay: (r * players.length + pi) * 90,
    });
  });
}
// Start card → discard pile
jobs.push({
  key: 'start-card',
  targetX: DISCARD_X, targetY: DISCARD_Y, targetRot: 0,
  delay: (5 * players.length) * 90 + 200,
  isStartCard: true,
});
```

### FlyingCard spring (origin = MARKET pile, root-relative)
```ts
// duration:550, easing: easeOutBack
translateX = p.to(v => MARKET_X + v*(targetX-MARKET_X) - CARD_W/2)
translateY = p.to(v => MARKET_Y + v*(targetY-MARKET_Y) - Math.sin(v*Math.PI)*rs(80) - CARD_H/2)
rotate     = p.to(v => `${v*targetRot + Math.sin(v*Math.PI)*45}deg`)
scale      = p.to(v => 1.3 - v*0.3)
rotateX    = p.to(v => `${Math.sin(v*Math.PI)*40}deg`)
// For start card only: full flip
rotateY    = p.to(v => isStartCard ? `${v*180}deg` : `${Math.sin(v*Math.PI)*15}deg`)
```

### Completion
Track `landedCount` ref. When `landedCount === jobs.length` → `setTimeout(onComplete, 300)`.  
`onComplete` → `setDealing(false)` → assign real hands atomically to all players.

---

## Animation 2: Play Card (`PlayCardAnim`)

Card flies from its fan slot to the discard pile.

### Start position (capture BEFORE splicing card from hand)
```ts
const t = getCardInFanPos(seat, cardIndex, player.cardCount, isLocal);
startX   = t.x - rootScreenPos.x;
startY   = t.y - rootScreenPos.y;
startRot = t.rot;
```

### Spring (duration:580, easeOutBack)
```ts
translateX = p.to(v => startX + v*(DISCARD_X-startX) - CARD_W/2)
translateY = p.to(v => startY + v*(DISCARD_Y-startY) - Math.sin(v*Math.PI)*rs(70) - CARD_H/2)
scale      = p.to(v => 1.2 + Math.sin(v*Math.PI)*0.4 - v*0.2)
rotate     = p.to(v => `${startRot + v*(0-startRot) + Math.sin(v*Math.PI)*20}deg`)
rotateX    = p.to(v => `${Math.sin(v*Math.PI)*30}deg`)
```

Render a `WhotFrontCard` (face-up) during flight.

### onLand safety (ALWAYS use this pattern)
```ts
const fired = useRef(false);
onRest: (result) => {
  if (result.finished && !fired.current) {
    fired.current = true;
    onLand();
  }
}
```

---

## Animation 3: Market Pick (`MarketPickAnim`)

3-phase animation. Spring: `v` goes 0 → 3. Duration: 1100ms, easeOutCubic.

### Reveal point (phase midpoint, root-relative)
```ts
revealX = rootW/2 + (seat==='LEFT' ? -rs(45) : seat==='RIGHT' ? rs(45) : seat==='DOWN' ? rs(60) : 0)
revealY = rootH/2 + (seat==='TOP'  ? -rs(80) : seat==='DOWN'  ? rs(100) : 0)
```

### Fan target for phase 3
```ts
newTotal = totalAtStart + pickIndex + 1   // total after this card
newIndex = totalAtStart + pickIndex        // index of this card in hand
const t  = getCardInFanPos(seat, newIndex, newTotal, isLocal);
targetX  = (fanCenters[seat].x - rootScreenPos.x) + arcOffsetTx;
targetY  = (fanCenters[seat].y - rootScreenPos.y) + arcOffsetTy;
// arcOffsetTx/Ty = the same tx/ty from fan arc math for newIndex in newTotal
```

### Phase transforms
```ts
// Phase 1: v 0→1 (pile → reveal, arc up)
translateX = MARKET_X + v*(revealX-MARKET_X) - CARD_W/2
translateY = MARKET_Y + v*(revealY-MARKET_Y) - Math.sin(v*Math.PI)*rs(45) - CARD_H/2
rotateZ    = `${15 - v*15 + Math.sin(v*Math.PI)*10}deg`
scale      = 1 + v*0.6
rotateY    = '0deg'  // back card showing

// Phase 2: v 1→2 (flip reveal, stationary)
translateX = revealX - CARD_W/2
translateY = revealY - CARD_H/2
rotateY    = `${(v-1)*180}deg`  // card flip 0→180deg
scale      = 1.6
// Back: opacity=1 when rotateY<90, Front: opacity=1 when rotateY>=90
// Front face only shown to LOCAL player

// Phase 3: v 2→3 (reveal → fan slot)
const t = v - 2  // 0→1
translateX = revealX + t*(targetX-revealX) - CARD_W/2
translateY = revealY + t*(targetY-revealY) - Math.sin(t*Math.PI)*rs(30) - CARD_H/2
rotateZ    = `${t*targetRot + Math.sin(t*Math.PI)*5}deg`
scale      = 1.6 - t*0.6
rotateY    = '180deg'
```

### Multiple picks (stacking)
```ts
// Each pick in the batch gets a staggered delay
delay = pickIndex * 1500
// totalAtStart stays fixed for entire batch (player's count before ANY picks)
```

---

## Animation 4: Reshuffle (`ReshuffleAnim`)

12 back-cards fly from DISCARD → MARKET with a full spin.

### Single ReshuffleCard (duration:750, easeInOutQuad)
```ts
translateX = DISCARD_X + v*(MARKET_X-DISCARD_X) - CARD_W/2
translateY = DISCARD_Y + v*(MARKET_Y-DISCARD_Y) - CARD_H/2
scale      = 1 + Math.sin(v*Math.PI)*0.2
rotate     = `${v*360}deg`
opacity    = v < 0.1 ? v*10 : v > 0.9 ? 1-(v-0.9)*5 : 1
```

### Stagger: `delay = cardIndex * 80ms`

### Completion: `landedCount===12` → `setTimeout(onComplete, 400)` → `setMarketCount(42)`

---

## fanCenters Measurement

```tsx
// In CardFan component
const ref = useRef(null);
<View ref={ref} onLayout={() => {
  ref.current?.measureInWindow((x, y, w, h) => {
    fanCenters[seat] = { x: x + w/2, y: y + h/2 };
  });
}} />
```

`fanCenters` is a **stable ref object** (not state) — passed down to MarketPickAnim.  
Fallback to `revealX/revealY` if not yet measured.

---

## rootScreenPos Setup

```tsx
const rootRef = useRef(null);
const [rootScreenPos, setRootScreenPos] = useState({x:0,y:0});
const [rootDimensions, setRootDimensions] = useState({w:SW,h:SH});

<View ref={rootRef} style={StyleSheet.absoluteFill}
  onLayout={e => {
    const {width:w, height:h} = e.nativeEvent.layout;
    setRootDimensions({w,h});
    rootRef.current?.measureInWindow((x,y) => setRootScreenPos({x,y}));
  }}
/>
```

---

## Z-Index Stack

| Z | Component |
|---|---|
| 4000 | PlayCardAnim |
| 3000 | MarketPickAnim |
| 1000 | FlyingCard, ReshuffleCard |
| 50 | PlayerChip |
| 1 | CentralPiles |

---

## Event → Animation Chain

```
whot_init received
  → setDealing(true)
  → CardDistributionOverlay renders all FlyingCard jobs
  → onComplete → setDealing(false) → setPlayers with real hands

Local player plays card
  → capture startPos = getCardInFanPos(seat, idx, count, true)
  → socket.emit('whot_play')
  → setPlayers (splice card)
  → setActivePlay({ start, card, onLand })
  → PlayCardAnim → 580ms
  → onLand: setTopCard, setActivePlay(null), winner check, flush pendingTurn

Remote player plays card (whot_remote_play)
  → capture startPos = getCardInFanPos(seat, idx, count, false)
  → setActivePlay({ start, card, onLand })
  → PlayCardAnim → 580ms
  → onLand: setTopCard, splice card from hand, winner check, flush pendingTurn

Market pick (local or remote)
  → push MarketPick[] to activeMarketPicks (delay = pickIndex*1500)
  → MarketPickAnim renders per item
  → onLand each: add card to player hand, remove from queue
  → activeMarketPicks empty → advance turn

marketCount <= 2
  → setReshuffling(true)
  → ReshuffleAnim → 12 × 80ms stagger
  → onComplete → setMarketCount(42), setReshuffling(false)
```

---

## Common Bugs

| Bug | Fix |
|---|---|
| Card lands at wrong position | Use `measureInWindow`, not layout coords |
| `onLand` fires twice | `fired` ref + `result.finished` check |
| Wrong fan angle after pick | Use `newTotal = totalAtStart + pickIndex + 1` |
| Turn advances mid-animation | `pendingTurnRef` — defer `setTurnIndex` to `onLand` |
| Shape picker closes right away | Never call `setShowShapePicker(false)` when server sends `currentShape: null` |
| Picks land at wrong slot | `totalAtStart` = count before the whole batch, not current |
| Distribution wrong target | `getCardInFanPos` uses `total=5`, not current hand size |
