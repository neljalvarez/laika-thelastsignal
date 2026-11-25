"""
Phase 2 browser play-tests (scenarios A-H from the Phase 2 brief), with real keyboard / pointer input.

    npm run build && npm run preview          # http://localhost:4173
    python playtest/phase2.py [A B C ...]     # default: all. Screenshots -> playtest/out/phase2/

window.__laika (enabled by ?debug) is used only to READ state and position, plus to inject
saves through localStorage for scenarios C, D and H. Nothing is teleported during play.
"""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(__file__))
from playthrough import Bot, URL, controlled_hop, jump_dir  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "out", "phase2") + os.sep
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or None
RESULTS = {}


def ok(name, cond, detail=""):
    RESULTS.setdefault(CUR[0], []).append((name, bool(cond), detail))
    print(("  PASS " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail else ""))


CUR = ["?"]


async def new_browser(p, **ctx):
    b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    c = await b.new_context(**({"viewport": {"width": 1280, "height": 720}} | ctx))
    pg = await c.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return b, pg, errs


async def T(pg):
    return await pg.evaluate("window.__laika.tutorial()")


async def wait_stage(pg, stage, ms=4000):
    t0 = time.time()
    while (time.time() - t0) * 1000 < ms:
        t = await T(pg)
        if t is None or t["stage"] == stage:
            return True
        await pg.wait_for_timeout(100)
    return False


async def tutorial_keyboard(bot, pg, shots=True, prefix="A"):
    pg_shot = (lambda n: bot.pg.screenshot(path=OUT + f"{prefix}_{n}.png")) if shots else (lambda n: asyncio.sleep(0))
    await pg_shot("01_wake")
    await wait_stage(pg, "move", 4000)
    await pg.wait_for_timeout(400)
    await pg_shot("02_move_prompt")
    await bot.walk_to(10)
    await pg_shot("03_jump_prompt")
    await bot.walk_to(13)
    await bot.walk_to(14)
    await pg_shot("04_console_prompt")
    await bot.tap("KeyE")
    await pg.wait_for_timeout(900)
    await pg_shot("05_sniff_prompt")
    await bot.tap("KeyF")
    await pg.wait_for_timeout(450)
    await pg_shot("06_sniffing")
    await bot.walk_to(17)
    await wait_stage(pg, "dig", 3000)
    await bot.walk_to(18)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(300)
    await pg_shot("07_digging")
    await pg.wait_for_timeout(900)
    await bot.walk_to(19)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(500)
    await pg_shot("08_repair")
    await pg.wait_for_timeout(1400)
    await pg_shot("09_hatch_open")
    await bot.walk_to(22)
    await pg.wait_for_timeout(700)
    await pg_shot("10_mission_transition")
    await pg.wait_for_timeout(3600)
    await bot.close_trans()


async def mission01(bot, pg, prefix="A"):
    """Mission 01 from the lower deck to the completion card (same route as Phase 1)."""
    await bot.walk_to(9)
    await bot.interact("shipRadio")
    await bot.walk_to(21)
    await bot.interact("hatch")
    await bot.walk_to(70)
    await bot.interact("receiver")
    await bot.walk_to(82)
    await bot.jump_right(hold=450, run_ms=150)
    await bot.walk_to(84)
    await bot.walk_to(89)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(900)
    await bot.interact("elec_outpost")
    await bot.walk_to(37)
    await bot.interact("solarControl")
    for c in (40, 44, 48):
        await bot.walk_to(c)
        await bot.interact("panel")
    await pg.wait_for_timeout(2600)
    await pg.screenshot(path=OUT + f"{prefix}_11_power_on.png")
    await bot.walk_to(117)
    await bot.walk_to(156)
    await bot.walk_to(180)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(1000)
    await bot.interact("comms_module")
    await pg.wait_for_timeout(700)
    await cross_pit_west(bot)
    await bot.walk_to(70)
    await bot.interact("receiver")
    await pg.wait_for_timeout(400)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(1500)
    await bot.close_trans()
    await pg.wait_for_timeout(1200)
    await bot.walk_to(197, timeout=60000, sprint=True)
    await bot.interact("bridgeControl")
    await pg.wait_for_timeout(3200)
    await bot.walk_to(214)
    await bot.interact("stationDoor")
    await bot.walk_to(231)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(1500)
    await bot.close_trans()
    await pg.wait_for_timeout(2500)
    await pg.screenshot(path=OUT + f"{prefix}_12_complete.png")


