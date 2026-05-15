import { Audio } from 'expo-av';

let buttonSound: Audio.Sound | null = null;
let progressSound: Audio.Sound | null = null;
let diceRollSound: Audio.Sound | null = null;
let moveSound: Audio.Sound | null = null;
let whotReshuffleSound: Audio.Sound | null = null;
let whotCardSound: Audio.Sound | null = null;
let whotHoldOnSound: Audio.Sound | null = null;
let whotPick2Sound: Audio.Sound | null = null;
let whotPick3Sound: Audio.Sound | null = null;
let whotGeneralMarketSound: Audio.Sound | null = null;
let whotLastCardSound: Audio.Sound | null = null;
let whotContinueSound: Audio.Sound | null = null;
let whotSuspendedSound: Audio.Sound | null = null;
let whotDefendedSound: Audio.Sound | null = null;
let tokenFinishSound: Audio.Sound | null = null;
let snakeDropSound: Audio.Sound | null = null;
let ludoCaptureSound: Audio.Sound | null = null;
let playerFoundSound: Audio.Sound | null = null;
let whotGMSounds: Record<string, Audio.Sound | null> = {
  circle: null,
  triangle: null,
  cross: null,
  square: null,
  star: null,
};

export async function loadSounds() {
  if (buttonSound && progressSound && diceRollSound && moveSound) return;

  // Ensure sounds play on iOS even if the silent switch is ON
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    playThroughEarpieceAndroid: false,
  });

  if (!buttonSound) {
    const { sound: bSound } = await Audio.Sound.createAsync(
      require('../assets/sounds/button.wav')
    );
    buttonSound = bSound;
  }

  if (!progressSound) {
    const { sound: pSound } = await Audio.Sound.createAsync(
      require('../assets/sounds/progress_loop.wav')
    );
    progressSound = pSound;
    await progressSound.setIsLoopingAsync(true);
  }

  if (!diceRollSound) {
    const { sound: dSound } = await Audio.Sound.createAsync(
      require('../assets/sounds/shake-and-roll-dice-soundbible.mp3')
    );
    diceRollSound = dSound;
  }

  if (!moveSound) {
    const { sound: mSound } = await Audio.Sound.createAsync(
      require('../assets/sounds/button.wav')
    );
    moveSound = mSound;
  }

  if (!whotReshuffleSound) {
    const { sound: rSound } = await Audio.Sound.createAsync(
      require('../assets/sounds/whotreshuffle.mp3')
    );
    whotReshuffleSound = rSound;
  }

  if (!whotCardSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/whot1.mp3'));
    whotCardSound = sound;
  }

  if (!whotHoldOnSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/holdon.mp3'));
    whotHoldOnSound = sound;
  }
  if (!whotPick2Sound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/pick2.mp3'));
    whotPick2Sound = sound;
  }
  if (!whotPick3Sound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/pick3.mp3'));
    whotPick3Sound = sound;
  }
  if (!whotGeneralMarketSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/generalmarket.mp3'));
    whotGeneralMarketSound = sound;
  }
  if (!whotLastCardSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/lastcard.mp3'));
    whotLastCardSound = sound;
  }
  if (!whotContinueSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/continue.mp3'));
    whotContinueSound = sound;
  }
  if (!whotSuspendedSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/suspended.mp3'));
    whotSuspendedSound = sound;
  }
  if (!whotDefendedSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/defended.mp3'));
    whotDefendedSound = sound;
  }
  
  if (!whotGMSounds.circle) {
    const { sound: sCircle } = await Audio.Sound.createAsync(require('../assets/sounds/gmcircle.mp3'));
    const { sound: sTri } = await Audio.Sound.createAsync(require('../assets/sounds/gmtriangle.mp3'));
    const { sound: sCross } = await Audio.Sound.createAsync(require('../assets/sounds/gmcross.mp3'));
    const { sound: sBox } = await Audio.Sound.createAsync(require('../assets/sounds/gmbox.mp3'));
    const { sound: sStar } = await Audio.Sound.createAsync(require('../assets/sounds/gmstar.mp3'));
    whotGMSounds = { circle: sCircle, triangle: sTri, cross: sCross, square: sBox, star: sStar };
  }

  if (!tokenFinishSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/tokenfinish.mp3'));
    tokenFinishSound = sound;
  }

  if (!snakeDropSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/snakedrop.wav'));
    snakeDropSound = sound;
  }

  if (!ludoCaptureSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/Capture.mp3'));
    ludoCaptureSound = sound;
  }

  if (!playerFoundSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/playerfound.mp3'));
    playerFoundSound = sound;
  }
}

