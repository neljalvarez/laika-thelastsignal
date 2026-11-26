"""
Phase 3 browser play-tests (scenarios A-K from the Phase 3 brief), with real keyboard / touch input.

    npm run build && npm run preview          # http://localhost:4173
    python playtest/phase3.py [A B C ...]     # default: all. Screenshots -> playtest/out/phase3/

window.__laika (enabled by ?debug) is used to READ state and position. Saves are injected through
localStorage to start scenarios at a mission boundary. Scenario E (optional discoveries) and J (travel
stress) use the debug teleport between sites to keep run time reasonable; every pickup, dig, bark and
puzzle is still done with real key presses. All other scenarios never teleport.
"""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(__file__))
from playthrough import Bot, URL, controlled_hop, jump_dir  # noqa: E402
from phase2 import mission01, tutorial_keyboard, touch_hold, dpad  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "out", "phase3") + os.sep
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or None
RESULTS = {}
CUR = ["?"]


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


async def MAP(pg):
    return await pg.evaluate("window.__laika.map()")


async def wait_map(pg, m, ms=6000):
    t0 = time.time()
    while (time.time() - t0) * 1000 < ms:
        try:
            if await MAP(pg) == m:
                await pg.wait_for_timeout(500)
                return True
        except Exception:
            pass
        await pg.wait_for_timeout(150)
    return False


# ---------------------------------------------------------------- saves

M01_FLAGS = ["checkedShipRadio", "hatchOpen", "reachedOutpost", "inspectedReceiver", "solarRepaired", "moduleInstalled", "commsOnline", "bridgeExtended", "stationDoorOpen", "reachedStation", "demoComplete"]
M02_FLAGS = ["m2Briefed", "depthsReached", "passageOpen", "junctionInspected", "circuitRestored", "iceChamberReached", "depthsLiftOpen", "relayAnalyzed"]


def save_v3(flags=(), checkpoint="cp_station", **over):
    s = {
        "version": 3,
        "flags": {k: True for k in [*M01_FLAGS, *flags]},
        "inventory": {"metal": 0, "electronics": 0, "commsModule": 0, "sample": 1, "treat": 0, "coupling": 0, "relayCell": 0, "recording": 0, "roverPart": 0},
        "collected": ["sample_basalt"],
        "abilities": {"sniff": True, "sweep": True, "thrusters": False, "bark": True, "headlamp": "headlamp" in over.get("abil", ())},
        "sweptPanels": ["panel_1", "panel_2", "panel_3"],
        "seen": [],
        "checkpoint": checkpoint,
        "visitedCheckpoints": ["cp_ship", "cp_outpost", "cp_canyon", "cp_rover", "cp_rim", "cp_station"],
        "playTimeMs": 600000,
        "tutorial": {"status": "done", "stage": "done"},
        "discovered": {"maps": ["surface"], "sections": [], "landmarks": []},
        "puzzles": {"relayAim": {"relay_a": 3, "relay_b": 0, "relay_c": 1}},
    }
    over.pop("abil", None)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(s.get(k), dict):
            s[k].update(v)
        else:
            s[k] = v
    return s


def after_m02(**over):
    s = save_v3(M02_FLAGS, checkpoint="cp_outpost", abil=("headlamp",), **over)
    s["abilities"]["headlamp"] = True
    s["inventory"]["relayCell"] = 1
    s["inventory"]["sample"] = 2
    s["collected"] += ["sampler", "coupling_cache"]
    s["discovered"]["maps"] = ["surface", "depths"]
    return s


async def inject(pg, state, settings=None):
    await pg.goto(URL)
    await pg.wait_for_timeout(700)
    await pg.evaluate("s => localStorage.setItem('laika-the-last-signal/save', s)", json.dumps(state))
    if settings:
        await pg.evaluate("s => localStorage.setItem('laika-the-last-signal/settings', s)", json.dumps(settings))
    await pg.reload()
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(2300)


# ---------------------------------------------------------------- route pieces


async def hop(bot, key, steer=220, hold=450):
    await controlled_hop(bot.pg, key, steer_ms=steer, hold=hold)


async def until_row(bot, row, tries=4, key="ArrowLeft", steer=230):
    """Hop in a direction until Laika stands at (or above) `row`."""
    for _ in range(tries):
        p = await bot.P()
        if p["row"] <= row and p["grounded"]:
            return True
        await hop(bot, key, steer)
    return (await bot.P())["row"] <= row