async def climb_out_west(bot):
    """Pit floor -> the one-way step at cols 113-114 -> the west rim (1 tile, then 2 tiles)."""
    await bot.walk_to(115)
    await controlled_hop(bot.pg, "ArrowLeft", steer_ms=200)  # onto the step
    await controlled_hop(bot.pg, "ArrowLeft", steer_ms=700)  # up onto the rim


async def cross_pit_west(bot, attempts=3):
    """Jump the pit westward. A missed jump drops Laika onto the pit floor, which (by design) drains
    east through the survey tunnel, so recover the way a player would: tunnel -> shaft -> retry."""
    for attempt in range(attempts):
        await bot.walk_to(133)
        await bot.walk_to(124)
        for _ in range(3):
            p1 = await bot.P()
            if p1["row"] <= 28 and p1["col"] >= 113 and p1["grounded"]:
                await jump_dir(bot, "ArrowLeft")
        p1 = await bot.P()
        if p1["row"] >= 29 and p1["col"] <= 118:  # came up short in the pit: climb out by the west step
            print("   (short jump into the pit; climbing out by the west step)")
            bot.log.append("short pit jump; used the west step")
            await climb_out_west(bot)
            p1 = await bot.P()
        if p1["row"] <= 28 and p1["col"] < 113:
            return True
        print(f"   (bot missed the pit jump, attempt {attempt + 1}; recovering via the tunnel)")
        bot.log.append("pit jump missed; recovered via tunnel")
        await bot.walk_to(140)
        await bot.walk_to(153)
    return False


def v1_save(**over):
    s = {
        "version": 1,
        "flags": {k: False for k in ["checkedShipRadio", "hatchOpen", "reachedOutpost", "inspectedReceiver", "solarRepaired", "moduleInstalled", "commsOnline", "bridgeExtended", "stationDoorOpen", "reachedStation", "demoComplete"]},
        "inventory": {"metal": 1, "electronics": 0, "commsModule": 0, "sample": 0, "treat": 0},
        "collected": ["metal_ship"],
        "abilities": {"sniff": True, "sweep": True, "thrusters": False},
        "sweptPanels": [],
        "seen": [],
        "checkpoint": "cp_canyon",
        "visitedCheckpoints": ["cp_ship", "cp_outpost", "cp_canyon"],
        "playTimeMs": 60000,
    }
    for k in ["checkedShipRadio", "hatchOpen", "reachedOutpost", "inspectedReceiver"]:
        s["flags"][k] = True
    s.update(over)
    return s


async def inject(pg, state):
    await pg.goto(URL)
    await pg.wait_for_timeout(700)
    await pg.evaluate("s => localStorage.setItem('laika-the-last-signal/save', s)", json.dumps(state))
    await pg.reload()
    await pg.wait_for_timeout(1300)


# ---------------------------------------------------------------- scenarios


