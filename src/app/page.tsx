'use client';
import Canvas from '@/lib/components/Canvas';
import Forms from '@/lib/components/Forms';
import { Progress } from '@/lib/components/Progress';
import StoreProvider from '@/lib/components/StoreProvider';
import { defaultCanvasVars } from '@/lib/types/CanvasVars';
import styles from './page.module.scss';

export default function Home() {
  return (
    <StoreProvider>
      <main className={styles.main} style={{ width: `${defaultCanvasVars.canvasWd}px` }}>
        <Canvas />
        <Progress />
        <Forms />
      </main>
    </StoreProvider>
  );
}
