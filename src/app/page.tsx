'use client';
import Canvas from '@/lib/components/Canvas';
import Forms from '@/lib/components/Forms';
import { Progress } from '@/lib/components/Progress';
import StoreProvider from '@/lib/components/StoreProvider';
import styles from './page.module.scss';

const canvasWd = 1280;
const canvasHt = 720;

export default function Home() {
  return (
    <StoreProvider>
      <main className={styles.main} style={{ width: `${canvasWd}px` }}>
        <Canvas canvasWd={canvasWd} canvasHt={canvasHt} />
        <Progress />
        <Forms />
      </main>
    </StoreProvider>
  );
}
