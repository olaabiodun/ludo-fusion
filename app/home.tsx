import { BottomBar } from '@/components/BottomBar';
import { FriendsPanel } from '@/components/FriendsPanel';
import { GameLobbyScreen } from '@/components/Gamelobby';
import { HistoryPanel } from '@/components/HistoryPanel';
import { InboxPanel } from '@/components/InboxModal';
import { LeaderboardPanel } from '@/components/LeaderboardPanel';
import { MemberPanel } from '@/components/MemberPanel';
import { ProfilePanel } from '@/components/ProfilePanel';
import { ReferralPanel } from '@/components/ReferralPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Sidebar, type SidebarNav } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { WalletPanel } from '@/components/WalletPanel';
import { LinearGradient } from 'expo-linear-gradient';
import { playButtonSound } from '@/lib/sounds';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const C = {
  darkGreen: '#0A2318',
  gold: '#D4AF37',
  goldBorder: 'rgba(212,175,55,0.5)',
  cardGreen: '#0D2A1C',
};

type AppNav = SidebarNav | 'REFERRAL' | 'MEMBER';

const GAME_CARDS = [
  {
    id: 'fusion',
    title: '',
    desc: '',
    borderColor: C.gold,
    glowColor: 'rgba(212,175,55,0.4)',
    image: require('@/assets/images/card1.png'),
    tag: '',
    btnText: '',
    theme: 'gold',
    isFeatured: true,
    artAlign: 'center',
  },
  {
    id: 'whot',
    title: 'CLASSIC WHOT',
    desc: 'Use strategy and be\nthe last one standing',
    borderColor: '#E43C39',
    glowColor: 'rgba(228,60,57,0.3)',
    image: require('@/assets/images/card3.png'),
    btnText: 'PLAY NOW',
    theme: 'red',
    artAlign: 'center',
  },
  {
    id: 'snake_ladder',
    title: 'SNAKE LADDER',
    desc: 'Climb the ladders and\navoid the snakes!',
    borderColor: '#39C65B',
    glowColor: 'rgba(57,198,91,0.3)',
    image: require('@/assets/images/card5.png'),
    btnText: 'PLAY NOW',
    theme: 'green',
    artAlign: 'center',
  },
  {
    id: 'tournaments',
    title: 'TOURNAMENTS',
    desc: 'Compete in tournaments\n& win big prizes',
    borderColor: '#238DE5',
    glowColor: 'rgba(35,141,229,0.3)',
    image: require('@/assets/images/card2.png'),
    btnText: 'EXPLORE',
    theme: 'blue',
    artAlign: 'center',
  },
] as const;

type GameCardProps = typeof GAME_CARDS[number] & {
  index: number;
  onPress?: () => void;
};

function CardPattern({ theme, isFeatured }: { theme: GameCardProps['theme']; isFeatured?: boolean }) {
  const tint =
    theme === 'gold' ? 'rgba(212,175,55,0.28)' :
      theme === 'green' ? 'rgba(57,198,91,0.24)' :
        theme === 'red' ? 'rgba(228,60,57,0.24)' :
          'rgba(35,141,229,0.24)';

  return (
    <View pointerEvents="none" style={s.cardPattern}>
      <View style={[s.patternCrown, { borderColor: tint }]} />
      <View style={[s.patternLaurelLeft, { borderColor: tint }]} />
      <View style={[s.patternLaurelRight, { borderColor: tint }]} />
      {isFeatured && (
        <>
          <View style={[s.featureSpark, s.featureSparkOne]} />
          <View style={[s.featureSpark, s.featureSparkTwo]} />
          <View style={[s.featureSpark, s.featureSparkThree]} />
        </>
      )}
    </View>
  );
}