async def m02_station_to_depths(bot, pg, shots=True):
    await bot.walk_to(231)
    await bot.interact("beacon")
    await pg.wait_for_timeout(400)
    await bot.close_trans()
    await bot.walk_to(226)
    await bot.interact("station_lift")
    await wait_map(pg, "depths")
    if shots:
        await shot(pg, "A1_depths_entrance")


async def m02_depths(bot, pg, shots=True):
    """From the freight lift arrival to the relay cell and the started survey lift."""
    await bot.walk_to(124)
    await bot.interact("headlamp_kit")
    await pg.wait_for_timeout(700)
    await bot.walk_to(100)
    await bot.walk_to(86)
    if shots:
        await shot(pg, "A2_dark_chamber_headlamp")
    await bot.walk_to(68)
    await bot.interact("light_sensor")
    await pg.wait_for_timeout(2300)
    await bot.walk_to(48)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(900)
    await bot.walk_to(44)
    await bot.interact("coupling_cache")
    await pg.wait_for_timeout(800)
    # Down the ice-shelf zigzag to the junction.
    await bot.walk_to(40)
    await bot.walk_to(36)
    await bot.walk_to(39)
    await bot.walk_to(46)
    if shots:
        await shot(pg, "A3_junction_before")
    await bot.walk_to(52)
    await bot.interact("depths_junction")
    await pg.wait_for_timeout(1600)
    if shots:
        await shot(pg, "A4_circuit_restored")
    await bot.walk_to(23)
    await bot.interact("sampler")
    await pg.wait_for_timeout(1200)
    if shots:
        await shot(pg, "A5_ice_chamber")
    await bot.walk_to(11)
    await bot.interact("depths_lift")
    await pg.wait_for_timeout(900)


async def m02_finish(bot, pg, shots=True):
    await bot.interact("depths_lift")  # ride up: the shortcut
    await wait_map(pg, "surface")
    if shots:
        await shot(pg, "A6_shortcut_outpost")
    await bot.walk_to(70)
    await bot.interact("receiver")
    await pg.wait_for_timeout(400)
    await bot.close_trans()
    await pg.wait_for_timeout(3600)


async def m03_to_ridge(bot, pg):
    await bot.walk_to(81)
    await bot.interact("outpost_lift")
    await wait_map(pg, "depths")
    # Through the service hatch and down its shelf ladder.
    for c in (5, 3, 6, 3, 6):
        await bot.walk_to(c)
    await bot.walk_to(128, timeout=40000, sprint=True)
    await bot.walk_to(130)
    await bot.interact("depths_north")
    await wait_map(pg, "ridge")


async def over_the_knob(bot):
    """Ridge Camp -> step ledge -> top of the rock knob (walking straight on leads into the hidden ruin)."""
    for _ in range(4):
        p = await bot.P()
        if p["row"] <= 29 and p["col"] >= 64:
            return True
        if p["row"] >= 33 and p["col"] >= 65:  # inside the ruin: step back out first
            await bot.walk_to(63)
            await hop(bot, "ArrowLeft", 120)
        await bot.walk_to(60)
        await hop(bot, "ArrowRight", 130)
        p = await bot.P()
        if p["row"] <= 31:
            # Like a player: hold right and jump, keep holding until landing on the knob.
            await jump_dir(bot, "ArrowRight", hold=450, sprint=False, pre=0)
    return (await bot.P())["row"] <= 29


