export { h, render, Component } from '../../vendor/preact.module.js';
export {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from '../../vendor/preact-hooks.module.js';
import { h } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';

export const html = htm.bind(h);
