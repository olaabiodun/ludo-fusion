import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

const ASSETS_TO_PRELOAD = [
  require('@/assets/images/tokeng.png'),
  require('@/assets/images/tokeny.png'),
  require('@/assets/images/tokenb.png'),
  require('@/assets/images/tokenr.png'),
  require('@/assets/images/sk1.png'),
  require('@/assets/images/sk2.png'),
  require('@/assets/images/sk4.png'),
  require('@/assets/images/sk5.png'),
  require('@/assets/images/sk6.png'),
  require('@/assets/images/snake.png'),
  require('@/assets/images/ludo.png'),
  require('@/assets/images/whot.png'),
];

export function AssetPreloader() {
  const [mounted, setMounted] = React.useState(true);

  React.useEffect(() => {
    // Unmount after 8 seconds to free up GPU memory and UI threads
    const timer = setTimeout(() => {
      console.log('[AssetPreloader] Preload complete, unmounting background assets.');
      setMounted(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <View 
      pointerEvents="none"
      style={{ 
        position: 'absolute', 
        opacity: 0, 
        width: 1, 
        height: 1, 
        top: -1000,
        left: -1000 
      }} 
    >
      {ASSETS_TO_PRELOAD.map((src: any, idx: number) => (
        <Image 
          key={`preload-${idx}`} 
          source={src} 
          style={{ width: 1, height: 1 }} 
          onLoad={() => console.log(`[AssetPreloader] Loaded asset ${idx + 1}/${ASSETS_TO_PRELOAD.length}`)}
        />
      ))}
    </View>
  );
}

export async function preloadGameAssets() {
  // Obsolete: Now handled by rendering <AssetPreloader /> to avoid Android Kotlin crashes with module IDs.
}