async def m03_ridge(bot, pg, shots=True):
    if shots:
        await shot(pg, "A7_ridge_approach")
    await bot.walk_to(19)
    await bot.interact("relay_a")
    await pg.wait_for_timeout(700)
    await bot.walk_to(41)
    await bot.walk_to(49)
    # Switchbacks: L1 left, L2 left, L3 right, L4 left, L5 right, L6 left.
    await until_row(bot, 49, key="ArrowLeft", steer=200)
    await until_row(bot, 47, key="ArrowLeft", steer=260)
    await until_row(bot, 45, key="ArrowRight", steer=260)
    await until_row(bot, 43, key="ArrowLeft", steer=260)
    if shots:
        await shot(pg, "A8_cliff_climb")
    await until_row(bot, 41, key="ArrowRight", steer=260)
    await until_row(bot, 39, key="ArrowLeft", steer=260)
    # Relay C: follow the faint signal into the boulder.
    await bot.tap("KeyF")
    await pg.wait_for_timeout(700)
    await bot.walk_to(35)
    for _ in range(3):
        await bot.interact("relay_c")
        await pg.wait_for_timeout(250)
    await bot.walk_to(39)
    await until_row(bot, 39, key="ArrowRight", steer=180)
    await until_row(bot, 37, key="ArrowRight", steer=260)
    await until_row(bot, 35, key="ArrowRight", steer=200)
    await bot.walk_to(53)
    await bot.walk_to(58)
    await bot.interact("comms_junction")
    await pg.wait_for_timeout(500)
    await over_the_knob(bot)
    await bot.walk_to(86)
    await bot.walk_to(88)
    for _ in range(3):
        await bot.interact("relay_b")
        await pg.wait_for_timeout(300)
    await pg.wait_for_timeout(2400)
    if shots:
        await shot(pg, "A9_network_online")
    # Tower stairs.
    await bot.walk_to(95)
    await until_row(bot, 21, key="ArrowRight", steer=60)
    for row, key in ((19, "ArrowRight"), (17, "ArrowLeft"), (15, "ArrowRight"), (13, "ArrowLeft"), (11, "ArrowRight"), (9, "ArrowLeft")):
        await until_row(bot, row, key=key, steer=330)
    await bot.walk_to(99)
    if shots:
        await shot(pg, "A10_tower_top")
    await bot.interact("tower_console")
    await pg.wait_for_timeout(400)
    await bot.close_trans()
    await pg.wait_for_timeout(600)
    await bot.walk_to(105)
    await bot.interact("ridge_cable")
    await pg.wait_for_timeout(2400)
    if shots:
        await shot(pg, "A11_mission03_complete")


# ---------------------------------------------------------------- scenarios


