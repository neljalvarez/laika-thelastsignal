"""
Phase 4 browser play-tests (scenarios A-N from the Phase 4 brief), with real keyboard / touch input.

    npm run build && npm run preview          # http://localhost:4173
    python playtest/phase4.py [A B C ...]     # default: all. Screenshots -> playtest/out/phase4/

window.__laika (enabled by ?debug) is used to READ state and position. Saves are injected through
localStorage to start scenarios at a mission boundary. Scenarios that are about one system (the
distribution console, recharge posts, settings, saves) use the debug teleport to reach the spot
quickly; every interaction, jump, bark and sweep is still done with real key presses. Scenario A
plays Mission 04 start to finish without teleporting.
"""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(__file__))
from playthrough import Bot, URL  # noqa: E402
from phase3 import hop, until_row, wait_map  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "out", "phase4") + os.sep
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or None
RESULTS = {}
CUR = ["?"]
SAVE_KEY = "laika-the-last-signal/save"
SET_KEY = "laika-the-last-signal/settings"


def ok(name, cond, detail=""):
    RESULTS.setdefault(CUR[0], []).append((name, bool(cond), detail))
    print(("  PASS " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail else ""))


async def new_browser(p, **ctx):
    b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--js-flags=--expose-gc", "--enable-precise-memory-info"])
    c = await b.new_context(**({"viewport": {"width": 1280, "height": 720}} | ctx))
    pg = await c.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
    return b, pg, errs


async def shot(pg, name):
    await pg.screenshot(path=OUT + name + ".png")


async def S(pg):
    return await pg.evaluate("window.__laika.state()")


async def OBJ(pg):
    return await pg.evaluate("window.__laika.objective()")


async def MAP(pg):
    return await pg.evaluate("window.__laika.map()")


async def tp(pg, col, row):
    await pg.evaluate(f"window.__laika.teleport({col}, {row})")
    await pg.wait_for_timeout(500)


async def menu_open(pg):
    return await pg.evaluate("!!document.querySelector('.screen-host .screen')")


# ---------------------------------------------------------------- saves

FLAGS_M01 = ["checkedShipRadio", "hatchOpen", "reachedOutpost", "inspectedReceiver", "solarRepaired", "moduleInstalled", "commsOnline", "bridgeExtended", "stationDoorOpen", "reachedStation", "demoComplete"]
FLAGS_M02 = ["m2Briefed", "depthsReached", "passageOpen", "junctionInspected", "circuitRestored", "iceChamberReached", "depthsLiftOpen", "relayAnalyzed"]
FLAGS_M03 = ["ridgeReached", "relayASwept", "cellInstalled", "relayCFound", "relayNetworkOnline", "towerReached", "signalTraced", "ridgeCableOpen"]
INV3 = {"metal": 0, "electronics": 0, "commsModule": 0, "sample": 5, "treat": 0, "coupling": 0, "relayCell": 0, "recording": 2, "roverPart": 1}


def after_m03(checkpoint="cp_station_cable", version=3, **over):
    """A save written by Phase 3 right after Mission 03 (exactly the v3 shape)."""
    s = {
        "version": 3,
        "flags": {k: True for k in [*FLAGS_M01, *FLAGS_M02, *FLAGS_M03]},
        "inventory": dict(INV3),
        "collected": ["sample_basalt", "sampler", "coupling_cache"],
        "abilities": {"sniff": True, "sweep": True, "thrusters": False, "bark": True, "headlamp": True},
        "sweptPanels": ["panel_1", "panel_2", "panel_3"],
        "seen": [],
        "checkpoint": checkpoint,
        "visitedCheckpoints": ["cp_ship", "cp_outpost", "cp_canyon", "cp_rover", "cp_rim", "cp_station", "cp_station_cable"],
        "playTimeMs": 1800000,
        "tutorial": {"status": "done", "stage": "done"},
        "discovered": {"maps": ["surface", "depths", "ridge"], "sections": [], "landmarks": []},
        "puzzles": {"relayAim": {"relay_a": 3, "relay_b": 3, "relay_c": 4}},
    }
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(s.get(k), dict):
            s[k].update(v)
        else:
            s[k] = v
    return s


def v4(flags=(), checkpoint="cp_outpost", inv=None, eng=None, seen=(), **over):
    """A Phase 4 save part-way through Mission 04."""
    s = after_m03(checkpoint=checkpoint)
    s["version"] = 4
    for f in ["m4Briefed", "baseReturned", "baseSurveyed", *flags]:
        s["flags"][f] = True
    s["inventory"].update({"regulator": 0, "recyclerPart": 0, "waterCoupling": 0, "seeds": 0, "powerCell": 0, **(inv or {})})
    s["eng"] = {"battery": 0, "alloc": {"water": True, "greenhouse": True, "research": True}, "growMs": 0, "suit": 100, "dusty": [], **(eng or {})}
    s["science"] = []
    s["seen"] = list(seen)
    s.update(over)
    return s