export async function playButtonSound() {
  try {
    if (!buttonSound) await loadSounds();
    if (buttonSound) await buttonSound.replayAsync();
  } catch (error) {
    console.log('Error playing button sound:', error);
  }
}

export async function playDiceRollSound() {
  try {
    if (!diceRollSound) await loadSounds();
    if (diceRollSound) {
      await diceRollSound.replayAsync();
    }
  } catch (error) {
    console.log('Error playing dice roll sound:', error);
  }
}

export async function playMoveSound() {
  try {
    if (!moveSound) await loadSounds();
    if (moveSound) {
      await moveSound.replayAsync();
    }
  } catch (error) {
    console.log('Error playing move sound:', error);
  }
}

export async function playWhotReshuffleSound() {
  try {
    if (!whotReshuffleSound) await loadSounds();
    if (whotReshuffleSound) {
      await whotReshuffleSound.replayAsync();
    }
  } catch (error) {
    console.log('Error playing reshuffle sound:', error);
  }
}

export async function playWhotCardSound() {
  try {
    if (!whotCardSound) await loadSounds();
    if (whotCardSound) {
      await whotCardSound.replayAsync();
    }
  } catch (error) {
    console.log('Error playing whot card sound:', error);
  }
}

export async function playWhotHoldOnSound() {
  try {
    if (!whotHoldOnSound) await loadSounds();
    if (whotHoldOnSound) await whotHoldOnSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotPick2Sound() {
  try {
    if (!whotPick2Sound) await loadSounds();
    if (whotPick2Sound) await whotPick2Sound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotPick3Sound() {
  try {
    if (!whotPick3Sound) await loadSounds();
    if (whotPick3Sound) await whotPick3Sound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotGeneralMarketSound() {
  try {
    if (!whotGeneralMarketSound) await loadSounds();
    if (whotGeneralMarketSound) await whotGeneralMarketSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotLastCardSound() {
  try {
    if (!whotLastCardSound) await loadSounds();
    if (whotLastCardSound) await whotLastCardSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotContinueSound() {
  try {
    if (!whotContinueSound) await loadSounds();
    if (whotContinueSound) await whotContinueSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotSuspendedSound() {
  try {
    if (!whotSuspendedSound) await loadSounds();
    if (whotSuspendedSound) await whotSuspendedSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotDefendedSound() {
  try {
    if (!whotDefendedSound) await loadSounds();
    if (whotDefendedSound) await whotDefendedSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotGMSound(shape: string) {
  try {
    const sound = whotGMSounds[shape];
    if (sound) await sound.replayAsync();
    else {
      await loadSounds();
      const soundRetry = whotGMSounds[shape];
      if (soundRetry) await soundRetry.replayAsync();
    }
  } catch (e) { console.log(e); }
}

export async function playTokenFinishSound() {
  try {
    if (!tokenFinishSound) await loadSounds();
    if (tokenFinishSound) await tokenFinishSound.replayAsync();
  } catch (e) { console.log('Error playing token finish sound:', e); }
}

export async function playSnakeDropSound() {
  try {
    if (!snakeDropSound) await loadSounds();
    if (snakeDropSound) await snakeDropSound.replayAsync();
  } catch (e) { console.log('Error playing snake drop sound:', e); }
}

export async function playLudoCaptureSound() {
  try {
    if (!ludoCaptureSound) await loadSounds();
    if (ludoCaptureSound) await ludoCaptureSound.replayAsync();
  } catch (e) { console.log('Error playing ludo capture sound:', e); }
}

export async function playPlayerFoundSound() {
  try {
    if (!playerFoundSound) await loadSounds();
    if (playerFoundSound) await playerFoundSound.replayAsync();
  } catch (e) { console.log('Error playing player found sound:', e); }
}

export async function startProgressLoop() {
  try {
    if (!progressSound) await loadSounds();
    if (progressSound) {
      await progressSound.playAsync();
    }
  } catch (error) {
    console.log('Error starting progress loop:', error);
  }
}

export async function stopProgressLoop() {
  try {
    if (progressSound) {
      await progressSound.stopAsync();
    }
  } catch (error) {
    console.log('Error stopping progress loop:', error);
  }
}