async def scenario_A(p):
    """Fresh game -> Mission 00 -> 01 -> 02 -> 03."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("New Game").click()
    await pg.wait_for_timeout(1300)
    await tutorial_keyboard(bot, pg, shots=False)
    ok("Mission 00 completed", (await S(pg))["tutorial"]["status"] == "done")
    await mission01(bot, pg, prefix="../phase3/A0")
    st = await S(pg)
    ok("Mission 01 completed", st["flags"]["demoComplete"])
    await pg.keyboard.press("Escape")  # close the completion card ("Keep exploring" = resume)
    await pg.wait_for_timeout(600)
    if await pg.evaluate("!!document.querySelector('.screen')"):
        await pg.get_by_text("Keep exploring").click()
        await pg.wait_for_timeout(500)
    o = await pg.evaluate("window.__laika.objective()")
    ok("Mission 01 leads straight into Mission 02", o["stage"] == "m2_brief", o["primary"])
    await m02_station_to_depths(bot, pg)
    await m02_depths(bot, pg)
    await m02_finish(bot, pg)
    st = await S(pg)
    ok("Mission 02 completed (relay cell analysed)", st["flags"]["relayAnalyzed"], str({k: v for k, v in st["flags"].items() if k in M02_FLAGS}))
    await m03_to_ridge(bot, pg)
    await m03_ridge(bot, pg)
    st = await S(pg)
    ok("Mission 03 completed (cable car started)", st["flags"]["ridgeCableOpen"], str({k: st["flags"][k] for k in ["relayASwept", "cellInstalled", "relayCFound", "relayNetworkOnline", "signalTraced"]}))
    ok("completion screen shown", await pg.evaluate("document.querySelector('.complete-card')?.textContent?.includes('MISSION 03') || false"))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


SCEN = {"A": scenario_A}




# ---------------------------------------------------------------- more scenarios (B-K)

async def phase2_v2_save():
    """A completed Phase 2 (save format v2) player, standing in the station after Mission 01."""
    s = save_v3()
    s["version"] = 2
    del s["discovered"], s["puzzles"]
    del s["abilities"]["headlamp"]
    s["inventory"] = {"metal": 1, "electronics": 1, "commsModule": 0, "sample": 2, "treat": 1}
    s["collected"] = ["metal_ship", "treat", "sample_basalt", "sample_gypsum"]
    return s


async def scenario_B(p):
    """Load a completed Phase 2 save -> continue into the new regions."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    v2 = await phase2_v2_save()
    await inject(pg, v2)
    st = await S(pg)
    ok("v2 save loads as the current version (v3 in Phase 3, v4 since Phase 4)", st["version"] >= 3, str(st["version"]))
    ok("inventory and collectibles kept", st["inventory"]["treat"] == 1 and st["inventory"]["sample"] == 2 and "treat" in st["collected"], str(st["inventory"]))
    ok("Mission 01 still complete, tutorial not forced", st["flags"]["demoComplete"] and st["tutorial"]["status"] == "done")
    ok("map back-filled from old checkpoints", "s_station" in st["discovered"]["sections"] and "s_outpost" in st["discovered"]["sections"], str(st["discovered"]["sections"]))
    o = await pg.evaluate("window.__laika.objective()")
    ok("continues with Mission 02", o["stage"] == "m2_brief", o["primary"])
    await m02_station_to_depths(bot, pg, shots=False)
    ok("reaches Frozen Depths", await MAP(pg) == "depths")
    await bot.walk_to(124)
    await bot.interact("headlamp_kit")
    st = await S(pg)
    ok("Headlamp found and saved", st["abilities"]["headlamp"])
    await shot(pg, "B1_phase2_save_in_depths")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_C(p, settings=None, prefix="C"):
    """Explore Frozen Depths, complete its puzzles, and return through the shortcut."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, save_v3(("m2Briefed", "depthsReached"), checkpoint="cp_depths_freight"), settings)
    ok("starts in Frozen Depths", await MAP(pg) == "depths")
    await shot(pg, f"{prefix}1_depths_entrance")
    await bot.walk_to(122)
    await shot(pg, f"{prefix}2_cave_interior_no_lamp")
    await m02_depths(bot, pg, shots=True)
    st = await S(pg)
    f = st["flags"]
    ok("Puzzle A: light sensor opened the shutter", f["passageOpen"])
    ok("Puzzle B: circuit restored with the coupling", f["circuitRestored"] and st["inventory"]["coupling"] == 0)
    ok("Puzzle C: drill gave water ice + relay cell", "sampler" in st["collected"] and st["inventory"]["relayCell"] == 1)
    ok("shortcut lift started", f["depthsLiftOpen"])
    await m02_finish(bot, pg, shots=False)
    p_ = await bot.P()
    ok("returned to the surface by the survey lift", await MAP(pg) == "surface" and 60 <= p_["col"] <= 85, str(p_))
    st = await S(pg)
    ok("Mission 02 complete", st["flags"]["relayAnalyzed"])
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_D(p, settings=None, prefix="D"):
    """Explore Echo Ridge, activate its relay network, and reach the final tower."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, after_m02(), settings)
    await m03_to_ridge(bot, pg)
    ok("North Access leads to Echo Ridge", await MAP(pg) == "ridge")
    await m03_ridge(bot, pg, shots=True)
    st = await S(pg)
    f = st["flags"]
    ok("Relay A swept, cell installed, Relay C found", f["relayASwept"] and f["cellInstalled"] and f["relayCFound"])
    ok("relay network online", f["relayNetworkOnline"])
    ok("signal traced at the tower", f["signalTraced"])
    ok("cable car shortcut started (Mission 03 complete)", f["ridgeCableOpen"])
    for name in ("A7_ridge_approach", "A8_cliff_climb", "A9_network_online", "A10_tower_top", "A11_mission03_complete"):
        if os.path.exists(OUT + name + ".png"):
            os.replace(OUT + name + ".png", OUT + name.replace("A", prefix, 1) + ".png")
    # Ride the cable car down to the station (the second shortcut).
    await pg.get_by_text("Keep exploring").click()
    await pg.wait_for_timeout(600)
    await bot.interact("ridge_cable")
    await wait_map(pg, "surface")
    pp = await bot.P()
    ok("cable car arrives in the Ares Station", await MAP(pg) == "surface" and pp["col"] >= 216, str(pp))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def tp(pg, col, row):
    await pg.evaluate(f"window.__laika.teleport({col}, {row + 1})")
    await pg.wait_for_timeout(500)