async def scenario_A(p):
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1300)
    await pg.screenshot(path=OUT + "A_00_title.png")
    await pg.get_by_text("New Game").click()
    await pg.wait_for_timeout(1300)
    t0 = time.time()
    await tutorial_keyboard(bot, pg)
    st = await bot.S()
    ok("tutorial completed", st["tutorial"]["status"] == "done", str(st["tutorial"]))
    ok("tutorial took a short time", time.time() - t0 < 120, f"{round(time.time() - t0)} s at bot speed")
    ok("no practice items leaked into the campaign", sum(st["inventory"].values()) == 0)
    ok("Mission 01 starts on the lower deck", (await bot.P())["row"] == 21)
    ok("objective panel shows Mission 01", "radio" in (await pg.evaluate("window.__laika.objective()"))["primary"])
    await mission01(bot, pg)
    st = await bot.S()
    ok("Mission 01 completed after the tutorial", st["flags"]["demoComplete"], "" if st["flags"]["demoComplete"] else f"stalled: flags={[k for k, v in st['flags'].items() if v]} inv={st['inventory']} at={await bot.P()}")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_B(p):
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1200)
    await pg.get_by_text("New Game").click()
    await pg.wait_for_timeout(2800)
    await pg.get_by_text("Skip tutorial").click()
    await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT + "B_01_skip_confirm.png")
    await pg.locator(".screen").get_by_role("button", name="Skip tutorial").click()
    await pg.wait_for_timeout(3400)
    st = await bot.S()
    ok("skip records 'skipped'", st["tutorial"]["status"] == "skipped")
    ok("skip grants no resources", sum(st["inventory"].values()) == 0 and not st["abilities"]["sniff"])
    pp = await bot.P()
    ok("skip lands on the lower deck by the cockpit", pp["row"] == 21 and pp["col"] <= 8, str(pp))
    await bot.close_trans()
    await bot.walk_to(9)
    await bot.interact("shipRadio")
    await bot.walk_to(21)
    await bot.interact("hatch")
    await bot.walk_to(70)
    await bot.interact("receiver")
    st = await bot.S()
    ok("Mission 01 proceeds (receiver unlocks the scanner)", st["flags"]["inspectedReceiver"] and st["abilities"]["sniff"])
    await pg.screenshot(path=OUT + "B_02_mission01.png")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_CD(p):
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    CUR[0] = "C"
    save = v1_save()
    await inject(pg, save)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(2500)
    st = await bot.S()
    ok("Phase 1 save loads as v2", st["version"] == 2)
    ok("inventory preserved", st["inventory"] == save["inventory"], str(st["inventory"]))
    ok("flags preserved", all(st["flags"][k] == v for k, v in save["flags"].items()))
    ok("abilities preserved + Bark", st["abilities"]["sniff"] and st["abilities"]["bark"])
    ok("tutorial not forced", st["tutorial"]["status"] == "skipped" and (await T(pg)) is None)
    ok("resumes at the saved checkpoint", (await bot.P())["col"] == 101)
    await pg.screenshot(path=OUT + "C_01_continue.png")
    CUR[0] = "D"
    before = json.dumps(await bot.S(), sort_keys=True)
    ret = await bot.P()
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT + "D_01_pause_replay.png")
    await pg.get_by_text("Replay tutorial (Mission 00)").click()
    await pg.wait_for_timeout(800)
    t = await T(pg)
    ok("replay starts in practice mode", t and t["mode"] == "replay" and t["stage"] == "move", str(t))
    await pg.screenshot(path=OUT + "D_02_replay.png")
    await tutorial_keyboard(bot, pg, shots=False)
    await pg.wait_for_timeout(500)
    after_state = await bot.S()
    after = json.dumps(after_state, sort_keys=True)
    # play time naturally increases; compare everything else
    a = json.loads(after)
    bb = json.loads(before)
    a.pop("playTimeMs")
    bb.pop("playTimeMs")
    ok("replay changed no campaign state", a == bb)
    back = await bot.P()
    ok("replay returns Laika to where she was", abs(back["x"] - ret["x"]) < 20 and back["row"] == ret["row"], f"{ret['col']}->{back['col']}")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def touch_hold(pg, sel, ms, pid=7):
    await pg.evaluate("([s,id]) => document.querySelector(s).dispatchEvent(new PointerEvent('pointerdown',{pointerId:id,bubbles:true,pointerType:'touch'}))", [sel, pid])
    await pg.wait_for_timeout(ms)
    await pg.evaluate("([s,id]) => document.querySelector(s).dispatchEvent(new PointerEvent('pointerup',{pointerId:id,bubbles:true,pointerType:'touch'}))", [sel, pid])


async def dpad(pg, direction, down=True):
    js = """([dir, down]) => { const p=document.querySelector('.t-dpad'); const r=p.getBoundingClientRect();
      const x = dir<0 ? r.left + r.width*0.25 : r.left + r.width*0.75; const y = r.top + r.height/2;
      p.dispatchEvent(new PointerEvent(down?'pointerdown':'pointerup',{pointerId:21,bubbles:true,clientX:x,clientY:y,pointerType:'touch'})); }"""
    await pg.evaluate(js, [direction, down])


async def touch_walk_to(bot, pg, col, timeout=20000):
    target = col * 16 + 8
    p = await bot.P()
    d = 1 if target > p["x"] else -1
    await dpad(pg, d, True)
    t0 = time.time()
    last = None
    stuck = 0
    try:
        while (time.time() - t0) * 1000 < timeout:
            p = await bot.P()
            if (d > 0 and p["x"] >= target - 2) or (d < 0 and p["x"] <= target + 2):
                return True
            stuck = stuck + 1 if last is not None and abs(p["x"] - last) < 0.5 and p["grounded"] else 0
            if stuck >= 2:
                await touch_hold(pg, ".t-jump", 380, 9)
                stuck = 0
            last = p["x"]
            await pg.wait_for_timeout(70)
        return False
    finally:
        await dpad(pg, d, False)
        await pg.wait_for_timeout(200)


