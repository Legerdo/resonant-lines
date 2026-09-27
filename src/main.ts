import './ui/styles.css';
import { App } from './app/app.ts';
import { createGame } from './presentation/game.ts';
import { installTestApi } from './debug/testApi.ts';

const params = new URLSearchParams(location.search);
const debugEnabled = import.meta.env.DEV || params.has('debug');
const testEnabled = import.meta.env.DEV || params.has('e2e');

function safeStorage(): Storage | null {
  try {
    const k = '__probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

const viewport = document.getElementById('viewport')!;
const stage = document.getElementById('stage')!;
const uiRoot = document.getElementById('ui')!;
const app = new App(viewport, uiRoot, stage, safeStorage(), debugEnabled);
const game = createGame(stage, {
  ready: (scene, assets) => app.ready(scene, assets),
  frame: (dt) => app.frame(dt),
});
if (testEnabled) installTestApi(app, game);