ALL_RESTORED = ["batteryRestored", "recyclerInspected", "recyclerFixed", "recyclerPowered", "recyclerOn", "waterRestored", "growPowered", "growValveOpen", "seedsPlanted", "growLightsOn", "shelterInspected", "probeOutRead", "probeInRead", "shelterRestored"]


async def inject(pg, state, settings=None):
    await pg.goto(URL)
    await pg.wait_for_timeout(700)
    await pg.evaluate(f"s => localStorage.setItem('{SAVE_KEY}', s)", json.dumps(state))
    if settings:
        await pg.evaluate(f"s => localStorage.setItem('{SET_KEY}', s)", json.dumps(settings))
    await pg.reload()
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(2300)


async def reload_continue(pg):
    await pg.reload()
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(2300)


async def close_panel(pg):
    for _ in range(3):
        if not await menu_open(pg):
            return
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)


async def use(bot, obj, wait=700):
    """Press E at the object (the bot must already stand there)."""
    t = await bot.interact(obj)
    await bot.pg.wait_for_timeout(wait)
    return t


async def stairs_down(bot):
    await bot.walk_to(61)
    await use(bot, "habitat", 900)


async def stairs_up(bot):
    await bot.walk_to(61)
    await use(bot, "lower_stairs", 900)


# ---------------------------------------------------------------- scenarios

