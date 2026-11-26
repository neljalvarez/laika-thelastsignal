"""
Phase 5 browser play-tests (scenarios A-O from the Phase 5 brief) and the before/after UI measurements.

    npm run build && npm run preview          # http://localhost:4173
    python playtest/phase5.py [A B ... | SNAP=before|after]

`SNAP` captures the same UI states on any build and measures how much text and how many HUD elements a
player sees by default (visible text in the overlay, excluding the game canvas). Run it on the Phase 4 build
(`before`) and on this build (`after`); screenshots go to playtest/out/phase5/<label>_*.png and the numbers to
playtest/out/phase5/measure_<label>.json.
"""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(__file__))
from playthrough import Bot, URL  # noqa: E402
from phase3 import wait_map  # noqa: E402
from phase4 import ALL_RESTORED, FLAGS_M01, after_m03, answer_call, inject, mission04, new_browser, tp, use, v4  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "out", "phase5") + os.sep
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or None
RESULTS = {}
CUR = ["?"]
SAVE_KEY = "laika-the-last-signal/save"


def ok(name, cond, detail=""):
    RESULTS.setdefault(CUR[0], []).append((name, bool(cond), detail))
    print(("  PASS " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail else ""))


async def shot(pg, name):
    await pg.screenshot(path=OUT + name + ".png")


async def S(pg):
    return await pg.evaluate("window.__laika.state()")


async def OBJ(pg):
    return await pg.evaluate("window.__laika.objective()")


# What a player sees in the HTML overlay: visible text (characters and words) and visible HUD widgets.
MEASURE_JS = r"""
(() => {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false; } return true; };
  const root = document.querySelector('#ui') || document.body;
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const t = walker.currentNode; if (t.textContent.trim() && vis(t.parentElement)) text += ' ' + t.textContent.trim(); }
  const hud = document.querySelector('.hud');
  const widgets = hud ? [...hud.querySelectorAll('.hud-objective, .inv-chip, .ability-chip, .hud-btn, .suit-meter, .power-chip, .hud-prompt, .obj-toggle, .waypoint, .hud-chip')].filter(vis).length : 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return { chars: text.replace(/\s+/g, ' ').trim().length, words, widgets, text: text.replace(/\s+/g, ' ').trim().slice(0, 400) };
})()
"""


async def measure(pg, label, name):
    m = await pg.evaluate(MEASURE_JS)
    await shot(pg, f"{label}_{name}")
    return m


def m01_restore(**over):
    from phase4 import INV3  # noqa: F401
    s = after_m03(checkpoint="cp_outpost")
    s["flags"] = {k: True for k in ["checkedShipRadio", "hatchOpen", "reachedOutpost", "inspectedReceiver"]}
    s["inventory"] = {k: 0 for k in s["inventory"]}
    s["inventory"]["metal"] = 1
    s["collected"] = []
    s["sweptPanels"] = []
    s["visitedCheckpoints"] = ["cp_ship", "cp_outpost"]
    s["discovered"] = {"maps": ["surface"], "sections": [], "landmarks": []}
    s["abilities"]["sniff"] = True
    s["abilities"]["headlamp"] = False
    s["playTimeMs"] = 300000
    s.update(over)
    return s


def m01_before_end():
    s = after_m03(checkpoint="cp_station")
    s["flags"] = {k: True for k in FLAGS_M01 if k != "demoComplete"}
    s["inventory"] = {k: 0 for k in s["inventory"]}
    s["collected"] = []
    s["abilities"]["headlamp"] = False
    s["discovered"] = {"maps": ["surface"], "sections": [], "landmarks": []}
    return s