async def scenario_E(p):
    """Optional discoveries with the Headlamp, Sniff, Bark and Thruster Boots (teleports between sites)."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    s = save_v3(("m2Briefed", "depthsReached", "passageOpen", "junctionInspected", "circuitRestored"), checkpoint="cp_depths_chamber")
    s["abilities"].update({"headlamp": True, "thrusters": True})
    await inject(pg, s)
    # Headlamp: the reflective X on the false wall; walk through it into the hidden alcove.
    await tp(pg, 64, 13)
    await pg.keyboard.down("ArrowLeft")
    await pg.wait_for_timeout(60)
    await pg.keyboard.up("ArrowLeft")
    await pg.wait_for_timeout(300)
    await shot(pg, "E1_headlamp_reveals_mark")
    await bot.walk_to(54)
    await pg.wait_for_timeout(500)
    st = await S(pg)
    ok("hidden alcove: Golden Treat (headlamp mark + false wall)", "treat_depths" in st["collected"])
    # Sniff: the buried survey recorder on the chamber floor.
    await tp(pg, 76, 29)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(900)
    await bot.walk_to(72)
    await bot.interact("recorder_depths")
    await pg.wait_for_timeout(800)
    ok("survey recorder dug up (sniff)", "recorder_depths" in (await S(pg))["collected"])
    # Sniff: clay sample in the ice chamber; Boots: R-2's antenna on the high shelf.
    await tp(pg, 19, 27)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(900)
    await bot.walk_to(16)
    await bot.interact("sample_clay")
    await pg.wait_for_timeout(800)
    ok("clay sample (sniff)", "sample_clay" in (await S(pg))["collected"])
    await bot.walk_to(25)
    await pg.keyboard.down("ArrowRight")
    await pg.wait_for_timeout(50)
    await pg.keyboard.up("ArrowRight")
    await tp(pg, 26, 25)
    await pg.keyboard.down("ArrowLeft")
    await pg.keyboard.down("Space")
    await pg.wait_for_timeout(330)
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(90)
    await pg.keyboard.down("Space")
    await pg.wait_for_timeout(300)
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(500)
    await pg.keyboard.up("ArrowLeft")
    await pg.wait_for_timeout(500)
    await bot.walk_to(19)
    await pg.wait_for_timeout(400)
    ok("R-2's antenna on the ice shelf (Thruster Boots)", "rover_antenna" in (await S(pg))["collected"], str(await bot.P()))
    # Echo Ridge.
    s2 = after_m02()
    s2["abilities"]["thrusters"] = True
    s2["flags"].update({"ridgeReached": True, "relayASwept": True, "cellInstalled": True, "relayCFound": True, "relayNetworkOnline": True})
    s2["puzzles"]["relayAim"].update({"relay_b": 3, "relay_c": 4})
    s2["checkpoint"] = "cp_ridge_base"
    s2["inventory"]["relayCell"] = 0
    await inject(pg, s2)
    await bot.walk_to(30)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(900)
    await bot.walk_to(33)
    await bot.interact("rover_wheel")
    await pg.wait_for_timeout(800)
    ok("R-2's wheel where the rover tracks end (sniff)", "rover_wheel" in (await S(pg))["collected"])
    # Boots route: from ledge B4 up to the olivine ledge, then to the weather-station pillar.
    await tp(pg, 17, 41)
    # One double jump up-left (a separate hop first walks Laika off the ledge).
    await pg.keyboard.down("ArrowLeft")
    await pg.keyboard.down("Space")
    await pg.wait_for_timeout(330)
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(80)
    await pg.keyboard.down("Space")
    await pg.wait_for_timeout(350)
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(400)
    await pg.keyboard.up("ArrowLeft")
    await pg.wait_for_timeout(400)
    await bot.walk_to(9)
    await pg.wait_for_timeout(500)
    ok("olivine sample on the high ledges (Thruster Boots)", "sample_olivine" in (await S(pg))["collected"], str(await bot.P()))
    await shot(pg, "E2_high_ledges_boots")
    await tp(pg, 15, 33)
    await pg.keyboard.down("ArrowRight")
    await pg.keyboard.down("Space")
    await pg.wait_for_timeout(330)
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(80)
    await pg.keyboard.down("Space")
    await pg.wait_for_timeout(350)
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(350)
    await pg.keyboard.up("ArrowRight")
    await pg.wait_for_timeout(400)
    await bot.walk_to(21)
    await bot.interact("weather_station")
    ok("hidden weather station (Thruster Boots)", "weather_station" in (await S(pg))["seen"], str(await bot.P()))
    # Looking behind terrain: the habitat ruin.
    await tp(pg, 60, 33)
    await bot.walk_to(71)
    await pg.wait_for_timeout(600)
    ok("habitat ruin recording (false wall)", "recording_ruin" in (await S(pg))["collected"])
    # Bark: the acoustic sensor extends a bridge to the cache.
    await tp(pg, 64, 9)
    await bot.tap("KeyB")
    await pg.wait_for_timeout(2000)
    ok("bark at the acoustic sensor extends the bridge", (await S(pg))["flags"]["ridgeBridgeOut"])
    await shot(pg, "E3_bark_bridge")
    await bot.walk_to(51)
    await pg.wait_for_timeout(500)
    ok("overlook cache: Golden Treat", "treat_ridge" in (await S(pg))["collected"])
    await pg.keyboard.press("KeyM")
    await pg.wait_for_timeout(500)
    await shot(pg, "E4_world_map")
    ok("world map opens with M", await pg.evaluate("window.__laika.mapOpen()"))
    await pg.keyboard.press("KeyM")
    await pg.wait_for_timeout(300)
    ok("and closes with M", not await pg.evaluate("window.__laika.mapOpen()"))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def reload_continue(pg):
    await pg.reload()
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(2300)


async def scenario_F(p):
    """Save and reload inside each new region."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, save_v3(("m2Briefed", "depthsReached"), checkpoint="cp_depths_freight"))
    await bot.walk_to(124)
    await bot.interact("headlamp_kit")
    await bot.walk_to(110)
    await pg.keyboard.press("Escape")  # pausing saves
    await pg.wait_for_timeout(300)
    await reload_continue(pg)
    st = await S(pg)
    ok("depths: reload returns to Frozen Depths", await MAP(pg) == "depths", st["checkpoint"])
    ok("depths: headlamp kept", st["abilities"]["headlamp"])
    s2 = after_m02()
    s2["flags"]["ridgeReached"] = True
    s2["checkpoint"] = "cp_ridge_hatch"
    await inject(pg, s2)
    await bot.walk_to(19)
    await bot.interact("relay_a")
    await bot.walk_to(12)  # passes the Ridge Base checkpoint
    await pg.wait_for_timeout(300)
    await reload_continue(pg)
    st = await S(pg)
    ok("ridge: reload returns to Echo Ridge at the last checkpoint", await MAP(pg) == "ridge" and st["checkpoint"] == "cp_ridge_base", st["checkpoint"])
    ok("ridge: Relay A stays restored", st["flags"]["relayASwept"])
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_G(p):
    """Save during incomplete puzzle progression and resume."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    s = save_v3(("m2Briefed", "depthsReached", "passageOpen"), checkpoint="cp_depths_equipment")
    s["abilities"]["headlamp"] = True
    await inject(pg, s)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(900)
    await bot.walk_to(44)
    await bot.interact("coupling_cache")
    await pg.wait_for_timeout(800)
    await reload_continue(pg)
    st = await S(pg)
    ok("coupling held across reload (circuit not yet fixed)", st["inventory"]["coupling"] == 1 and not st["flags"]["circuitRestored"])
    o = await pg.evaluate("window.__laika.objective()")
    ok("objective resumes at 'install the coupling'", o["stage"] == "m2_install", o["primary"])
    s2 = after_m02()
    s2["flags"].update({"ridgeReached": True, "relayASwept": True, "cellInstalled": True})
    s2["inventory"]["relayCell"] = 0
    s2["checkpoint"] = "cp_ridge_platform"
    await inject(pg, s2)
    await bot.walk_to(88)
    await bot.interact("relay_b")
    await pg.wait_for_timeout(300)
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(300)
    await reload_continue(pg)
    st = await S(pg)
    ok("half-turned relay dish keeps its direction", st["puzzles"]["relayAim"]["relay_b"] == 1, str(st["puzzles"]))
    ok("network not falsely online", not st["flags"]["relayNetworkOnline"])
    await bot.walk_to(88)
    for _ in range(2):
        await bot.interact("relay_b")
        await pg.wait_for_timeout(300)
    ok("finishing the turn after reload aligns Relay B", (await S(pg))["puzzles"]["relayAim"]["relay_b"] == 3)
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


EASY_SETTINGS = {"assistJumps": True, "reducedMotion": True, "brightCaves": True, "captions": True, "textScale": 1.25}


async def scenario_H(p):
    """Mandatory missions with Easy Jumps, reduced motion and brighter caves."""
    await scenario_C(p, EASY_SETTINGS, prefix="H_C")
    await scenario_D(p, EASY_SETTINGS, prefix="H_D")


async def scenario_I(p):
    """Navigate both new regions using mobile touch controls."""
    from phase2 import touch_walk_to
    b, pg, errs = await new_browser(p, viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, device_scale_factor=2)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(700)
    await pg.evaluate("s => localStorage.setItem('laika-the-last-signal/save', s)", json.dumps(save_v3(("m2Briefed", "depthsReached"), checkpoint="cp_depths_freight")))
    await pg.reload()
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").tap()
    await pg.wait_for_timeout(2300)
    ok("touch controls visible", await pg.evaluate("!document.querySelector('.touch').classList.contains('hidden')"))
    await touch_walk_to(bot, pg, 124)
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(700)
    ok("touch: Headlamp fixed", (await S(pg))["abilities"]["headlamp"])
    await touch_walk_to(bot, pg, 100)
    await touch_walk_to(bot, pg, 86)
    await shot(pg, "I1_touch_depths")
    await touch_walk_to(bot, pg, 68)
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(1500)
    ok("touch: light-sensor puzzle", (await S(pg))["flags"]["passageOpen"])
    await pg.evaluate("document.querySelectorAll('.hud-btn')[0]?.click()")  # map button (first HUD button)
    await pg.wait_for_timeout(500)
    opened = await pg.evaluate("window.__laika.mapOpen()")
    await shot(pg, "I2_touch_map")
    ok("touch: controls are hidden while the map is open (they never cover its buttons)", await pg.evaluate("getComputedStyle(document.querySelector('.touch')).display === 'none'"))
    # A real tap on the left end of "Close map", where the D-pad used to sit on top of it.
    box = await pg.locator(".world-map button").bounding_box()
    await pg.touchscreen.tap(box["x"] + 20, box["y"] + box["height"] / 2)
    await pg.wait_for_timeout(400)
    ok("touch: map button opens and closes the map", opened and not await pg.evaluate("window.__laika.mapOpen()"))
    ok("touch: controls come back after closing the map", await pg.evaluate("getComputedStyle(document.querySelector('.touch')).display !== 'none'"))
    s2 = after_m02()
    s2["flags"]["ridgeReached"] = True
    s2["checkpoint"] = "cp_ridge_hatch"
    # Leave the running game first: it autosaves when the page is hidden, which would overwrite the injected save.
    await pg.goto(URL)
    await pg.wait_for_timeout(700)
    await pg.evaluate("s => localStorage.setItem('laika-the-last-signal/save', s)", json.dumps(s2))
    await pg.reload()
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").tap()
    await pg.wait_for_timeout(2300)
    await touch_walk_to(bot, pg, 19)
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(700)
    ok("touch: Relay A swept on the ridge", (await S(pg))["flags"]["relayASwept"])
    await touch_walk_to(bot, pg, 49)
    p_ = await bot.P()
    ok("touch: climbs the first steps of the ridge", await MAP(pg) == "ridge" and p_["row"] <= 51, str(p_))
    await shot(pg, "I3_touch_ridge")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_J(p):
    """Travel repeatedly between regions; check state and memory."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, after_m02())
    before = await S(pg)
    await bot.walk_to(81)

    async def heap():
        await pg.evaluate("window.gc && window.gc()")
        await pg.wait_for_timeout(300)
        return await pg.evaluate("performance.memory ? performance.memory.usedJSHeapSize : 0")

    async def fps():
        return await pg.evaluate("new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); })")

    h0 = await heap()
    f_surface = await fps()
    trips = 0
    slow = []

    async def ride(obj, col, dest):
        # Arrivals are a step away from the lift (no transition loops), so walk up to it like a player.
        n = len(bot.log)
        t0 = time.time()
        await bot.walk_to(col)
        q = await bot.P()
        tg = await bot.T()
        await bot.interact(obj)
        if await wait_map(pg, dest):
            return 1
        late = await wait_map(pg, dest, 10000)
        slow.append(f"{obj}: at col {q['col']} row {q['row']}, target {tg}, arrived late: {late} ({time.time() - t0:.1f}s), bot log {bot.log[n:]}")
        print("   TRIP PROBLEM", slow[-1])
        return 0

    for i in range(6):
        trips += await ride("outpost_lift", 81, "depths")
        if i == 0:
            f_depths = await fps()
        trips += await ride("depths_lift", 11, "surface")
    h1 = await heap()
    after = await S(pg)
    ok(f"{trips}/12 lift trips completed", trips == 12, "; ".join(slow))
    ok("no state drift across the trips", after["inventory"] == before["inventory"] and after["collected"] == before["collected"] and {k: v for k, v in after["flags"].items()} == {k: v for k, v in before["flags"].items()})
    pos = await bot.P()
    # The arrival saves cp_outpost_lift; the regular outpost checkpoint nearby may take over once she stands there.
    ok("ends at the outpost lift arrival", await MAP(pg) == "surface" and abs(pos["col"] - 81) <= 4 and after["checkpoint"] in ("cp_outpost_lift", "cp_outpost"), f"col {pos['col']}, checkpoint {after['checkpoint']}")
    growth = (h1 - h0) / 1e6 if h0 else 0
    ok("JS heap does not keep growing across trips", h0 == 0 or growth < 8, f"heap {h0 / 1e6:.1f} MB -> {h1 / 1e6:.1f} MB")
    print(f"   measured fps (SwiftShader, headless): surface {f_surface:.0f}, depths {f_depths:.0f}")
    RESULTS.setdefault("J_metrics", []).append((f"fps surface {f_surface:.0f}, depths {f_depths:.0f}; heap {h0 / 1e6:.1f}->{h1 / 1e6:.1f} MB", True, ""))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_K(p):
    """Try to reach locked regions before meeting their requirements."""
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await inject(pg, save_v3())
    await bot.walk_to(226)
    await bot.interact("station_lift")
    await pg.wait_for_timeout(1500)
    ok("freight lift stays shut before the relay logs", await MAP(pg) == "surface")
    await bot.walk_to(233)
    await bot.interact("station_cable")
    await pg.wait_for_timeout(1500)
    ok("cable car stays shut before the tower", await MAP(pg) == "surface")
    await shot(pg, "K1_locked_cable_car")
    s = save_v3(("m2Briefed",), checkpoint="cp_outpost")
    await inject(pg, s)
    await bot.walk_to(81)
    await bot.interact("outpost_lift")
    await pg.wait_for_timeout(1500)
    ok("survey lift stays shut before its power is restored", await MAP(pg) == "surface")
    s = save_v3(("m2Briefed", "depthsReached", "passageOpen", "junctionInspected", "circuitRestored"), checkpoint="cp_depths_lift")
    s["abilities"]["headlamp"] = True
    await inject(pg, s)
    for c in (5, 3, 6, 3, 6):
        await bot.walk_to(c)
    await bot.walk_to(130, timeout=40000, sprint=True)
    await bot.interact("depths_north")
    await pg.wait_for_timeout(1500)
    ok("North Access stays sealed before Mission 02 ends", await MAP(pg) == "depths")
    s = after_m02()
    s["flags"].update({"ridgeReached": True, "relayASwept": True, "cellInstalled": True})
    s["inventory"]["relayCell"] = 0
    s["checkpoint"] = "cp_ridge_platform"
    await inject(pg, s)
    await bot.walk_to(96, timeout=6000)
    pp = await bot.P()
    ok("tower door blocks the way while the network is offline", pp["col"] <= 90, str(pp))
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


SCEN.update({"B": scenario_B, "C": scenario_C, "D": scenario_D, "E": scenario_E, "F": scenario_F, "G": scenario_G, "H": scenario_H, "I": scenario_I, "J": scenario_J, "K": scenario_K})


async def main():
    which = [a.upper() for a in sys.argv[1:]] or list(SCEN)
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
