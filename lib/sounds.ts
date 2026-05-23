import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

const SOUND_ENABLED_KEY = 'settings.sound_enabled';
let soundEnabled = true;
let soundPreferenceLoaded = false;
let soundPreferencePromise: Promise<boolean> | null = null;

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


let whotCheckupSound: Audio.Sound | null = null;
let whotContinueSound: Audio.Sound | null = null;
let whotSuspendedSound: Audio.Sound | null = null;
let whotDefendedSound: Audio.Sound | null = null;
let tokenFinishSound: Audio.Sound | null = null;
let snakeDropSound: Audio.Sound | null = null;
let ludoCaptureSound: Audio.Sound | null = null;
let playerFoundSound: Audio.Sound | null = null;
let victorySound: Audio.Sound | null = null;
let loseSound: Audio.Sound | null = null;
let whotGMSounds: Record<string, Audio.Sound | null> = {
  circle: null,
  triangle: null,
  cross: null,
  square: null,
  star: null,
};

function getLoadedSounds(): Audio.Sound[] {
  return [
    buttonSound,
    progressSound,
    diceRollSound,
    moveSound,
    whotReshuffleSound,
    whotCardSound,
    whotHoldOnSound,
    whotPick2Sound,
    whotPick3Sound,
    whotGeneralMarketSound,
    whotLastCardSound,
    whotCheckupSound,
    whotContinueSound,
    whotSuspendedSound,
    whotDefendedSound,
    tokenFinishSound,
    snakeDropSound,
    ludoCaptureSound,
    playerFoundSound,
    victorySound,
    loseSound,
    whotGMSounds.circle,
    whotGMSounds.triangle,
    whotGMSounds.cross,
    whotGMSounds.square,
    whotGMSounds.star,
  ].filter(Boolean) as Audio.Sound[];
}

async function ensureSoundPreferenceLoaded() {
  if (soundPreferenceLoaded) return soundEnabled;
  if (!soundPreferencePromise) {
    soundPreferencePromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
        if (stored != null) {
          soundEnabled = stored === 'true';
        }
      } catch (error) {
        console.log('Failed to load sound preference:', error);
      } finally {
        soundPreferenceLoaded = true;
      }
      return soundEnabled;
    })();
  }
  return soundPreferencePromise;
}

export async function isSoundEnabled() {
  return ensureSoundPreferenceLoaded();
}

export function isSoundEnabledSync() {
  return soundEnabled;
}

export async function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  soundPreferenceLoaded = true;
  soundPreferencePromise = Promise.resolve(enabled);
  try {
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch (error) {
    console.log('Failed to persist sound preference:', error);
  }
  if (!enabled) {
    await Promise.allSettled(
      getLoadedSounds().map(async sound => {
        try {
          await sound.stopAsync();
        } catch {}
      })
    );
  }
}

export async function loadSounds() {
  const enabled = await ensureSoundPreferenceLoaded();
  if (!enabled) return;
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
  if (!whotCheckupSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/checkup.mp3'));
    whotCheckupSound = sound;
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

  if (!victorySound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/victory.mp3'));
    victorySound = sound;
  }

  if (!loseSound) {
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/lose.mp3'));
    loseSound = sound;
  }
}

export async function playButtonSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!buttonSound) await loadSounds();
    if (buttonSound) await buttonSound.replayAsync();
  } catch (error) {
    if (String(error).includes('Player does not exist')) {
      buttonSound = null;
      buttonSound = (await Audio.Sound.createAsync(require('../assets/sounds/button.wav'))).sound;
      await buttonSound.replayAsync();
    } else {
      console.log('Error playing button sound:', error);
    }
  }
}

export async function playDiceRollSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!diceRollSound) await loadSounds();
    if (diceRollSound) {
      await diceRollSound.replayAsync();
    }
  } catch (error) {
    if (String(error).includes('Player does not exist')) {
      diceRollSound = null;
      diceRollSound = (await Audio.Sound.createAsync(require('../assets/sounds/shake-and-roll-dice-soundbible.mp3'))).sound;
      await diceRollSound.replayAsync();
    } else {
      console.log('Error playing dice roll sound:', error);
    }
  }
}

export async function playMoveSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!moveSound) await loadSounds();
    if (moveSound) {
      await moveSound.replayAsync();
    }
  } catch (error) {
    if (String(error).includes('Player does not exist')) {
      moveSound = null;
      moveSound = (await Audio.Sound.createAsync(require('../assets/sounds/button.wav'))).sound;
      await moveSound.replayAsync();
    } else {
      console.log('Error playing move sound:', error);
    }
  }
}

export async function playWhotReshuffleSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
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
    if (!(await ensureSoundPreferenceLoaded())) return;
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
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotHoldOnSound) await loadSounds();
    if (whotHoldOnSound) await whotHoldOnSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotPick2Sound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotPick2Sound) await loadSounds();
    if (whotPick2Sound) await whotPick2Sound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotPick3Sound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotPick3Sound) await loadSounds();
    if (whotPick3Sound) await whotPick3Sound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotGeneralMarketSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotGeneralMarketSound) await loadSounds();
    if (whotGeneralMarketSound) await whotGeneralMarketSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotLastCardSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotLastCardSound) await loadSounds();
    if (whotLastCardSound) await whotLastCardSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotCheckupSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotCheckupSound) await loadSounds();
    if (whotCheckupSound) await whotCheckupSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotContinueSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotContinueSound) await loadSounds();
    if (whotContinueSound) await whotContinueSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotSuspendedSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotSuspendedSound) await loadSounds();
    if (whotSuspendedSound) await whotSuspendedSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotDefendedSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!whotDefendedSound) await loadSounds();
    if (whotDefendedSound) await whotDefendedSound.replayAsync();
  } catch (e) { console.log(e); }
}

export async function playWhotGMSound(shape: string) {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
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
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!tokenFinishSound) await loadSounds();
    if (tokenFinishSound) await tokenFinishSound.replayAsync();
  } catch (e) { console.log('Error playing token finish sound:', e); }
}

export async function playSnakeDropSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!snakeDropSound) await loadSounds();
    if (snakeDropSound) await snakeDropSound.replayAsync();
  } catch (e) { console.log('Error playing snake drop sound:', e); }
}

export async function playLudoCaptureSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!ludoCaptureSound) await loadSounds();
    if (ludoCaptureSound) await ludoCaptureSound.replayAsync();
  } catch (e) { console.log('Error playing ludo capture sound:', e); }
}

export async function playPlayerFoundSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!playerFoundSound) await loadSounds();
    if (playerFoundSound) await playerFoundSound.replayAsync();
  } catch (e) { console.log('Error playing player found sound:', e); }
}

export async function playVictorySound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!victorySound) await loadSounds();
    if (victorySound) await victorySound.replayAsync();
  } catch (e) { console.log('Error playing victory sound:', e); }
}

export async function playLoseSound() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
    if (!loseSound) await loadSounds();
    if (loseSound) await loseSound.replayAsync();
  } catch (e) { console.log('Error playing lose sound:', e); }
}

export async function startProgressLoop() {
  try {
    if (!(await ensureSoundPreferenceLoaded())) return;
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