async def scenario_E(p):
    b, pg, errs = await new_browser(p, viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, device_scale_factor=2)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("New Game").tap()
    await pg.wait_for_timeout(1500)
    ok("touch controls visible", await pg.evaluate("!document.querySelector('.touch').classList.contains('hidden')"))
    # Any touch skips the wake-up animation
    await touch_hold(pg, ".t-jump", 60)
    await wait_stage(pg, "move", 3000)
    await dpad(pg, 1, True)
    await pg.wait_for_timeout(150)
    await pg.screenshot(path=OUT + "E_01_touch_move.png")
    await dpad(pg, 1, False)
    txt = await pg.evaluate("document.querySelector('.tut-text')?.textContent || ''")
    ok("tutorial prompt adapts to touch", "buttons" in txt or "JUMP" in txt or "Nice" in txt, txt)
    await touch_hold(pg, ".t-bark", 80)
    await pg.wait_for_timeout(150)
    ok("BARK touch button barks (anim + caption)", (await bot.P())["anim"] == "bark" and "Woof" in await pg.evaluate("document.querySelector('.caption')?.textContent || ''"))
    await pg.screenshot(path=OUT + "E_04_touch_bark.png")
    await pg.wait_for_timeout(500)
    await touch_walk_to(bot, pg, 13)
    await touch_walk_to(bot, pg, 14)
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(700)
    await touch_hold(pg, ".t-sniff", 80)
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=OUT + "E_02_touch_sniff.png")
    await touch_walk_to(bot, pg, 17)
    await wait_stage(pg, "dig", 3000)
    await touch_walk_to(bot, pg, 18)
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(1100)
    await touch_walk_to(bot, pg, 19)
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(1800)
    await touch_walk_to(bot, pg, 22)
    await pg.wait_for_timeout(3800)
    st = await bot.S()
    ok("tutorial completed with touch alone", st["tutorial"]["status"] == "done", str(await T(pg)))
    await bot.close_trans()
    await touch_walk_to(bot, pg, 9)
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(700)
    for _ in range(4):
        await touch_hold(pg, ".t-act", 60)
        await pg.wait_for_timeout(250)
    await touch_walk_to(bot, pg, 21)
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(500)
    await touch_walk_to(bot, pg, 70, timeout=40000)
    await pg.screenshot(path=OUT + "E_03_touch_outpost.png")
    await touch_hold(pg, ".t-act", 80)
    await pg.wait_for_timeout(600)
    st = await bot.S()
    ok("introductory mission navigable by touch (radio, hatch, receiver)", st["flags"]["checkedShipRadio"] and st["flags"]["hatchOpen"] and st["flags"]["inspectedReceiver"], str({k: v for k, v in st["flags"].items() if v}))
    # Touch pause button + nothing stuck afterwards
    await dpad(pg, 1, True)
    await pg.evaluate("document.querySelector('.hud-top-right .hud-btn:last-child').click()")
    await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelector('.screen button').click()")
    await pg.wait_for_timeout(500)
    p1 = await bot.P()
    await pg.wait_for_timeout(400)
    p2 = await bot.P()
    ok("controls are not stuck after pausing mid-press", abs(p2["x"] - p1["x"]) < 1, f"{p1['x']:.1f}->{p2['x']:.1f}")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_F(p):
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1000)
    await pg.get_by_text("Settings").click()
    await pg.wait_for_timeout(300)
    await pg.select_option("#set-textScale", "1.5")
    await pg.check("#set-reducedMotion")
    await pg.check("#set-assistJumps")
    await pg.check("#set-captions")
    await pg.screenshot(path=OUT + "F_01_settings.png")
    await pg.get_by_text("Back", exact=True).click()
    await pg.wait_for_timeout(300)
    await pg.get_by_text("New Game").click()
    await pg.wait_for_timeout(2500)
    await pg.keyboard.press("ArrowRight")
    await wait_stage(pg, "move", 2000)
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + "F_02_xl_tutorial.png")
    # Easy Jumps: measure a held jump
    p0 = await bot.P()
    await pg.keyboard.down("Space")
    top = p0["y"]
    for _ in range(14):
        await pg.wait_for_timeout(40)
        top = min(top, (await bot.P())["y"])
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(900)
    ok("Easy Jumps gives a higher jump", p0["y"] - top > 60, f"{p0['y'] - top:.0f}px")
    s = await pg.evaluate("window.__laika.audio().settings")
    ok("settings persisted (text 150%, reduced motion, captions, easy jumps)", s["textScale"] == 1.5 and s["reducedMotion"] and s["captions"] and s["assistJumps"])
    await bot.tap("KeyB")
    await pg.wait_for_timeout(200)
    cap = await pg.evaluate("document.querySelector('.caption')?.textContent || ''")
    ok("sound captions show the bark visually", "Woof" in cap, cap)
    await pg.screenshot(path=OUT + "F_03_bark_caption.png")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_G(p):
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    await pg.goto(URL)
    await pg.wait_for_timeout(1000)
    await pg.get_by_text("New Game").click()
    await pg.wait_for_timeout(2600)
    await pg.keyboard.press("ArrowRight")
    await pg.wait_for_timeout(300)
    # Rapid direction changes and simultaneous presses
    for i in range(20):
        k = "ArrowRight" if i % 2 else "ArrowLeft"
        await pg.keyboard.down(k)
        if i % 3 == 0:
            await pg.keyboard.down("Space")
        await pg.keyboard.press("KeyE")
        await pg.wait_for_timeout(40)
        await pg.keyboard.up(k)
        await pg.keyboard.up("Space")
    await pg.wait_for_timeout(800)
    p = await bot.P()
    ok("rapid mixed input leaves Laika on the floor and still", p["grounded"] and abs(p["vx"]) < 1, str(p))
    # Pause / resume spam
    for _ in range(6):
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(120)
    await pg.wait_for_timeout(300)
    paused = await pg.evaluate("!!document.querySelector('.screen')")
    ok("pause toggles cleanly (even number of presses = playing)", not paused)
    # Held key + window blur -> no stuck movement
    await pg.keyboard.down("ArrowRight")
    await pg.wait_for_timeout(200)
    await pg.evaluate("window.dispatchEvent(new Event('blur'))")
    await pg.wait_for_timeout(500)
    p1 = await bot.P()
    await pg.wait_for_timeout(300)
    p2 = await bot.P()
    await pg.keyboard.up("ArrowRight")
    ok("window blur releases held keys", abs(p2["x"] - p1["x"]) < 1)
    # Tab hidden -> auto pause
    await pg.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))")
    await pg.wait_for_timeout(300)
    ok("hidden tab pauses the game", await pg.evaluate("!!document.querySelector('.screen')"))
    await pg.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(300)
    ok("resumes after returning", not await pg.evaluate("!!document.querySelector('.screen')"))
    # Mid-tutorial save -> reload -> continue at the same stage
    await bot.walk_to(13)
    await bot.walk_to(14)
    await bot.tap("KeyE")
    await pg.wait_for_timeout(800)
    stage = (await T(pg))["stage"]
    await pg.reload()
    await pg.wait_for_timeout(1300)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(2200)
    t = await T(pg)
    ok("reload mid-tutorial resumes the same stage", t and t["stage"] == stage, f"{stage} -> {t and t['stage']}")
    # Frame-rate check in the browser: full jump height at 60 fps vs a 30 fps limit
    async def jump_height():
        await pg.wait_for_timeout(400)
        p0 = await bot.P()
        await pg.keyboard.down("Space")
        top = p0["y"]
        for _ in range(20):
            await pg.wait_for_timeout(30)
            top = min(top, (await bot.P())["y"])
        await pg.keyboard.up("Space")
        await pg.wait_for_timeout(900)
        return p0["y"] - top
    h60 = await jump_height()
    await pg.evaluate("(() => { const l = window.__laika.scene.game.loop; l.fpsLimit = 30; l.hasFpsLimit = true; l._limitRate = 1000/30; })()")
    h30 = await jump_height()
    await pg.evaluate("(() => { const l = window.__laika.scene.game.loop; l.hasFpsLimit = false; })()")
    ok("jump height consistent at 60 fps and 30 fps (in browser)", abs(h60 - h30) < 4, f"60fps {h60:.1f}px, 30fps {h30:.1f}px")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


