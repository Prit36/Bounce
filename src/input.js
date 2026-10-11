/* Player input only; the original game's key handling stays in the JAR. */
(function () {
  window.BounceInput = function ({ key, feedback = () => {}, changed = () => {} }) {
    const held = new Map();
    let gamepadReady = false;
    let taps = 0;
    function down(source, code) {
      if (held.has(source)) return;
      const alreadyHeld = [...held.values()].includes(code);
      held.set(source, code);
      feedback(code);
      if (!alreadyHeld) key(code, true);
      changed(held);
    }
    function up(source) {
      if (!held.has(source)) return;
      const code = held.get(source);
      held.delete(source);
      if (![...held.values()].includes(code)) key(code, false);
      changed(held);
    }
    function release(prefix = '') {
      for (const source of [...held.keys()]) if (source.startsWith(prefix)) up(source);
      gamepadReady = false;
    }
    function tap(code) {
      const source = 'tap:' + ++taps;
      down(source, code);
      up(source);
    }
    function poll(pads, { blocked = false, menu = false } = {}) {
      const pad = Array.from(pads || []).find(p => p?.connected !== false && p);
      if (!pad || blocked) { release('gp:'); return; }
      const b = pad.buttons || [], axes = pad.axes || [];
      const actions = [
        ['up', !!b[12]?.pressed || axes[1] < -.45, -1],
        ['down', !!b[13]?.pressed || axes[1] > .45, -2],
        ['left', !!b[14]?.pressed || axes[0] < -.45, -3],
        ['right', !!b[15]?.pressed || axes[0] > .45, -4],
        ['a', !!b[0]?.pressed, menu ? -5 : -1],
        ['b', !!b[1]?.pressed, -7], ['x', !!b[2]?.pressed, -1],
        ['y', !!b[3]?.pressed, -6], ['start', !!b[9]?.pressed, -7],
        ['select', !!b[8]?.pressed, -6]
      ];
      // After a modal, focus loss, or disconnect, wait for neutral controls.
      // A held button must never select a menu item on the player's return.
      if (!gamepadReady) {
        if (actions.every(([, pressed]) => !pressed)) gamepadReady = true;
        return;
      }
      for (const [name, pressed, code] of actions) {
        const source = 'gp:' + pad.index + ':' + name;
        if (pressed) down(source, code); else up(source);
      }
      for (const source of [...held.keys()]) {
        if (typeof source === 'string' && source.startsWith('gp:') && !source.startsWith('gp:' + pad.index + ':')) up(source);
      }
    }
    return { held, down, up, tap, release, poll };
  };
})();