function AnimatedGameCard({ title, desc, borderColor, glowColor, image, index, tag, btnText, theme, isFeatured, onPress, imageScale }: GameCardProps & { imageScale?: number }) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, [fadeAnim, index, shimmer, slideAnim]);

  const onPressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  };

  const bgGrad = theme === 'gold'
    ? ['rgba(0,0,0,0.04)', 'rgba(3,24,12,0.22)', 'rgba(3,17,9,0.72)', 'rgba(0,0,0,0.96)']
    : theme === 'green'
      ? ['rgba(4,40,18,0.06)', 'rgba(4,35,18,0.36)', 'rgba(0,0,0,0.88)']
      : theme === 'red'
        ? ['rgba(65,0,0,0.08)', 'rgba(50,0,0,0.42)', 'rgba(0,0,0,0.9)']
        : ['rgba(0,20,70,0.08)', 'rgba(0,24,65,0.42)', 'rgba(0,0,0,0.9)'];

  if (isFeatured) {
    return (
      <Animated.View
        style={{
          height: '100%',
          transform: [{ translateY: slideAnim }, { scale: pressScale }],
          opacity: fadeAnim,

        }}
      >
        <TouchableOpacity
          style={{ height: '100%' }}
          activeOpacity={0.95}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onPress}
        >
          <Image
            source={image}
            style={{ height: '100%', width: '100%', aspectRatio: 0.8, }}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        s.cardContainer,
        s.cardRegular,
        {
          transform: [{ translateY: slideAnim }, { scale: pressScale }],
          opacity: fadeAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={s.cardTouchable}
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
      >
        <Animated.View style={[s.cardOuterGlow, { backgroundColor: glowColor, opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] }) }]} />

        <View style={[s.gameCard, { borderColor }]}>
          <Image
            source={image}
            style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%', opacity: 0.98, transform: [{ scale: imageScale || 1 }] }]}
            resizeMode="cover"
          />

          <LinearGradient
            colors={bgGrad as any}
            style={StyleSheet.absoluteFill}
            locations={[0, 0.5, 1]}
          />
          <CardPattern theme={theme} isFeatured={false} />

          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0)', 'rgba(212,175,55,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cardGlass}
          />
          <View style={[s.cardInnerStroke, { borderColor: `${borderColor}66` }]} />

          {tag ? (
            <View style={s.ribbonWrapper}>
              <View style={s.ribbon}>
                <Text style={s.ribbonText}>{tag}</Text>
              </View>
            </View>
          ) : null}

          <View style={[s.cardContent, s.cardContentRegular]}>

            {title ? <Text style={s.cardTitle}>{title}</Text> : null}
            {desc ? <Text style={s.cardDesc}>{desc}</Text> : null}

            {btnText ? (
              <View style={[s.cardBtnWrap, { shadowColor: borderColor }]}>
                <LinearGradient
                  colors={
                    theme === 'green' ? ['rgba(57,198,91,0.2)', 'rgba(57,198,91,0.05)'] :
                      theme === 'red' ? ['rgba(228,60,57,0.2)', 'rgba(228,60,57,0.05)'] :
                        ['rgba(35,141,229,0.2)', 'rgba(35,141,229,0.05)']
                  }
                  style={[s.cardBtn, { borderColor: borderColor, borderWidth: 1 }]}
                >
                  <Text style={[s.cardBtnText, { color: '#FFF' }]}>{btnText}</Text>
                  <View style={[s.btnArrowCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <Text style={[s.btnArrowText, { color: '#FFF' }]}>{'>'}</Text>
                  </View>
                </LinearGradient>
              </View>
            ) : null}

          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function PlaceholderScreen({ activeNav }: { activeNav: Exclude<SidebarNav, 'HOME'> }) {
  return (
    <View style={s.placeholderCard}>
      <Text style={s.placeholderTag}>MENU SCREEN</Text>
      <Text style={s.placeholderTitle}>{activeNav}</Text>
      <Text style={s.placeholderText}>
        This is a {activeNav.toLowerCase()} screen.
      </Text>
    </View>
  );
}

export default function LudoRoyaleHome() {
  const [activeNav, setActiveNav] = useState<AppNav>('HOME');
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [walletAction, setWalletAction] = useState<'deposit' | 'withdrawal' | undefined>(undefined);
  const [inboxTab, setInboxTab] = useState<any>('all');
  const [globalSearching, setGlobalSearching] = useState(false);
  const [searchingParams, setSearchingParams] = useState<any>(null);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const titleGlow = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(0)).current;
  const isMainHome = activeNav === 'HOME' && !selectedGame;

  useEffect(() => {
    Animated.timing(screenFade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(titleGlow, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(titleGlow, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    const refSub = DeviceEventEmitter.addListener('open_referral', () => {
      setActiveNav('REFERRAL');
    });

    const inboxSub = DeviceEventEmitter.addListener('open_inbox', (data: any) => {
      setInboxTab(data?.tab || 'all');
      setActiveNav('INBOX');
    });

    const memberSub = DeviceEventEmitter.addListener('open_member', () => {
      setActiveNav('MEMBER');
    });

    return () => {
      refSub.remove();
      inboxSub.remove();
      memberSub.remove();
    };
  }, [floatAnim, screenFade, titleGlow]);

  const titleOpacity = titleGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  const panelTitle = activeNav === 'HOME' ? 'CHOOSE YOUR GAME' : activeNav === 'INBOX' ? 'YOUR INBOX' : ``;
  const showPanelTitle = activeNav === 'HOME' && !selectedGame;

  return (
    <Animated.View style={[s.screen, { opacity: screenFade }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={[C.darkGreen, '#05110B', '#000000']} style={StyleSheet.absoluteFill} />

      <TopBar
        onSettingsPress={() => setActiveNav('SETTINGS')}
        onInboxPress={() => {
          setInboxTab('all');
          setActiveNav('INBOX');
        }}
        onAddFundsPress={() => {
          setWalletAction('deposit');
          setActiveNav('WALLET');
        }}
        onWithdrawPress={() => {
          setWalletAction('withdrawal');
          setActiveNav('WALLET');
        }}
      />
      <View style={s.main}>
        <View style={s.sidebarCol}>
          <Sidebar
            activeNav={activeNav}
            onNavChange={(nav) => {
              setActiveNav(nav);
              if (nav === 'HOME') setSelectedGame(null);
              if (nav !== 'WALLET') setWalletAction(undefined);
            }}
          />
          {!isMainHome && <BottomBar forceHome={false} searching={globalSearching} />}
        </View>

        <View style={[s.content, isMainHome && !selectedGame && { paddingBottom: 80 }, selectedGame && { paddingHorizontal: 0, paddingTop: 0 }]}>
          {showPanelTitle ? (
            <Animated.View style={[s.modeTitleRow, { transform: [{ translateY: floatAnim }] }]}>
              <View style={s.modeLine} />
              <Animated.Text style={[s.modeTitle, { opacity: titleOpacity }]}>
                {panelTitle}
              </Animated.Text>
              <View style={s.modeLine} />
            </Animated.View>
          ) : null}

          {activeNav === 'HOME' ? (
            selectedGame ? (
              <View style={StyleSheet.absoluteFill}>
                <GameLobbyScreen
                  gameMode={selectedGame as any}
                  searching={globalSearching}
                  onSearchingChange={(s, params) => {
                    setGlobalSearching(s);
                    if (params) setSearchingParams(params);
                  }}
                  onBack={() => {
                    setSelectedGame(null);
                    setActiveNav('HOME');
                  }}
                />
              </View>
            ) : (
              <View style={s.cardsRow}>
                {GAME_CARDS.map((card, index) => (
                  <AnimatedGameCard
                    key={card.id}
                    {...card}
                    index={index}
                    onPress={() => {
                      playButtonSound();
                      setSelectedGame(card.id === 'fusion' ? 'ludo' : card.id === 'tournaments' ? 'ludo_t' : card.id as any);
                    }}
                  />
                ))}
              </View>
            )
          ) : activeNav === 'PROFILE' ? (
            <ProfilePanel />
          ) : activeNav === 'LEADERBOARD' ? (
            <LeaderboardPanel />
          ) : activeNav === 'WALLET' ? (
            <WalletPanel initialAction={walletAction} />
          ) : activeNav === 'FRIENDS' ? (
            <FriendsPanel />
          ) : activeNav === 'HISTORY' ? (
            <HistoryPanel />
          ) : activeNav === 'SETTINGS' ? (
            <SettingsPanel />
          ) : activeNav === 'INBOX' ? (
            <InboxPanel visible={true} onClose={() => setActiveNav('HOME')} initialTab={inboxTab} />
          ) : activeNav === 'MEMBER' ? (
            <MemberPanel visible={true} onClose={() => setActiveNav('HOME')} />
          ) : activeNav === 'REFERRAL' ? (
            <ReferralPanel visible={true} onClose={() => setActiveNav('HOME')} />
          ) : (
            <PlaceholderScreen activeNav={activeNav as any} />
          )}

          {isMainHome && !selectedGame && (
            <View style={s.homeBottomBarWrap}>
              <BottomBar forceHome={true} searching={globalSearching} />
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarCol: {
    width: 168,
  },
  homeBottomBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: -168, // span across sidebar
    right: -12, // adjust for content padding if needed
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 2,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  modeTitle: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  modeLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.goldBorder,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    paddingHorizontal: 10,
  },
  cardContainer: {
    position: 'relative',
    height: '100%',
    paddingTop: 4,
    paddingBottom: 8,
  },
  cardFeatured: {
    aspectRatio: 0.5,
  },
  cardRegular: {
    flex: 1,
  },
  cardOuterGlow: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    borderRadius: 20,
  },
  cardTouchable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gameCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.4,
    backgroundColor: '#050B08',
    overflow: 'hidden',
    position: 'relative',
  },
  gameCardFeatured: {
    borderRadius: 22,
    borderWidth: 2,
  },
  cardAssetImage: {
    width: '90%',
    height: '42%',
    alignSelf: 'center',
    marginTop: '15%',
    zIndex: 2,
  },
  cardAssetImageFeatured: {
    width: '94%',
    height: '38%',
    marginTop: '15%',
  },
  cardPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  patternCrown: {
    position: 'absolute',
    top: '11%',
    alignSelf: 'center',
    width: '42%',
    height: '24%',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    opacity: 0.42,
  },
  patternLaurelLeft: {
    position: 'absolute',
    left: '12%',
    top: '16%',
    width: '18%',
    height: '34%',
    borderLeftWidth: 2,
    borderRadius: 80,
    transform: [{ rotate: '-18deg' }],
    opacity: 0.35,
  },
  patternLaurelRight: {
    position: 'absolute',
    right: '12%',
    top: '16%',
    width: '18%',
    height: '34%',
    borderRightWidth: 2,
    borderRadius: 80,
    transform: [{ rotate: '18deg' }],
    opacity: 0.35,
  },
  featureSpark: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFF3AA',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  featureSparkOne: {
    left: '8%',
    top: '42%',
  },
  featureSparkTwo: {
    right: '7%',
    top: '50%',
  },
  featureSparkThree: {
    left: '50%',
    top: '8%',
  },
  cardGlass: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  cardInnerStroke: {
    position: 'absolute',
    left: 5,
    right: 5,
    top: 5,
    bottom: 5,
    borderRadius: 16,
    borderWidth: 1,
    opacity: 0.82,
  },
  ribbonWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    width: 112,
    height: 112,
    zIndex: 2,
  },
  ribbon: {
    backgroundColor: '#39C65B',
    paddingVertical: 4,
    paddingHorizontal: 34,
    transform: [{ rotate: '-30deg' }, { translateX: -24 }, { translateY: -8 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 4,
  },
  ribbonText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 12,
    alignItems: 'center',
    zIndex: 3,
  },
  cardContentFeatured: {
    justifyContent: 'flex-end',
    paddingBottom: 22,
  },
  cardContentRegular: {
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  cardTitleFeatured: {
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: 1.2,
    marginBottom: 5,
    textShadowColor: 'rgba(212,175,55,0.4)',
    textShadowRadius: 12,
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 12,
    fontWeight: '600',
  },
  cardDescFeatured: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  cardBtnWrap: {
    marginTop: 12,
    width: '100%',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  cardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    width: '100%',
    position: 'relative',
  },
  cardBtnFeatured: {
    paddingVertical: 14,
    borderRadius: 28,
  },
  cardBtnText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  btnArrowCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
  },
  btnArrowText: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  placeholderCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.goldBorder,
    backgroundColor: 'rgba(8, 20, 14, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholderTag: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  placeholderTitle: {
    color: C.gold,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
  },
});
