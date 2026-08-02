import { html, useMemo } from '../../lib/preact.js';

const GRADE_FILL = {
  A: 1.0,
  B: 0.8,
  C: 0.6,
  D: 0.4,
  F: 0.2,
};

/**
 * HealthGrade({ grade, label, size })
 * A–F in ring. Tone by grade.
 */
export function HealthGrade({ grade = '?', label, size = 64 }) {
  const r = (size / 2) - 6;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const fill = GRADE_FILL[grade] ?? 0;
  const dash = fill * circumference;
  const gap = circumference - dash;

  const letterSize = Math.round(size * 0.38);

  const arcClass = `ui-health-grade__arc ui-health-grade__arc--${grade}`;

  return html`
    <div class="ui-health-grade">
      <div class="ui-health-grade__ring" style=${{ width: size, height: size }}>
        <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
          <circle
            class="ui-health-grade__track"
            cx=${cx}
            cy=${cy}
            r=${r}
          />
          <circle
            class=${arcClass}
            cx=${cx}
            cy=${cy}
            r=${r}
            stroke-dasharray=${`${dash} ${gap}`}
            stroke-dashoffset=${0}
          />
        </svg>
        <div
          class="ui-health-grade__letter"
          aria-label=${`Grade ${grade}`}
          style=${{ fontSize: `${letterSize}px` }}
        >
          ${grade}
        </div>
      </div>
      ${label && html`<div class="ui-health-grade__label">${label}</div>`}
    </div>
  `;
}

export default HealthGrade;
