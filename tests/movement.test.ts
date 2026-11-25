import { describe, expect, it } from "vitest";
import { ASSIST_TUNING, TUNING } from "../src/config/constants";
import { initialMoveState, maxJumpHeight, stepMovement, type MoveInput, type MoveState } from "../src/systems/movement";

const none: MoveInput = { left: false, right: false, jumpHeld: false, jumpPressed: false, sprint: false };
const ctx = (grounded: boolean, dtMs = 16.67, extra: Partial<Parameters<typeof stepMovement>[2]> = {}) => ({
  grounded,
  ceiling: false,
  dtMs,
  tuning: TUNING,
  airJumps: 0,
  locked: false,
  ...extra,
});

/** Simulates a flat-ground world: ground at y = 0, positive y is down. */
function simulate(frames: Array<Partial<MoveInput>>, dtMs = 16.67, extra: Partial<Parameters<typeof stepMovement>[2]> = {}) {
  let s: MoveState = initialMoveState();
  let y = 0;
  let minY = 0;
  const events: string[] = [];
  for (const f of frames) {
    const grounded = y >= 0 && s.vy >= 0;
    const r = stepMovement(s, { ...none, ...f }, ctx(grounded, dtMs, extra));
    s = r.state;
    events.push(...r.events);
    y += (s.vy * dtMs) / 1000;
    if (y > 0) {
      y = 0;
    }
    minY = Math.min(minY, y);
  }
  return { s, y, minY, events };
}

describe("movement controller", () => {
  it("accelerates to walking speed and stops smoothly", () => {
    let s = initialMoveState();
    for (let i = 0; i < 60; i++) s = stepMovement(s, { ...none, right: true }, ctx(true)).state;
    expect(s.vx).toBeCloseTo(TUNING.walkSpeed, 0);
    let frames = 0;
    while (s.vx > 0 && frames < 60) {
      s = stepMovement(s, none, ctx(true)).state;
      frames++;
    }
    expect(frames).toBeGreaterThan(2); // not an instant stop...
    expect(frames).toBeLessThan(15); // ...but quick
  });

  it("sprints faster than it walks", () => {
    let s = initialMoveState();
    for (let i = 0; i < 90; i++) s = stepMovement(s, { ...none, right: true, sprint: true }, ctx(true)).state;
    expect(s.vx).toBeCloseTo(TUNING.sprintSpeed, 0);
  });

  it("variable jump: a tap is lower than a held jump", () => {
    const held = simulate([{ jumpPressed: true, jumpHeld: true }, ...Array(60).fill({ jumpHeld: true })]);
    const tap = simulate([{ jumpPressed: true, jumpHeld: true }, { jumpHeld: true }, ...Array(60).fill({})]);
    expect(-held.minY).toBeGreaterThan(-tap.minY * 1.6);
    expect(-held.minY).toBeCloseTo(maxJumpHeight(TUNING), -1);
  });

  it("is frame-rate independent (30 vs 60 vs 144 fps give the same jump height)", () => {
    const h = (fps: number) => {
      const dt = 1000 / fps;
      const n = Math.round(fps * 1.2);
      return -simulate([{ jumpPressed: true, jumpHeld: true }, ...Array(n).fill({ jumpHeld: true })], dt).minY;
    };
    expect(Math.abs(h(30) - h(60))).toBeLessThan(5);
    expect(Math.abs(h(144) - h(60))).toBeLessThan(3);
  });

  it("coyote time: can still jump shortly after leaving a ledge", () => {
    let s = initialMoveState();
    s = stepMovement(s, none, ctx(true)).state;
    // 4 frames in the air (~66 ms) then press jump.
    for (let i = 0; i < 4; i++) s = stepMovement(s, none, ctx(false)).state;
    const r = stepMovement(s, { ...none, jumpPressed: true, jumpHeld: true }, ctx(false));
    expect(r.events).toContain("jump");
  });

  it("no jump long after leaving a ledge (without boots)", () => {
    let s = initialMoveState();
    s = stepMovement(s, none, ctx(true)).state;
    for (let i = 0; i < 20; i++) s = stepMovement(s, none, ctx(false)).state;
    const r = stepMovement(s, { ...none, jumpPressed: true, jumpHeld: true }, ctx(false));
    expect(r.events).not.toContain("jump");
  });

  it("jump buffering: pressing just before landing still jumps", () => {
    let s = initialMoveState();
    s.grounded = false;
    s.vy = 200;
    s = stepMovement(s, { ...none, jumpPressed: true, jumpHeld: true }, ctx(false)).state;
    s = stepMovement(s, { ...none, jumpHeld: true }, ctx(false)).state;
    const r = stepMovement(s, { ...none, jumpHeld: true }, ctx(true));
    expect(r.events).toContain("jump");
  });

  it("Thruster Boots give exactly one air jump, reset on landing", () => {
    let s = initialMoveState();
    s = stepMovement(s, { ...none, jumpPressed: true, jumpHeld: true }, ctx(true, 16.67, { airJumps: 1 })).state;
    for (let i = 0; i < 30; i++) s = stepMovement(s, { ...none, jumpHeld: true }, ctx(false, 16.67, { airJumps: 1 })).state;
    let r = stepMovement(s, { ...none, jumpPressed: true, jumpHeld: true }, ctx(false, 16.67, { airJumps: 1 }));
    expect(r.events).toContain("airJump");
    s = r.state;
    for (let i = 0; i < 5; i++) s = stepMovement(s, none, ctx(false, 16.67, { airJumps: 1 })).state;
    r = stepMovement(s, { ...none, jumpPressed: true, jumpHeld: true }, ctx(false, 16.67, { airJumps: 1 }));
    expect(r.events).not.toContain("airJump");
    r = stepMovement(r.state, none, ctx(true, 16.67, { airJumps: 1 }));
    expect(r.state.airJumpsUsed).toBe(0);
  });

  it("caps fall speed, and the Easy jumps assist glides while jump is held", () => {
    let s = initialMoveState();
    s.grounded = false;
    for (let i = 0; i < 120; i++) s = stepMovement(s, none, ctx(false)).state;
    expect(s.vy).toBeCloseTo(TUNING.maxFall, 0);
    let g = initialMoveState();
    g.grounded = false;
    for (let i = 0; i < 120; i++) g = stepMovement(g, { ...none, jumpHeld: true }, ctx(false, 16.67, { tuning: ASSIST_TUNING })).state;
    expect(g.vy).toBeLessThanOrEqual(ASSIST_TUNING.glideMaxFall + 0.01);
  });

  it("locked movement ignores input (dialogue, digging)", () => {
    let s = initialMoveState();
    for (let i = 0; i < 30; i++) s = stepMovement(s, { ...none, right: true, jumpPressed: true }, ctx(true, 16.67, { locked: true })).state;
    expect(s.vx).toBe(0);
    expect(s.vy).toBeGreaterThanOrEqual(0);
  });

  it("clamps huge frame gaps so a tab switch cannot launch Laika through the floor", () => {
    const s = stepMovement(initialMoveState(), none, ctx(false, 5000)).state;
    expect(s.vy).toBeLessThan(60);
  });
});