async def scenario_H(p):
    b, pg, errs = await new_browser(p)
    bot = Bot(pg)
    save = v1_save(abilities={"sniff": True, "sweep": True, "thrusters": True})
    save["flags"]["solarRepaired"] = True
    save["sweptPanels"] = ["panel_1", "panel_2", "panel_3"]
    save["checkpoint"] = "cp_outpost"
    await inject(pg, save)
    await pg.get_by_text("Continue").click()
    await pg.wait_for_timeout(2400)
    # Bark at the echo sensor (optional interaction)
    await bot.walk_to(66)
    tgt = await bot.T()
    ok("echo sensor offers Bark as the contextual action", tgt and tgt["verb"] == "Bark", str(tgt))
    await bot.tap("KeyE")
    await pg.wait_for_timeout(700)
    await pg.screenshot(path=OUT + "H_01_echo_sensor.png")
    st = await bot.S()
    ok("echo sensor responded", "echo_sensor" in st["seen"])
    await bot.close_trans()
    # Canyon: pit -> secret room -> tunnel (with new signage) -> cavern -> shaft
    await bot.walk_to(113)
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + "H_02_pit_signs.png")
    await bot.walk_to(106)
    await pg.wait_for_timeout(500)
    st = await bot.S()
    ok("secret room + Golden Treat", st["inventory"]["treat"] == 1 and "secret_room" in st["seen"])
    await bot.walk_to(128)
    await pg.screenshot(path=OUT + "H_03_tunnel_lit.png")
    await bot.walk_to(140)
    await bot.walk_to(153)
    ok("tunnel exit shaft climbable", (await bot.P())["row"] == 27, str(await bot.P()))
    await pg.screenshot(path=OUT + "H_04_rover_tracks.png")
    # Mesa ledges + boots ledge
    await bot.walk_to(147)
    await bot.walk_to(137)
    await jump_dir(bot, "ArrowRight", hold=450, sprint=False, pre=60)
    await bot.walk_to(138)
    await jump_dir(bot, "ArrowRight", hold=450, sprint=False, pre=100)
    await bot.walk_to(142)
    await pg.keyboard.down("ArrowRight")
    await pg.wait_for_timeout(80)
    await pg.keyboard.down("Space")
    await pg.wait_for_timeout(330)
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(90)
    await pg.keyboard.down("Space")
    await pg.wait_for_timeout(120)
    await pg.screenshot(path=OUT + "H_05_thruster_jump.png")
    await pg.wait_for_timeout(250)
    await pg.keyboard.up("Space")
    await pg.wait_for_timeout(500)
    await pg.keyboard.up("ArrowRight")
    await pg.wait_for_timeout(600)
    st = await bot.S()
    ok("mesa samples (basalt + boots-only hematite)", st["inventory"]["sample"] >= 2, str(st["inventory"]))
    # Rim gypsum (buried, optional) + chasm still gated
    await bot.walk_to(160)
    await bot.walk_to(189, timeout=40000)
    await bot.tap("KeyF")
    await pg.wait_for_timeout(1200)
    tgt = await bot.T()
    if tgt and tgt["id"] == "sample_gypsum":
        await bot.tap("KeyE")
        await pg.wait_for_timeout(900)
    st = await bot.S()
    ok("rim gypsum sample found by sniffing", st["inventory"]["sample"] >= 3, str(st["inventory"]))
    await bot.walk_to(197)
    ok("bridge stays gated without the radio", (await bot.T() or {}).get("verb") == "Use bridge control")
    ok("no page errors", not errs, "; ".join(errs[:3]))
    await b.close()


SCEN = {"A": scenario_A, "B": scenario_B, "C": scenario_CD, "E": scenario_E, "F": scenario_F, "G": scenario_G, "H": scenario_H}


async def main():
    which = [a.upper() for a in sys.argv[1:]] or list(SCEN)
    async with async_playwright() as p:
        for k in which:
            if k == "D":
                continue
            CUR[0] = k
            print(f"== Scenario {k}{' + D' if k == 'C' else ''}")
            try:
                await SCEN[k](p)
            except Exception as e:  # report and keep going
                ok("scenario ran without exceptions", False, repr(e)[:200])
    json.dump({k: [(n, c, d) for n, c, d in v] for k, v in RESULTS.items()}, open(OUT + "results.json", "w"), indent=1)
    fails = sum(1 for v in RESULTS.values() for _, c, _ in v if not c)
    total = sum(len(v) for v in RESULTS.values())
    print(f"\n{total - fails}/{total} checks passed")


if __name__ == "__main__":
    asyncio.run(main())