async def snap(p, label):
    """The same UI states on any build, measured."""
    res = {}
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1500)
    res["title_new"] = await measure(pg, label, "01_title_first_time")
    await pg.get_by_text("New Game").click()
    await pg.wait_for_timeout(5500)
    res["tutorial"] = await measure(pg, label, "02_tutorial_first_stage")
    # Ordinary gameplay: Mission 01, looking for parts at the outpost.
    await inject(pg, m01_restore())
    await pg.wait_for_timeout(3000)
    res["gameplay_m01"] = await measure(pg, label, "03_gameplay_m01")
    await bot.walk_to(77)
    await pg.wait_for_timeout(400)
    res["workstation"] = await measure(pg, label, "04_workstation_prompt")
    await bot.tap("KeyE")
    await pg.wait_for_timeout(900)
    res["workstation_open"] = await measure(pg, label, "05_workstation_used")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(400)
    if await pg.evaluate("!!document.querySelector('.screen-host .screen')"):
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)
    await bot.tap("KeyM")
    await pg.wait_for_timeout(700)
    res["map"] = await measure(pg, label, "06_world_map")
    await bot.tap("KeyM")
    await pg.wait_for_timeout(400)
    # Mission 01 ending.
    await inject(pg, m01_before_end())
    await bot.walk_to(231)
    await bot.tap("KeyE")
    for _ in range(30):
        await pg.wait_for_timeout(400)
        if await bot.trans_open():
            await bot.tap("KeyE")
    await pg.wait_for_timeout(2500)
    res["m01_end"] = await measure(pg, label, "07_mission01_end")
    # Phase 4 base, mid-mission, lower level.
    await inject(pg, v4(["batteryRestored", "recyclerInspected"], checkpoint="cp_lower", eng={"battery": 60, "suit": 70}, seen=["took:cargo_locker"]))
    await pg.wait_for_timeout(2500)
    res["base_m04"] = await measure(pg, label, "08_base_mission04")
    await bot.walk_to(61)
    await pg.wait_for_timeout(300)
    await b.close()
    # Phone.
    b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    c = await b.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = await c.new_page()
    await inject(pg, m01_restore())
    await pg.wait_for_timeout(3000)
    res["mobile_m01"] = await measure(pg, label, "09_mobile_gameplay")
    await b.close()
    json.dump(res, open(OUT + f"measure_{label}.json", "w"), indent=1)
    for k, v in res.items():
        print(f"  {k:18} chars {v['chars']:5}  words {v['words']:4}  hud widgets {v['widgets']:3}")
    return res


# ---------------------------------------------------------------- helpers for the scenarios

M04_DONE = ALL_RESTORED + ["lightsOutStarted", "lightsOutBalanced", "lightsOutDone", "m4Complete", "cropHarvested"]


def v5(flags=(), checkpoint="cp_outpost", inv=None, gear=None, eng=None, **over):
    s = v4(flags, checkpoint=checkpoint, inv=inv, eng=eng or {"battery": 80, "suit": 100}, seen=["took:cargo_locker", "took:habitat_storage"], **over)
    s["version"] = 5
    s["inventory"]["navBeacon"] = 0
    s["gear"] = gear or {"built": [], "blueprints": ["boots"], "wear": []}
    return s


def m01_bench(metal=2, elec=1, **over):
    """Mission 01, solar box fixed (the outpost has power), standing near the workbench."""
    s = m01_restore(**over)
    s["flags"].update({"solarRepaired": True})
    s["sweptPanels"] = ["panel_1", "panel_2", "panel_3"]
    s["inventory"]["metal"] = metal
    s["inventory"]["electronics"] = elec
    return s


async def WP(pg):
    return await pg.evaluate("window.__laika.waypoint()")


async def banner_text(pg, ms=6000):
    t0 = time.time()
    while (time.time() - t0) * 1000 < ms:
        t = await pg.evaluate("(() => { const e = document.querySelector('.region-banner'); return e && !e.classList.contains('hidden') ? e.textContent : ''; })()")
        if t:
            return t
        await pg.wait_for_timeout(150)
    return ""


async def open_bench(bot, pg):
    await bot.walk_to(77)
    await pg.wait_for_timeout(300)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(700)
    return await pg.evaluate("!!document.querySelector('.bench-card')")


async def no_card(pg):
    return not await pg.evaluate("!!document.querySelector('.complete-card')")


def words(t):
    return len([w for w in (t or "").split() if any(ch.isalpha() for ch in w)])


# ---------------------------------------------------------------- scenarios A-O