describe("movement controller: horizontal jump distance (Phase 2 tuning)", () => {
  /** Walk (or sprint) for 0.5 s, then a full held jump; returns the distance covered in the air. */
  function airDistance(fps: number, sprint = false) {
    const dt = 1000 / fps;
    let s = initialMoveState();
    let x = 0;
    let y = 0;
    let takeoff = NaN;
    for (let i = 0; i < Math.round(fps * 2); i++) {
      const runUp = i < Math.round(fps * 0.5);
      const grounded = y >= 0 && s.vy >= 0;
      const inp = { ...none, right: true, sprint, jumpHeld: !runUp, jumpPressed: i === Math.round(fps * 0.5) };
      s = stepMovement(s, inp, ctx(grounded, dt)).state;
      x += (s.vx * dt) / 1000;
      y += (s.vy * dt) / 1000;
      if (y < 0 && Number.isNaN(takeoff)) takeoff = x;
      if (y >= 0 && !Number.isNaN(takeoff)) return x - takeoff;
      if (y > 0) y = 0;
    }
    return NaN;
  }

  it("is frame-rate independent (30 vs 60 vs 144 fps)", () => {
    for (const sprint of [false, true]) {
      const d60 = airDistance(60, sprint);
      expect(Math.abs(airDistance(30, sprint) - d60)).toBeLessThan(8);
      expect(Math.abs(airDistance(144, sprint) - d60)).toBeLessThan(4);
    }
  });

  it("a walking jump clears the level's 'easy jump' of 4 tiles, and sprinting goes further", () => {
    const walk = airDistance(60);
    expect(walk).toBeGreaterThan(4 * 16);
    expect(airDistance(60, true)).toBeGreaterThan(walk);
  });
});