async def scenario_X(p):
    """Exploration: screenshots of the base in a few states (used while building the art)."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, v4(checkpoint="cp_outpost"))
    await tp(pg, 62, 30)
    await pg.wait_for_timeout(600)
    await shot(pg, "X1_lower_dark")
    s = v4(ALL_RESTORED + ["cropHarvested"], eng={"battery": 80, "growMs": 60000}, seen=["took:cargo_locker", "took:habitat_storage"])
    await inject(pg, s)
    await tp(pg, 62, 30)
    await pg.wait_for_timeout(900)
    await shot(pg, "X2_lower_lit_mid")
    await tp(pg, 78, 30)
    await pg.wait_for_timeout(900)
    await shot(pg, "X3_lower_lit_east")
    await tp(pg, 46, 30)
    await pg.wait_for_timeout(900)
    await shot(pg, "X4_lower_lit_west")
    await tp(pg, 66, 23)
    await pg.wait_for_timeout(900)
    await shot(pg, "X5_surface_restored")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()



# ---------------------------------------------------------------- Mission 04 route (no teleports)

DEPTHS_WEST = (100, 86, 68, 48, 44, 40, 36, 39, 46, 52, 23)


async def answer_call(bot, pg):
    await bot.walk_to(231)
    await bot.interact("beacon")
    await pg.wait_for_timeout(500)
    await bot.close_trans()
    await pg.wait_for_timeout(600)


async def depths_freight_to_lift(bot, pg):
    for c in DEPTHS_WEST:
        await bot.walk_to(c)
    await bot.walk_to(12)


async def home_by_lifts(bot, pg):
    await bot.walk_to(226)
    await bot.interact("station_lift")
    await wait_map(pg, "depths")
    await depths_freight_to_lift(bot, pg)
    await bot.interact("depths_lift")
    await wait_map(pg, "surface")


async def bark_at(bot, col):
    await bot.walk_to(col)
    await bot.tap("KeyB")
    await bot.pg.wait_for_timeout(900)
    await bot.close_trans()


async def mission04(bot, pg, prefix="H", shots=True):
    """From the Ares Station (after the call) to MISSION 04 COMPLETE, like a player."""
    async def snap(name):
        if shots:
            await shot(pg, f"{prefix}_{name}")

    await home_by_lifts(bot, pg)
    await snap("01_home_abandoned")
    await bot.walk_to(57)
    await use(bot, "base_terminal", 900)
    ok(f"{prefix}: base status opens from the terminal", await menu_open(pg))
    await snap("02_base_status_initial")
    await close_panel(pg)
    # Regulator in the ship.
    await bot.walk_to(18, timeout=40000)
    await use(bot, "cargo_locker")
    await bot.walk_to(53, timeout=40000)
    await use(bot, "battery", 1200)
    ok(f"{prefix}: battery restored", (await S(pg))["flags"]["batteryRestored"])
    await snap("03_battery_station")
    # Lower level: recycler, cartridge, power.
    await stairs_down(bot)
    q = await bot.P()
    ok(f"{prefix}: habitat stairs lead to the lower level", await MAP(pg) == "surface" and 26 <= q["row"] <= 30 and 40 <= q["col"] <= 88, str(q))
    await snap("04_habitat_interior")
    await bot.walk_to(68)
    await use(bot, "recycler")
    await bot.walk_to(56)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(1500)
    await bot.walk_to(55)
    await use(bot, "buried_cartridge", 1300)
    await bot.walk_to(68)
    await use(bot, "recycler")
    await bot.walk_to(71)
    await use(bot, "recycler_power")
    await bot.walk_to(68)
    await use(bot, "recycler", 1200)
    ok(f"{prefix}: recycler running", (await S(pg))["flags"]["recyclerOn"])
    await snap("05_recycler_running")
    await bot.walk_to(84)
    await use(bot, "water_processor")
    await bot.walk_to(74)
    await use(bot, "grow_power")
    await bot.walk_to(64)
    await use(bot, "habitat_storage")
    # Shelter: wake the monitor, bark at both probes.
    await bot.walk_to(44)
    await use(bot, "shelter_terminal", 900)
    await bark_at(bot, 46)
    await snap("06_radiation_shelter")
    await stairs_up(bot)
    await bark_at(bot, 50)
    # Coupling from the core drill in the Frozen Depths (survey lift both ways).
    await bot.walk_to(81)
    await bot.interact("outpost_lift")
    await wait_map(pg, "depths")
    await bot.walk_to(22)
    await use(bot, "sampler")
    ok(f"{prefix}: melt-line coupling taken from the drill", (await S(pg))["inventory"]["waterCoupling"] == 1)
    await bot.walk_to(12)
    await bot.interact("depths_lift")
    await wait_map(pg, "surface")
    await stairs_down(bot)
    await bot.walk_to(84)
    await use(bot, "water_processor", 1200)
    ok(f"{prefix}: water circulation restored", (await S(pg))["flags"]["waterRestored"])
    await snap("07_water_circulation")
    await bot.walk_to(80)
    await use(bot, "grow_valve")
    await bot.walk_to(77)
    await use(bot, "planter")
    await use(bot, "planter", 1000)
    st = await S(pg)
    ok(f"{prefix}: greenhouse planted and lit", st["flags"]["seedsPlanted"] and st["flags"]["growLightsOn"])
    await snap("08_greenhouse_planted")
    await bot.walk_to(44)
    await use(bot, "shelter_terminal", 1200)
    st = await S(pg)
    ok(f"{prefix}: radiation shelter ready", st["flags"]["shelterRestored"])
    # LIGHTS OUT starts a few seconds after the last facility comes online.
    for _ in range(20):
        if (await S(pg))["flags"]["lightsOutStarted"]:
            break
        await pg.wait_for_timeout(400)
    ok(f"{prefix}: LIGHTS OUT starts at the outpost", (await S(pg))["flags"]["lightsOutStarted"])
    await pg.wait_for_timeout(800)
    await snap("09_lights_out")
    await bot.walk_to(52)
    await use(bot, "dist_console", 900)
    ok(f"{prefix}: the power console opens", await menu_open(pg))
    await pg.get_by_role("button", name="Recommended").click()
    await pg.wait_for_timeout(300)
    await snap("10_distribution_console")
    await pg.get_by_role("button", name="Apply").click()
    await pg.wait_for_timeout(900)
    await bot.close_trans()
    st = await S(pg)
    ok(f"{prefix}: network balanced, life support never switched off", st["flags"]["lightsOutBalanced"] and st["flags"]["recyclerOn"], str(st["eng"]))
    await stairs_up(bot)
    for pid, col in (("panel_1", 40), ("panel_3", 48)):
        if pid in (await S(pg))["eng"]["dusty"]:
            await bot.walk_to(col)
            await use(bot, pid, 900)
    st = await S(pg)
    ok(f"{prefix}: panels swept, LIGHTS OUT over", st["flags"]["lightsOutDone"], str(st["eng"]["dusty"]))
    # Laika is already outside: the finale starts by itself (the bot waits instead of walking, so
    # its stuck-jump Space presses cannot land on the completion card's focused button).
    for _ in range(25):
        if await bot.trans_open():
            break
        await pg.wait_for_timeout(300)
    await snap("11_finale_transmission")
    await bot.close_trans()
    for _ in range(20):
        if await pg.evaluate("document.querySelector('.complete-card')?.textContent?.includes('MISSION 04') || false"):
            break
        await pg.wait_for_timeout(300)
    ok(f"{prefix}: MISSION 04 COMPLETE card", await pg.evaluate("document.querySelector('.complete-card')?.textContent?.includes('MISSION 04') || false"))
    await snap("12_mission04_complete")
    if await pg.get_by_text("Keep exploring").count():
        await pg.get_by_text("Keep exploring").click()
    await pg.wait_for_timeout(1200)
    await bot.walk_to(66)
    await snap("13_outpost_restored")
    st = await S(pg)
    ok(f"{prefix}: m4Complete saved", st["flags"]["m4Complete"])
    return st


async def scenario_H(p, settings=None, prefix="H"):
    """Load a finished Phase 3 save and play Mission 04 start to finish (no teleports)."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, after_m03(), settings)
    t0 = time.time()
    await answer_call(bot, pg)
    st = await mission04(bot, pg, prefix=prefix)
    mins = (time.time() - t0) / 60
    ok(f"{prefix}: bot completion time (real time, includes bot overhead)", True, f"{mins:.1f} min, in-game {st['playTimeMs'] / 60000 - 30:.1f} min")
    ok(f"{prefix}: no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_G(p):
    """Mandatory progression in Relaxed mode."""
    await scenario_H(p, settings={"survival": "relaxed"}, prefix="G")


async def scenario_B(p):
    """Load a completed Phase 3 save and begin Mission 04."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, after_m03())
    st = await S(pg)
    ok("v3 save migrated to v4 in place", st["version"] == 4 and "eng" in st and st["eng"]["suit"] == 100, str(st.get("version")))
    ok("Mission 03 progress kept", st["flags"]["ridgeCableOpen"] and st["inventory"]["recording"] == 2)
    o = await OBJ(pg)
    ok("objective: answer the station call", o["stage"] == "m4_call", o["primary"])
    hud_hidden = await pg.evaluate("document.querySelector('.hud-base').classList.contains('hidden')")
    ok("no suit meter before Mission 04 starts", hud_hidden)
    await answer_call(bot, pg)
    await shot(pg, "B1_station_call")
    st = await S(pg)
    o = await OBJ(pg)
    ok("Mission 04 briefed", st["flags"]["m4Briefed"] and o["stage"] == "m4_home", o["stage"])
    ok("suit meter appears", not await pg.evaluate("document.querySelector('.hud-base').classList.contains('hidden')"))
    await bot.walk_to(218)
    await shot(pg, "B2_recharge_station")
    t = await bot.T()
    ok("recharge post at the station is usable", t and t["id"] == "recharge_station", str(t))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_C(p):
    """Restore every base facility: the outpost in three conditions, and the base status views."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, v4(checkpoint="cp_outpost"))
    await tp(pg, 60, 24)
    await shot(pg, "C1_outpost_abandoned_surface")
    await tp(pg, 66, 30)
    await shot(pg, "C2_outpost_abandoned_lower")
    part = v4(["batteryRestored", "recyclerInspected", "recyclerFixed", "recyclerPowered", "recyclerOn"], eng={"battery": 60}, seen=["took:cargo_locker"])
    await inject(pg, part)
    await tp(pg, 66, 30)
    await shot(pg, "C3_outpost_partial_lower")
    await tp(pg, 60, 24)
    await shot(pg, "C4_outpost_partial_surface")
    full = v4([*ALL_RESTORED, "lightsOutStarted", "lightsOutBalanced", "lightsOutDone", "m4Complete", "cropHarvested"], eng={"battery": 90, "growMs": 60000}, seen=["took:cargo_locker", "took:habitat_storage"])
    await inject(pg, full)
    await tp(pg, 64, 24)
    await pg.wait_for_timeout(1500)
    await shot(pg, "C5_outpost_full_surface")
    await tp(pg, 66, 30)
    await pg.wait_for_timeout(800)
    await shot(pg, "C6_outpost_full_lower")
    await bot.walk_to(57) if False else None
    await tp(pg, 57, 24)
    await use(bot, "base_terminal", 900)
    txt = await pg.evaluate("document.querySelector('.base-card')?.innerText || ''")
    ok("base status: every facility running", txt.count("Running") >= 7, txt[:200].replace("\n", " | "))
    await shot(pg, "C7_base_status_simple")
    await pg.get_by_role("button", name="Detailed view").click()
    await pg.wait_for_timeout(300)
    txt = await pg.evaluate("document.querySelector('.base-card')?.innerText || ''")
    ok("detailed view shows units and says they are fictional", "PU" in txt and "made-up game units" in txt)
    await shot(pg, "C8_base_status_detailed")
    await close_panel(pg)
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_D(p):
    """LIGHTS OUT, including a wrong choice first and a save/reload in the middle of it."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    s = v4(ALL_RESTORED, checkpoint="cp_lower", eng={"battery": 70, "growMs": 20000}, seen=["took:cargo_locker", "took:habitat_storage"])
    await inject(pg, s)
    for _ in range(25):
        if (await S(pg))["flags"]["lightsOutStarted"]:
            break
        await pg.wait_for_timeout(300)
    ok("LIGHTS OUT starts", (await S(pg))["flags"]["lightsOutStarted"])
    await pg.wait_for_timeout(1200)
    await shot(pg, "D1_lights_out_lower")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(300)
    await reload_continue(pg)
    st = await S(pg)
    o = await OBJ(pg)
    ok("save/reload mid-event keeps LIGHTS OUT", st["flags"]["lightsOutStarted"] and not st["flags"]["lightsOutBalanced"] and o["stage"] == "m4_balance", o["stage"])
    await bot.walk_to(52)
    await use(bot, "dist_console", 900)
    # Everything on does not fit: applying it does not balance the network.
    await pg.get_by_role("button", name="Apply").click()
    await pg.wait_for_timeout(700)
    ok("an over-budget choice does not balance the network", not (await S(pg))["flags"]["lightsOutBalanced"])
    await use(bot, "dist_console", 900)
    locked = await pg.evaluate("[...document.querySelectorAll('.dist-row.locked')].map(e => e.innerText).join(' ')")
    ok("life support is shown locked on", "Life Support" in locked and "Always on" in locked, locked[:120])
    # Switch off the grow lights by hand (the biggest load) and apply.
    await pg.locator(".dist-row", has_text="Greenhouse").locator("input").click()
    await pg.wait_for_timeout(200)
    verdict = await pg.evaluate("document.querySelector('.dist-verdict').innerText")
    await shot(pg, "D2_console_balanced_choice")
    await pg.get_by_role("button", name="Apply").click()
    await pg.wait_for_timeout(900)
    st = await S(pg)
    ok("turning the greenhouse off balances the network", st["flags"]["lightsOutBalanced"], verdict)
    ok("two panels are now dusty", len(st["eng"]["dusty"]) == 2, str(st["eng"]["dusty"]))
    await stairs_up(bot)
    await bot.walk_to(44)
    await shot(pg, "D3_dusty_panels_haze")
    for pid, col in (("panel_1", 40), ("panel_3", 48)):
        await bot.walk_to(col)
        await use(bot, pid, 900)
    st = await S(pg)
    ok("LIGHTS OUT done after sweeping", st["flags"]["lightsOutDone"] and all(st["eng"]["alloc"].values()), str(st["eng"]))
    for _ in range(20):
        if (await S(pg))["flags"]["m4Complete"]:
            break
        await pg.wait_for_timeout(300)
    ok("finale follows on the surface", (await S(pg))["flags"]["m4Complete"])
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_E(p):
    """Greenhouse: empty tray to mature plants (about a minute of active play)."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    flags = [f for f in ALL_RESTORED if f not in ("seedsPlanted", "growLightsOn")]
    await inject(pg, v4(flags, checkpoint="cp_lower", inv={"seeds": 1}, eng={"battery": 90}, seen=["took:cargo_locker", "took:habitat_storage", "tip:plants"]))
    await bot.walk_to(77)
    await shot(pg, "E0_tray_wet_empty")
    await use(bot, "planter")
    await bot.tap("KeyE") if await pg.evaluate("!document.querySelector('.tip')?.classList.contains('hidden')") else None
    await use(bot, "planter")
    await shot(pg, "E1_seeds")
    seen = []
    t0 = time.time()
    while time.time() - t0 < 75:
        st = await S(pg)
        stage = 1 + sum(1 for ms in (15000, 35000, 60000) if st["eng"]["growMs"] >= ms)
        if stage not in seen:
            seen.append(stage)
            await shot(pg, f"E{stage}_stage")
            await tp(pg, 74, 24)
            await pg.wait_for_timeout(500)
            await shot(pg, f"E{stage}_dome")
            await tp(pg, 77, 31)
        if stage == 4:
            break
        await pg.wait_for_timeout(1000)
    ok("all four plant stages seen", seen == [1, 2, 3, 4], str(seen))
    await use(bot, "planter", 1200)
    await shot(pg, "E5_harvest")
    ok("harvest works", (await S(pg))["flags"]["cropHarvested"])
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_F(p):
    """Run the suit empty, keep moving, recover (reserve trickle, recharge post, rest)."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    s = v4(checkpoint="cp_outpost", eng={"suit": 40})
    s["abilities"]["thrusters"] = True
    await inject(pg, s)
    await tp(pg, 36, 24)

    async def triple():
        await pg.keyboard.down("Space")
        await pg.wait_for_timeout(330)
        await pg.keyboard.up("Space")
        for _ in range(2):
            for _ in range(20):
                if (await bot.P())["vy"] > -30:
                    break
                await pg.wait_for_timeout(30)
            await bot.tap("Space", 120)
        for _ in range(40):
            await pg.wait_for_timeout(60)
            if (await bot.P())["grounded"]:
                break

    for _ in range(3):
        await triple()
    st = await S(pg)
    ok("thruster jumps used suit energy", st["eng"]["suit"] < 20, f"suit {st['eng']['suit']:.0f}")
    await shot(pg, "F1_suit_low")
    low_caption = await pg.evaluate("document.body.innerText.includes('suit energy') || document.body.innerText.includes('Suit energy')")
    ok("a clear low-energy message appears", low_caption)
    x0 = (await bot.P())["x"]
    await bot.walk_to(32)
    await bot.tap("Space", 300)
    await pg.wait_for_timeout(600)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(600)
    ok("walking, normal jumps and sniffing still work at low energy", abs((await bot.P())["x"] - x0) > 30)
    await pg.wait_for_timeout(13000)
    st = await S(pg)
    ok("reserve trickles back to the Adventure floor", st["eng"]["suit"] >= 24, f"suit {st['eng']['suit']:.0f}")
    await bot.walk_to(27)
    await use(bot, "recharge_outpost", 900)
    await shot(pg, "F2_recharge_post")
    ok("recharge post fills the suit", (await S(pg))["eng"]["suit"] >= 99.9)
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def boost_jump(bot, steer=None, steer_from=2, air=2):
    """Jump, thruster jump and boost, each held to its apex like a player would.

    `steer` is pressed once `steer_from` air jumps are used (2 = steer during the boost) and held
    until landing.
    """
    pg = bot.pg
    await pg.keyboard.down("Space")
    holding, rising, presses, steering = True, False, 0, False
    t0 = time.time()
    while time.time() - t0 < 3.5:
        q = await bot.P()
        if q["vy"] < -100:
            rising = True
        if steer and not steering and presses >= steer_from:
            await pg.keyboard.down(steer)
            steering = True
        if holding and rising and q["vy"] > -25:
            await pg.keyboard.up("Space")
            holding = False
            if presses < air:
                await pg.wait_for_timeout(16)
                await pg.keyboard.down("Space")
                holding, rising, presses = True, False, presses + 1
        if q["grounded"] and time.time() - t0 > 0.6:
            break
        await pg.wait_for_timeout(15)
    if holding:
        await pg.keyboard.up("Space")
    if steering:
        await pg.keyboard.up(steer)
    await pg.wait_for_timeout(300)


async def scenario_I(p):
    """Expedition mode: the three optional challenges."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    s = v4(ALL_RESTORED + ["lightsOutStarted", "lightsOutBalanced", "lightsOutDone", "m4Complete"], checkpoint="cp_canyon", eng={"battery": 60, "suit": 100})
    s["abilities"]["thrusters"] = True
    await inject(pg, s, {"survival": "expedition"})
    # Challenge A: power cell from the canyon floor, then the dead post, then the seismometer.
    await tp(pg, 160, 28)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(1500)
    await bot.walk_to(162)
    await use(bot, "buried_cell", 1300)
    await bot.walk_to(153)
    await shot(pg, "I1_dead_post")
    await use(bot, "recharge_canyon", 1000)
    await bot.walk_to(155)
    await use(bot, "seismometer", 1200)
    if await pg.evaluate("!document.querySelector('.read-card').classList.contains('hidden')"):
        await shot(pg, "I2_seismometer")
    st = await S(pg)
    ok("Challenge A: post repaired and seismometer read", st["flags"]["canyonPostFixed"] and st["flags"]["seismometerRead"])
    # Challenge B: deep survey probe in the Frozen Depths fissure (boosted jump).
    b2 = v4(ALL_RESTORED, checkpoint="cp_depths_chamber", eng={"battery": 60, "suit": 30})
    b2["abilities"]["thrusters"] = True
    b2["flags"].update({"canyonPostFixed": True, "seismometerRead": True})
    await inject(pg, b2, {"survival": "expedition"})
    await tp(pg, 92, 30)
    await bot.walk_to(91)
    st0 = (await S(pg))["eng"]["suit"]
    await use(bot, "recharge_fissure", 900)
    ok("fissure recharge post refills before the climb", (await S(pg))["eng"]["suit"] >= 99.9, f"{st0:.0f} -> {(await S(pg))['eng']['suit']:.0f}")
    # The lower ice ledge is a thruster (double) jump straight up from the fissure floor.
    await bot.walk_to(117)
    await boost_jump(bot, air=1)
    ok("fissure: the lower ledge is a normal thruster jump", (await bot.P())["row"] <= 24, str(await bot.P()))
    await bot.walk_to(116)
    await shot(pg, "I3_fissure_ledge")
    for _ in range(3):
        await boost_jump(bot, "ArrowRight", 2)
        if (await bot.P())["row"] <= 17:
            break
        await pg.wait_for_timeout(6000)  # wait for the reserve, like a player would after a miss
        await bot.walk_to(117)
        await boost_jump(bot, air=1)
        await bot.walk_to(116)
    p_ = await bot.P()
    ok("Challenge B: the boosted jump reaches the deep probe ledge", p_["row"] <= 17, str(p_))
    if p_["row"] <= 17:
        await bot.walk_to(121)
        await use(bot, "deep_probe", 1200)
    ok("Challenge B: deep survey downloaded", (await S(pg))["flags"]["fissureSurveyed"])
    await shot(pg, "I4_deep_probe")
    # Challenge C: Echo Ridge observatory.
    c = v4(ALL_RESTORED, checkpoint="cp_ridge_camp", eng={"battery": 60, "suit": 100})
    c["abilities"]["thrusters"] = True
    await inject(pg, c, {"survival": "expedition"})
    await tp(pg, 21, 30)
    await bot.walk_to(20)
    for _ in range(3):
        await boost_jump(bot)
        if (await bot.P())["row"] <= 22:
            break
        await tp(pg, 21, 30)
    p_ = await bot.P()
    ok("Challenge C: the boosted jump reaches the observatory platform", p_["row"] <= 22, str(p_))
    if p_["row"] <= 22:
        await bot.walk_to(20)
        await use(bot, "telescope_north", 1200)
    await shot(pg, "I5_observatory")
    ok("Challenge C: observatory reached", (await S(pg))["flags"]["observatoryReached"])
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_J(p):
    """Save and reload during partial restoration (inside the lower level)."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, v4(["batteryRestored", "recyclerInspected"], checkpoint="cp_outpost", eng={"battery": 55}, seen=["took:cargo_locker"]))
    await stairs_down(bot)
    await bot.walk_to(59)  # the lower-level checkpoint
    await bot.walk_to(56)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(1500)
    await bot.walk_to(55)
    await use(bot, "buried_cartridge", 1300)
    await pg.keyboard.press("Escape")  # pausing saves (and stops the simulation)
    await pg.wait_for_timeout(300)
    before = json.loads(await pg.evaluate(f"localStorage.getItem('{SAVE_KEY}')"))
    await pg.reload()
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(700)
    await pg.keyboard.press("Escape")  # freeze the values right after loading
    await pg.wait_for_timeout(300)
    st = await S(pg)
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(1500)
    p_ = await bot.P()
    ok("reload returns to the lower level checkpoint", st["checkpoint"] == "cp_lower" and p_["row"] >= 29, f"{st['checkpoint']} {p_}")
    ok("the dug-up cartridge is still in the inventory", st["inventory"]["recyclerPart"] == 1 and "buried_cartridge" in st["collected"])
    ok("battery charge persisted (saved vs. loaded, within a second of charging)", abs(st["eng"]["battery"] - before["eng"]["battery"]) < 3, f"{before['eng']['battery']:.1f} -> {st['eng']['battery']:.1f}")
    o = await OBJ(pg)
    ok("objective continues: install the cartridge", o["stage"] == "m4_cartridge_in", o["stage"])
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_K(p):
    """Travel between regions while the base runs (plants growing, battery charging)."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, v4(ALL_RESTORED, checkpoint="cp_outpost_lift", eng={"battery": 40, "growMs": 1000}, seen=["took:cargo_locker", "took:habitat_storage"]), )
    async def fps():
        return await pg.evaluate("new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); })")

    async def heap():
        await pg.evaluate("window.gc && window.gc()")
        await pg.wait_for_timeout(300)
        return await pg.evaluate("performance.memory ? performance.memory.usedJSHeapSize : 0")

    f_surface = await fps()
    await tp(pg, 70, 31)
    f_lower = await fps()
    await tp(pg, 81, 24)
    h0 = await heap()
    st0 = await S(pg)
    trips = 0
    for _ in range(3):
        await bot.walk_to(81)
        await bot.interact("outpost_lift")
        trips += await wait_map(pg, "depths", 10000)
        await bot.walk_to(11)
        await bot.interact("depths_lift")
        trips += await wait_map(pg, "surface", 10000)
    h1 = await heap()
    st = await S(pg)
    ok(f"{trips}/6 lift trips", trips == 6)
    growth = (h1 - h0) / 1e6 if h0 else 0
    ok("JS heap does not keep growing across trips", h0 == 0 or growth < 8, f"heap {h0 / 1e6:.1f} MB -> {h1 / 1e6:.1f} MB")
    RESULTS.setdefault("K_metrics", []).append((f"fps (SwiftShader, headless) surface {f_surface:.0f}, lower level {f_lower:.0f}", True, ""))
    print(f"   measured fps: surface {f_surface:.0f}, lower level {f_lower:.0f}")
    ok("plants kept growing during play in other regions", st["eng"]["growMs"] > st0["eng"]["growMs"], f"{st0['eng']['growMs']} -> {st['eng']['growMs']}")
    ok("battery stays within capacity", 0 <= st["eng"]["battery"] <= 100, f"{st['eng']['battery']:.1f}")
    ok("restored flags unchanged by travel", all(st["flags"][f] for f in ALL_RESTORED))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_L(p):
    """Phone: touch controls, base status, contextual interaction, science journal."""
    b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    c = await b.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = await c.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    bot = Bot(pg)
    s = v4(["batteryRestored"], checkpoint="cp_lower", eng={"battery": 50}, seen=["took:cargo_locker"])
    s["science"] = ["hematite", "battery", "solar_dust"]
    await inject(pg, s)
    ok("touch controls visible", await pg.evaluate("!document.querySelector('.touch').classList.contains('hidden')"))
    await bot.walk_to(68)
    await shot(pg, "L1_mobile_lower_level")
    act = pg.locator(".touch [data-action='interact'], .touch .btn-interact").first
    if await act.count():
        await act.tap()
    else:
        await bot.tap("KeyE")
    await pg.wait_for_timeout(800)
    ok("contextual action on the recycler (inspect) works from touch", (await S(pg))["flags"]["recyclerInspected"])
    await pg.locator("button[aria-label='Pause']").tap()
    await pg.wait_for_timeout(400)
    await pg.get_by_role("button", name="Base status").tap()
    await pg.wait_for_timeout(500)
    ok("base status opens on the phone", await pg.evaluate("!!document.querySelector('.base-card')"))
    ok("touch controls hidden under the panel", await pg.evaluate("document.querySelector('.touch').classList.contains('menu-open') || document.querySelector('.touch').classList.contains('hidden')"))
    await shot(pg, "L2_mobile_base_status")
    await pg.get_by_role("button", name="Close").tap()
    await pg.wait_for_timeout(300)
    await pg.locator("button[aria-label='Pause']").tap()
    await pg.wait_for_timeout(400)
    await pg.get_by_role("button", name="Science journal").tap()
    await pg.wait_for_timeout(400)
    await pg.get_by_role("tab").filter(has_text="Solar").tap()
    await pg.wait_for_timeout(300)
    await pg.get_by_role("button", name="Learn more").first.tap()
    await pg.wait_for_timeout(300)
    txt = await pg.evaluate("document.querySelector('.sci-card').innerText")
    ok("science journal entry shows real science, fiction note and a source", "In the game:" in txt and "Source:" in txt, txt[:160].replace("\n", " | "))
    await shot(pg, "L3_mobile_science_journal")
    over = await pg.evaluate("(() => { const c = document.querySelector('.sci-card').getBoundingClientRect(); return c.right <= innerWidth + 1 && c.left >= -1; })()")
    ok("journal fits the phone screen width", over)
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_M(p):
    """Values do not change while paused, hidden, or with the game closed."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, v4(ALL_RESTORED, checkpoint="cp_lower", eng={"battery": 50, "growMs": 5000, "suit": 60}, seen=["took:cargo_locker", "took:habitat_storage"]))
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(400)
    a = (await S(pg))["eng"]
    await pg.wait_for_timeout(5000)
    b_ = (await S(pg))["eng"]
    ok("paused: battery, plants and suit frozen", a == b_, f"{a} vs {b_}")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(400)
    # Hidden tab: the game pauses itself on visibilitychange.
    await pg.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))")
    await pg.wait_for_timeout(300)
    a = (await S(pg))["eng"]
    await pg.wait_for_timeout(5000)
    b_ = (await S(pg))["eng"]
    ok("hidden tab: values frozen (game paused itself)", a == b_ and await menu_open(pg), f"{a} vs {b_}")
    await pg.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })")
    saved = json.loads(await pg.evaluate(f"localStorage.getItem('{SAVE_KEY}')"))
    await pg.goto("about:blank")
    await asyncio.sleep(6)
    await pg.goto(URL)
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(1500)
    st = await S(pg)
    ok("closed game: nothing simulated offline", abs(st["eng"]["growMs"] - saved["eng"]["growMs"]) <= 1000 and abs(st["eng"]["battery"] - saved["eng"]["battery"]) < 1.5, f"saved {saved['eng']} loaded {st['eng']}")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_A(p):
    """Fresh game through Missions 00, 01, 02, 03 (Phase 3 route) and 04."""
    from phase3 import scenario_A as phase3_A_body  # noqa: F401  (route pieces below)
    from phase3 import m02_station_to_depths, m02_depths, m02_finish, m03_to_ridge, m03_ridge
    from phase2 import mission01, tutorial_keyboard
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("New Game").click()
    await pg.wait_for_timeout(1300)
    await tutorial_keyboard(bot, pg, shots=False)
    ok("Mission 00 completed", (await S(pg))["tutorial"]["status"] == "done")
    await mission01(bot, pg, prefix="../phase4/A0")
    ok("Mission 01 completed", (await S(pg))["flags"]["demoComplete"])
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(600)
    if await pg.evaluate("!!document.querySelector('.screen')"):
        await pg.get_by_text("Keep exploring").click()
        await pg.wait_for_timeout(500)
    await m02_station_to_depths(bot, pg, shots=False)
    await m02_depths(bot, pg, shots=False)
    await m02_finish(bot, pg, shots=False)
    ok("Mission 02 completed", (await S(pg))["flags"]["relayAnalyzed"])
    await m03_to_ridge(bot, pg)
    await m03_ridge(bot, pg, shots=False)
    ok("Mission 03 completed", (await S(pg))["flags"]["ridgeCableOpen"])
    if await pg.evaluate("!!document.querySelector('.screen')"):
        await pg.get_by_text("Keep exploring").click()
        await pg.wait_for_timeout(800)
    o = await OBJ(pg)
    ok("Mission 03 leads into Mission 04", o["stage"] == "m4_call", o["stage"])
    # Mission 03 ends when the cable car starts; ride it down to the station like the hint says.
    await bot.interact("ridge_cable")
    ok("cable car rides down to the Ares Station", await wait_map(pg, "surface", 10000))
    await answer_call(bot, pg)
    await mission04(bot, pg, prefix="A", shots=False)
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


SCEN = {"A": scenario_A, "B": scenario_B, "C": scenario_C, "D": scenario_D, "E": scenario_E, "F": scenario_F, "G": scenario_G, "H": scenario_H, "I": scenario_I, "J": scenario_J, "K": scenario_K, "L": scenario_L, "M": scenario_M, "X": scenario_X}


async def main():
    which = [a.upper() for a in sys.argv[1:]] or [k for k in SCEN if k != "X"]
    async with async_playwright() as p:
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