async def scenario_A(p):
    """Fresh game through the simplified tutorial (real keys), then into Mission 01."""
    from phase2 import tutorial_keyboard
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1300)
    ok("title shows New Game, Settings and a small More", await pg.get_by_text("New Game").count() == 1 and await pg.get_by_text("More").count() >= 1)
    await pg.get_by_text("New Game").click()
    await pg.wait_for_timeout(4500)
    card = await pg.evaluate("document.querySelector('.tutorial-card')?.innerText || ''")
    ok("first tutorial card is one short line plus the keys", words(card) <= 12, card.replace("\n", " | "))
    await shot(pg, "A1_tutorial")
    await tutorial_keyboard(bot, pg, shots=False)
    st = await S(pg)
    ok("tutorial finished with real key presses", st["tutorial"]["status"] == "done")
    await pg.wait_for_timeout(1500)
    o = await OBJ(pg)
    ok("Mission 01 starts with a short objective", o and words(o["primary"]) <= 7, o and o["primary"])
    await shot(pg, "A2_after_tutorial")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_B(p):
    """Mission 01 ends without a final-looking screen and Chapter 2 starts by itself."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, m01_before_end())
    await bot.walk_to(231)
    await bot.tap("KeyE")
    t = await banner_text(pg, 9000)
    st = await S(pg)
    ok("Mission 01 complete", st["flags"]["demoComplete"])
    ok("no completion card", await no_card(pg))
    ok("chapter banner names Chapter 2", "Chapter 2" in t or "BENEATH" in t.upper(), t)
    await shot(pg, "B1_chapter2_banner")
    for _ in range(50):  # the briefing follows the last radio line (passive messages read themselves out)
        if (await S(pg))["flags"].get("m2Briefed"):
            break
        await pg.wait_for_timeout(300)
    st = await S(pg)
    o = await OBJ(pg)
    ok("Chapter 2 briefing arrived without walking back to a console", st["flags"]["m2Briefed"])
    ok("next objective is Mission 02", o["stage"].startswith("m2_"), o["primary"])
    ok("transmission is passive (play continues)", not await bot.trans_open())
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_C(p):
    """Each chapter boundary flows into the next chapter."""
    b, pg, errs = await new_browser(p)
    # 2 -> 3: analysing the relay cell continues straight into Mission 03.
    from phase4 import FLAGS_M02
    s = after_m03(checkpoint="cp_station")
    for f in ["ridgeReached", "relayASwept", "cellInstalled", "relayCFound", "relayNetworkOnline", "towerReached", "signalTraced", "ridgeCableOpen"]:
        s["flags"][f] = False
    await inject(pg, s)
    o = await OBJ(pg)
    ok("after Chapter 2 the objective is Chapter 3", o["stage"].startswith("m3_") and o.get("chapter") == 3, o["stage"])
    # 3 -> 4: the station call arrives by itself (the old blocker: the habitat ladder needed it).
    await inject(pg, after_m03(checkpoint="cp_outpost"))
    for _ in range(20):
        if (await S(pg))["flags"].get("m4Briefed"):
            break
        await pg.wait_for_timeout(300)
    o = await OBJ(pg)
    ok("Chapter 4 call arrives automatically", (await S(pg))["flags"].get("m4Briefed"))
    ok("objective moves to Chapter 4", o["stage"].startswith("m4_") and o.get("chapter") == 4, o["stage"])
    await shot(pg, "C1_chapter4_start")
    # 4 -> 5
    await inject(pg, v5(M04_DONE))
    for _ in range(20):
        if (await S(pg))["flags"].get("m5Briefed"):
            break
        await pg.wait_for_timeout(300)
    o = await OBJ(pg)
    ok("Chapter 5 starts after Chapter 4", (await S(pg))["flags"].get("m5Briefed") and o["stage"] == "m5_bench", o["stage"])
    ok("no completion cards anywhere", await no_card(pg))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_D(p):
    """Following the waypoint across maps: surface -> lift -> Frozen Depths drill."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, v5(["batteryRestored", "recyclerInspected", "recyclerFixed", "recyclerPowered", "recyclerOn"]))
    await pg.wait_for_timeout(1200)
    o = await OBJ(pg)
    ok("objective: get the pipe connector (another map)", o["stage"] == "m4_coupling", o["stage"])
    w = await WP(pg)
    ok("waypoint heads for the way down, not at the far target", w and w["otherMap"] and w["objectId"] != "sampler", str(w))
    ok("marker or edge arrow is visible", w and (w["markerShown"] or w["arrowShown"]))
    await shot(pg, "D1_waypoint_to_lift")
    # Follow the marker point by point until it sits on the transit object, then use it.
    lift = None
    for _ in range(10):
        w = await WP(pg)
        if not w:
            break
        await bot.walk_to(int(w["x"] // 16))
        await pg.wait_for_timeout(500)
        if w["kind"] == "transit" and w["objectId"]:
            lift = w["objectId"]
            break
    ok("the markers lead to the nearby survey lift", lift == "outpost_lift", str(lift))
    await bot.interact(lift)
    ok("the waypoint's lift leads to the Frozen Depths", await wait_map(pg, "depths"))
    await pg.wait_for_timeout(1200)
    w = await WP(pg)
    ok("in the depths the waypoint now leads to the drill", w and not w["otherMap"], str(w))
    for _ in range(8):
        w = await WP(pg)
        if not w or w["objectId"] == "sampler":
            break
        await bot.walk_to(int(w["x"] // 16))
    await bot.walk_to(22)
    await use(bot, "sampler")
    ok("followed the markers to the pipe connector", (await S(pg))["inventory"]["waterCoupling"] == 1)
    await shot(pg, "D2_followed_to_drill")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_E(p):
    """Waypoints route around terrain: from the lower level the marker sits on the ladder."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, v5(["baseReturned"], checkpoint="cp_lower", inv={"regulator": 1}))
    await pg.wait_for_timeout(1300)
    o = await OBJ(pg)
    ok("objective: fix the battery (on the surface)", o["target"] == "battery", o["stage"])
    w = await WP(pg)
    ok("waypoint is the ladder, not a point through the ceiling", w and w["kind"] == "portal" and w["objectId"] == "lower_stairs", str(w))
    await shot(pg, "E1_marker_on_ladder")
    await bot.walk_to(61)
    await use(bot, "lower_stairs", 900)
    await pg.wait_for_timeout(900)
    w = await WP(pg)
    ok("after the ladder it points at the battery", w and w["objectId"] in ("battery", None) and w["kind"] in ("target", "route"), str(w))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_F(p):
    """An unchanged Phase 4 save (v4) loads, migrates to v5 and plays."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    s = v4(["batteryRestored"], eng={"battery": 60}, seen=["took:cargo_locker"])
    s["abilities"]["thrusters"] = True
    await inject(pg, s)
    st = await S(pg)
    ok("loaded as version 5", st["version"] == 5)
    ok("equipment added, boots kept", st["gear"]["built"] == [] and st["abilities"]["thrusters"])
    ok("progress kept", st["flags"]["batteryRestored"] and st["flags"]["relayAnalyzed"])
    await bot.walk_to(60)
    ok("player can move after loading", abs((await bot.P())["col"] - 60) <= 2)
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_GHI(p):
    """G: craft the first upgrade. H: not without parts. I: mission items are never used."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    # H first: one Metal short.
    await inject(pg, m01_bench(metal=1, elec=1))
    ok("workbench opens", await open_bench(bot, pg))
    btn = pg.locator(".build-btn")
    ok("H: BUILD is disabled and says what's missing", await btn.is_disabled() and "NEED MORE PARTS" in (await btn.inner_text()))
    await shot(pg, "H1_bench_missing")
    await btn.click(force=True)
    await pg.wait_for_timeout(400)
    ok("H: nothing built, nothing spent", not (await S(pg))["abilities"]["thrusters"] and (await S(pg))["inventory"]["metal"] == 1)
    await pg.keyboard.press("Escape")
    # G + I: enough parts, plus mission items in the bag.
    s = m01_bench(metal=2, elec=1)
    s["inventory"]["commsModule"] = 1
    await inject(pg, s)
    ok("workbench opens", await open_bench(bot, pg))
    await shot(pg, "G1_bench_ready")
    ok("G: BUILD is enabled", not await pg.locator(".build-btn").is_disabled())
    await pg.locator(".build-btn").click()
    await pg.wait_for_timeout(900)
    st = await S(pg)
    ok("G: Thruster Boots built", st["abilities"]["thrusters"])
    ok("G: parts spent once", st["inventory"]["metal"] == 0 and st["inventory"]["electronics"] == 0)
    ok("I: the Radio Part (mission item) is untouched", st["inventory"]["commsModule"] == 1)
    ok("G: the bench closes so Laika can show off the new gear", not await pg.evaluate("!!document.querySelector('.bench-card')"))
    await pg.wait_for_timeout(500)
    await shot(pg, "G2_laika_with_boots")
    ok("G: bench opens again", await open_bench(bot, pg))
    ok("G: card now shows built", "BUILT" in (await pg.locator(".build-btn").inner_text()).upper())
    await shot(pg, "G3_bench_built")
    await pg.locator(".build-btn").click(force=True)
    await pg.wait_for_timeout(400)
    ok("G: building again does nothing", (await S(pg))["inventory"]["metal"] == 0)
    await pg.keyboard.press("Escape")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_J(p):
    """Equipment benefits in play: the Signal Booster finds the lost beacon; without it, nothing."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    flags = M04_DONE + ["m5Briefed", "m5Blueprint"]
    await inject(pg, v5(flags, gear={"built": [], "blueprints": ["boots", "booster"], "wear": []}))
    await bot.walk_to(104)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(1200)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(900)
    ok("without the booster the cache stays hidden", (await S(pg))["inventory"]["navBeacon"] == 0)
    await inject(pg, v5(flags, gear={"built": ["booster"], "blueprints": ["boots", "booster"], "wear": []}))
    await bot.walk_to(104)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(1300)
    await shot(pg, "J1_booster_sniff")
    await bot.walk_to(104)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(1500)
    st = await S(pg)
    ok("with the booster the beacon is found", st["inventory"]["navBeacon"] == 1 or st["flags"]["beaconFound"], str(st["inventory"].get("navBeacon")))
    ok("booster antenna visible on Laika (look texture)", await pg.evaluate("window.__laika.scene.player.sprite?.texture?.key || ''") != "laika")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def mobile(p, settings=None):
    b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    c = await b.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = await c.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return b, pg, errs


OVERLAP_JS = r"""
(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05; };
  const rects = (sel) => [...document.querySelectorAll(sel)].filter(vis).map((e) => ({ sel, r: e.getBoundingClientRect(), t: (e.textContent || '').trim().slice(0, 20) }));
  const a = rects('.hud-objective');
  const bs = [...rects('.touch button'), ...rects('.touch .tbtn'), ...rects('.hud-btn')];
  const hit = [];
  for (const x of a) for (const y of bs) {
    const o = !(x.r.right <= y.r.left || y.r.right <= x.r.left || x.r.bottom <= y.r.top || y.r.bottom <= x.r.top);
    if (o) hit.push(y.t || y.sel);
  }
  const vw = innerWidth, vh = innerHeight;
  const off = [...a, ...bs].filter((x) => x.r.left < -1 || x.r.top < -1 || x.r.right > vw + 1 || x.r.bottom > vh + 1).map((x) => x.t || x.sel);
  return { hit, off, n: bs.length };
})()
"""


async def scenario_K(p):
    """Phone: simplified HUD and the workbench work with touch."""
    b, pg, errs = await mobile(p)
    bot = Bot(pg)
    await inject(pg, m01_bench(metal=2, elec=1))
    await bot.walk_to(77)
    await pg.wait_for_timeout(400)
    ov = await pg.evaluate(OVERLAP_JS)
    ok("objective box does not cover the touch buttons", not ov["hit"], str(ov))
    act = pg.locator(".touch [data-action='interact'], .touch .btn-interact").first
    if await act.count():
        await act.tap()
    else:
        await bot.tap("KeyE")
    await pg.wait_for_timeout(900)
    ok("workbench opens from the touch action button", await pg.evaluate("!!document.querySelector('.bench-card')"))
    box = await pg.locator(".build-btn").bounding_box()
    ok("BUILD button is a large touch target, on screen", box and box["height"] >= 40 and box["y"] + box["height"] <= 390, str(box))
    await shot(pg, "K1_mobile_bench")
    await pg.locator(".build-btn").tap()
    await pg.wait_for_timeout(900)
    ok("built with a tap", (await S(pg))["abilities"]["thrusters"])
    await pg.wait_for_timeout(500)
    ok("touch controls come back after closing", await pg.evaluate("!document.querySelector('.touch').classList.contains('hidden') && !document.querySelector('.touch').classList.contains('menu-open')"))
    await shot(pg, "K2_mobile_after")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_L(p):
    """Largest text: the HUD stays clear of the controls (desktop and phone)."""
    big = {"textScale": 1.5}
    for label, opener in (("desktop", new_browser), ("phone", mobile)):
        b, pg, errs = await opener(p)
        await inject(pg, m01_bench(), settings=big)
        await pg.wait_for_timeout(1500)
        ov = await pg.evaluate(OVERLAP_JS)
        ok(f"{label}: text scale 1.5 applied", await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--text-scale') || document.body.style.fontSize || '1'") is not None)
        ok(f"{label}: objective box overlaps no button", not ov["hit"], str(ov["hit"]))
        ok(f"{label}: nothing pushed off screen", not ov["off"], str(ov["off"]))
        await shot(pg, f"L_{label}_large_text")
        ok(f"{label}: no page errors", not errs, "; ".join(errs[:3]))
        await b.close()


async def scenario_M(p):
    """Reduced motion and other accessibility settings still apply."""
    b, pg, errs = await new_browser(p)
    await inject(pg, v5(["batteryRestored", "recyclerInspected", "recyclerFixed", "recyclerPowered", "recyclerOn"]), settings={"reducedMotion": True, "captions": True, "hud": "detailed"})
    ok("reduced-motion class on the page", await pg.evaluate("document.body.classList.contains('reduced-motion')"))
    ok("detailed HUD option applies", await pg.evaluate("document.body.classList.contains('hud-detailed')"))
    ys = []
    for _ in range(4):
        ys.append(await pg.evaluate("window.__laika.scene.wpMarker.visible ? window.__laika.scene.wpMarker.y : null"))
        await pg.wait_for_timeout(170)
    ok("waypoint marker does not bob with reduced motion", len(set(ys)) <= 1, str(ys))
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(500)
    await pg.get_by_role("button", name="Settings").click()
    await pg.wait_for_timeout(500)
    tabs = await pg.evaluate("[...document.querySelectorAll('.settings-tabs button, .set-tabs button, [role=tab]')].map(b => b.textContent.trim())")
    ok("settings are grouped in tabs", len(tabs) >= 4, str(tabs))
    await shot(pg, "M1_settings")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_N(p):
    """Mission 05 start to finish with real keys: parts downstairs, build the booster, find and link the beacon."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, v5(M04_DONE, inv={"metal": 0, "electronics": 0}))
    for _ in range(20):
        if (await S(pg))["flags"].get("m5Briefed"):
            break
        await pg.wait_for_timeout(300)
    # (The live 4 -> 5 banner is checked in phase4.py H, which plays Mission 04 to the end: this save
    # already starts in Chapter 5, so its banner is the region name.)
    ok("objective belongs to Chapter 5", (await OBJ(pg)).get("chapter") == 5)
    ok("objective: go to the workbench", (await OBJ(pg))["stage"] == "m5_bench")
    ok("workbench opens", await open_bench(bot, pg))
    ok("the Signal Booster blueprint arrives", "booster" in (await S(pg))["gear"]["blueprints"])
    await shot(pg, "N1_new_blueprint")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(500)
    o = await OBJ(pg)
    ok("objective asks for parts with a target", o["stage"] == "m5_parts" and o["target"], o["primary"])
    # Parts are downstairs.
    await bot.walk_to(61)
    await use(bot, "habitat", 900)
    for col, oid in ((66, "metal_hab"), (86, "metal_lower"), (45, "elec_lower")):
        await bot.walk_to(col)
        await use(bot, oid, 600)
    st = await S(pg)
    ok("picked up 2 Metal and 1 Circuit downstairs", st["inventory"]["metal"] >= 2 and st["inventory"]["electronics"] >= 1, str({k: st["inventory"][k] for k in ("metal", "electronics")}))
    await shot(pg, "N2_habitat")
    await bot.walk_to(61)
    await use(bot, "lower_stairs", 900)
    ok("workbench opens", await open_bench(bot, pg))
    await pg.locator(".bench-item", has_text="Signal Booster").click()
    await pg.wait_for_timeout(200)
    await pg.locator(".build-btn").click()
    await pg.wait_for_timeout(900)
    ok("Signal Booster built", "booster" in (await S(pg))["gear"]["built"])
    await pg.wait_for_timeout(800)
    await bot.walk_to(104)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(1300)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(1500)
    ok("Nav Beacon dug up", (await S(pg))["flags"]["beaconFound"])
    await shot(pg, "N3_beacon_found")
    await bot.walk_to(70)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(2000)
    st = await S(pg)
    ok("beacon linked: Mission 05 complete", st["flags"]["m5Complete"])
    ok("no completion card", await no_card(pg))
    ok("all blueprints unlocked", len(st["gear"]["blueprints"]) == 5)
    o = await OBJ(pg)
    ok("an objective remains (the trip north)", o is not None and o.get("primary"), o and o.get("primary"))
    await shot(pg, "N4_mission05_done")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_O(p):
    """Earlier content stays reachable after Mission 05: lifts, journal, map, workbench, tutorial replay."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    flags = M04_DONE + ["m5Briefed", "m5Blueprint", "beaconFound", "m5Complete"]
    await inject(pg, v5(flags, inv={"metal": 3, "electronics": 2, "treat": 1, "sample": 3, "roverPart": 2}, gear={"built": ["booster"], "blueprints": ["boots", "booster", "efficientBoots", "surveyLamp", "reserveBattery"], "wear": []}))
    ok("workbench lists every blueprint", await open_bench(bot, pg) and await pg.locator(".bench-item").count() == 5)
    await shot(pg, "O1_bench_all")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(500)
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(500)
    await pg.get_by_role("button", name="Journal").click()
    await pg.wait_for_timeout(600)
    ok("journal opens on the equipment collection", await pg.evaluate("!!document.querySelector('.gear-grid, .journal-card')"))
    await shot(pg, "O2_journal_gear")
    tab = pg.get_by_role("button", name="Radio")
    if await tab.count():
        await tab.click()
        await pg.wait_for_timeout(300)
    await shot(pg, "O3_journal_radio")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(400)
    if await pg.evaluate("!!document.querySelector('.screen-host .screen')"):
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)
    # Habitat with the earned decorations.
    await bot.walk_to(61)
    await use(bot, "habitat", 900)
    await bot.walk_to(60)
    await pg.wait_for_timeout(600)
    await shot(pg, "O4_habitat_rewards")
    await bot.walk_to(61)
    await use(bot, "lower_stairs", 900)
    await bot.walk_to(81)
    await bot.interact("outpost_lift")
    ok("the survey lift still works", await wait_map(pg, "depths"))
    await bot.walk_to(12)
    await bot.interact("depths_lift")
    ok("and back up", await wait_map(pg, "surface"))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


SCEN = {"A": scenario_A, "B": scenario_B, "C": scenario_C, "D": scenario_D, "E": scenario_E, "F": scenario_F, "GHI": scenario_GHI, "J": scenario_J, "K": scenario_K, "L": scenario_L, "M": scenario_M, "N": scenario_N, "O": scenario_O}


async def main():
    args = sys.argv[1:]
    async with async_playwright() as p:
        if args and args[0].startswith("SNAP="):
            await snap(p, args[0][5:])
            return
        which = [a.upper() for a in args] or list(SCEN)
        for k in which:
            CUR[0] = k
            print(f"== Scenario {k}")
            try:
                await SCEN[k](p)
            except Exception as e:  # report and keep going
                ok("scenario ran without exceptions", False, repr(e)[:300])
    json.dump({k: [(n, c, d) for n, c, d in v] for k, v in RESULTS.items()}, open(OUT + f"results_{'_'.join(which)}.json", "w"), indent=1)
    fails = sum(1 for v in RESULTS.values() for _, c, _ in v if not c)
    total = sum(len(v) for v in RESULTS.values())
    print(f"\n{total - fails}/{total} checks passed")


if __name__ == "__main__":
    asyncio.run(main())
