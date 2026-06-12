import { describe, it, expect } from 'vitest';
import {
  PROJECTS, PROJECT_BY_ID, nextProject, beginProject, projectDone,
  boardHotspotForState, TRAY_UNLOCK_INDEX,
} from './roomStates.js';
import { computeGameBonuses } from './gameBonuses.js';
import { EV } from './events.js';

describe('PROJECTS', () => {
  it('has the 19 projects in story order with unique ids', () => {
    expect(PROJECTS.length).toBe(19);
    expect(new Set(PROJECTS.map(p => p.id)).size).toBe(19);
    expect(PROJECTS[0].id).toBe('draw-board');
    expect(PROJECTS.at(-1).id).toBe('finishing');
  });

  it('every project carries the full shape', () => {
    for (const p of PROJECTS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.teaser.length).toBeGreaterThan(0);
      expect(p.revealLine.length).toBeGreaterThan(0);
      expect(p.cost).toBeGreaterThan(0);
      expect(p.durationMs).toBeGreaterThan(0);
      expect(p.hintPos).toHaveProperty('x');
      expect(p.boardHotspot).toHaveProperty('w');
    }
  });

  it('spec costs spot-check', () => {
    expect(PROJECT_BY_ID['draw-board'].cost).toBe(5);
    expect(PROJECT_BY_ID['couch'].cost).toBe(250);
    expect(PROJECT_BY_ID['finishing'].cost).toBe(250);
    expect(PROJECT_BY_ID['finishing'].durationMs).toBe(4 * 60 * 60 * 1000);
  });

  it('nextProject / beginProject / projectDone flow', () => {
    let save = { roomStateIndex: 0, activeProject: null, pennies: 100 };
    const p = nextProject(save);
    expect(p.id).toBe('draw-board');
    save = beginProject(save, p, 1000);
    expect(save.pennies).toBe(95);
    expect(save.activeProject).toEqual({ id: 'draw-board', completesAt: 1000 + p.durationMs });

    expect(projectDone({ roomStateIndex: 6 }, 'floors')).toBe(true);
    expect(projectDone({ roomStateIndex: 5 }, 'floors')).toBe(false);
    expect(nextProject({ roomStateIndex: 19 })).toBe(null);
  });

  it('board hotspot moves to the table after the coffee table', () => {
    expect(boardHotspotForState(0)).toEqual(boardHotspotForState(8));        // still on the box
    expect(boardHotspotForState(9)).not.toEqual(boardHotspotForState(8));   // table now
  });

  it('the type tray unlocks when gallery-2 is revealed', () => {
    expect(TRAY_UNLOCK_INDEX).toBe(17);
  });
});

describe('computeGameBonuses', () => {
  const hit = { type: EV.BLOT_HIT, player: 'ashton' };
  const gotHit = { type: EV.GOT_HIT, player: 'ashton' };
  const off = { type: EV.PIECE_BORNE_OFF, player: 'ashton' };

  it('double hit fires at 2-3 hits, hit parade at 4+', () => {
    const two = computeGameBonuses({ eventLog: [hit, hit], result: 'loss', pipStats: { ashtonMaxDeficit: 0 } });
    expect(two.map(b => b.id)).toContain('double-hit');
    const four = computeGameBonuses({ eventLog: [hit, hit, hit, hit], result: 'loss', pipStats: { ashtonMaxDeficit: 0 } });
    expect(four.map(b => b.id)).toContain('hit-parade');
    expect(four.map(b => b.id)).not.toContain('double-hit');
  });

  it('bear-off rush needs 4 consecutive', () => {
    const rush = computeGameBonuses({
      eventLog: [off, off, off, off], result: 'win', pipStats: { ashtonMaxDeficit: 0 },
    });
    expect(rush.map(b => b.id)).toContain('bear-off-rush');
    const broken = computeGameBonuses({
      eventLog: [off, off, gotHit, off, off], result: 'win', pipStats: { ashtonMaxDeficit: 0 },
    });
    expect(broken.map(b => b.id)).not.toContain('bear-off-rush');
  });

  it('big comeback only on a win', () => {
    const ctx = { eventLog: [gotHit], result: 'loss', pipStats: { ashtonMaxDeficit: 60 } };
    expect(computeGameBonuses(ctx).map(b => b.id)).not.toContain('big-comeback');
    expect(computeGameBonuses({ ...ctx, result: 'win' }).map(b => b.id)).toContain('big-comeback');
  });
});
