"""
Automated play-through of Mission 01 with real keyboard input (no teleporting).

    npm run build && npm run preview          # serves http://localhost:4173
    pip install playwright && python -m playwright install chromium
    python playtest/playthrough.py            # screenshots go to playtest/out/

Uses the ?debug hooks (window.__laika) only to READ Laika's position and the state.
Set CHROME=/path/to/chrome to use an installed Chrome instead of Playwright's Chromium.
"""
import asyncio, sys, json, time
from playwright.async_api import async_playwright
import os
OUT=os.path.join(os.path.dirname(__file__), 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
URL='http://localhost:4173/?debug'

class Bot:
    def __init__(s, pg): s.pg=pg; s.log=[]
    async def P(s): return await s.pg.evaluate('window.__laika.player()')
    async def S(s): return await s.pg.evaluate('window.__laika.state()')
    async def T(s): return await s.pg.evaluate('window.__laika.target()')
    async def obj(s): return await s.pg.evaluate('window.__laika.objective()')
    async def tap(s, key, ms=60):
        await s.pg.keyboard.down(key); await s.pg.wait_for_timeout(ms); await s.pg.keyboard.up(key)
    async def trans_open(s):
        return await s.pg.evaluate("!document.querySelector('.transmission').classList.contains('hidden') && !document.querySelector('.transmission').classList.contains('passive')")
    async def close_trans(s):
        for _ in range(40):
            if not await s.trans_open(): return
            await s.tap('KeyE'); await s.pg.wait_for_timeout(250)
    async def walk_to(s, col, timeout=30000, sprint=False, jump_stuck=True):
        target=col*16+8
        t0=time.time(); last=None; stuck=0
        p=await s.P()
        key='ArrowRight' if target>p['x'] else 'ArrowLeft'
        await s.pg.keyboard.down(key)
        if sprint: await s.pg.keyboard.down('ShiftLeft')
        try:
            while (time.time()-t0)*1000<timeout:
                p=await s.P()
                if (key=='ArrowRight' and p['x']>=target-2) or (key=='ArrowLeft' and p['x']<=target+2): return True
                if last is not None and abs(p['x']-last)<0.5 and p['grounded']:
                    stuck+=1
                else: stuck=0
                if stuck>=2 and jump_stuck:
                    await s.pg.keyboard.down('Space'); await s.pg.wait_for_timeout(380); await s.pg.keyboard.up('Space'); stuck=0
                last=p['x']
                await s.pg.wait_for_timeout(70)
            s.log.append(f'walk_to {col} timeout at {p}')
            return False
        finally:
            await s.pg.keyboard.up(key)
            if sprint: await s.pg.keyboard.up('ShiftLeft')
            await s.pg.wait_for_timeout(250)
    async def jump_right(s, hold=420, run_ms=250):
        await s.pg.keyboard.down('ArrowRight'); await s.pg.wait_for_timeout(run_ms)
        await s.pg.keyboard.down('Space'); await s.pg.wait_for_timeout(hold); await s.pg.keyboard.up('Space')
        await s.pg.wait_for_timeout(500); await s.pg.keyboard.up('ArrowRight'); await s.pg.wait_for_timeout(300)
    async def interact(s, expect=None):
        t=await s.T()
        if expect and (not t or expect not in t['id']):
            s.log.append(f'expected target {expect}, got {t} at {await s.P()}')
        await s.tap('KeyE'); await s.pg.wait_for_timeout(700)
        await s.close_trans()
        return t
    async def shot(s, name): await s.pg.screenshot(path=OUT+name+'.png')


async def jump_dir(bot, key, hold=420, sprint=True, pre=120):
    pg=bot.pg
    await pg.keyboard.down(key)
    if sprint: await pg.keyboard.down('ShiftLeft')
    await pg.wait_for_timeout(pre)
    await pg.keyboard.down('Space'); await pg.wait_for_timeout(hold); await pg.keyboard.up('Space')
    for _ in range(30):
        await pg.wait_for_timeout(60)
        p=await bot.P()
        if p['grounded']: break
    await pg.keyboard.up(key)
    if sprint: await pg.keyboard.up('ShiftLeft')
    await pg.wait_for_timeout(200)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'console.{m.type}: {m.text}') if m.type=='error' else None)
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        await pg.get_by_text('New Game').click(); await pg.wait_for_timeout(3500)
        bot=Bot(pg); t0=time.time()
        await bot.walk_to(9); await bot.interact('shipRadio')
        await bot.walk_to(21); await bot.interact('hatch')
        await bot.walk_to(70); await bot.interact('receiver')
        await bot.walk_to(82); await bot.jump_right(hold=450, run_ms=150); await bot.walk_to(84)
        await bot.walk_to(89); await bot.tap('KeyF'); await pg.wait_for_timeout(1000); await bot.interact('elec_outpost')
        await bot.walk_to(37); await bot.interact('solarControl')
        for c in (40,44,48):
            await bot.walk_to(c); await bot.interact('panel')
        await pg.wait_for_timeout(3000); await bot.shot('08_power_on')
        print('power done', round(time.time()-t0), 's')
        # ---- canyon ----
        await bot.walk_to(101); await bot.shot('09_canyon_gate')
        await bot.walk_to(108); await bot.tap('KeyF'); await pg.wait_for_timeout(1000); await bot.interact('metal_canyon')
        await bot.walk_to(117)  # falls into the pit, grabs electronics
        await bot.shot('10_pit'); print('in pit', await bot.P())
        await bot.walk_to(108)  # hidden room (west)
        await pg.wait_for_timeout(600); await bot.shot('11_secret_room')
        await bot.walk_to(128); await bot.shot('12_tunnel')
        await bot.walk_to(140); await bot.shot('13_cavern')
        await bot.walk_to(156); print('out of tunnel', await bot.P())
        await bot.walk_to(158); await bot.tap('KeyF'); await pg.wait_for_timeout(1000); await bot.interact('elec_canyon')
        await bot.walk_to(170); await bot.tap('KeyF'); await pg.wait_for_timeout(1000); await bot.interact('elec_rover')
        await bot.walk_to(175); await bot.interact('rover'); await bot.shot('14_rover_log')
        await bot.walk_to(180); await bot.tap('KeyF'); await pg.wait_for_timeout(1100); await bot.shot('15_sniff_module')
        await bot.interact('comms_module'); await pg.wait_for_timeout(800); await bot.shot('16_module_found')
        st=await bot.S(); print('inv', st['inventory'])
        # ---- back west over the mesa and the pit ----
        await bot.walk_to(133); print('on mesa west end', await bot.P())
        await bot.walk_to(124); print('pit east edge', await bot.P())
        await jump_dir(bot, 'ArrowLeft'); print('after jump 1', await bot.P())
        p1=await bot.P()
        if p1['row']<=27 and p1['col']>=113:
            await jump_dir(bot, 'ArrowLeft'); print('after jump 2', await bot.P())
        p1=await bot.P()
        if p1['row']<=27 and p1['col']>=113:
            await jump_dir(bot, 'ArrowLeft'); print('after jump 3', await bot.P())
        p1=await bot.P()
        if p1['row']>27:
            print('fell into the pit; using tunnel + retry from east'); bot.log.append('bot fell in pit on return')
        await bot.walk_to(70); print('back at receiver', await bot.P(), await bot.T())
        await bot.interact('receiver'); await pg.wait_for_timeout(500)
        print('tune', await bot.T())
        await bot.tap('KeyE'); await pg.wait_for_timeout(1600); await bot.shot('17_transmission')
        await bot.close_trans(); await pg.wait_for_timeout(1500)
        st=await bot.S(); print('comms', st['flags']['commsOnline'])
        # optional: thruster boots at the workstation
        await bot.walk_to(77); print('workstation', await bot.T()); await bot.interact('workstation')
        await bot.shot('18_boots')
        # ---- bridge ----
        await bot.walk_to(197, timeout=60000, sprint=True); print('bridge ctl', await bot.T())
        await bot.interact('bridgeControl'); await pg.wait_for_timeout(700); await bot.shot('19_bridge_extending'); await pg.wait_for_timeout(2600)
        await bot.walk_to(214); await bot.interact('stationDoor')
        await bot.walk_to(222); await pg.wait_for_timeout(500); await bot.shot('20_station')
        await bot.walk_to(231); print('beacon', await bot.T())
        await bot.tap('KeyE'); await pg.wait_for_timeout(1500); await bot.shot('21_final_signal')
        await bot.close_trans(); await pg.wait_for_timeout(2500); await bot.shot('22_complete')
        st=await bot.S(); print('demoComplete', st['flags']['demoComplete'], 'time', round(time.time()-t0),'s', 'play ms', round(st['playTimeMs']))
        ls=await pg.evaluate("localStorage.getItem('laika-the-last-signal/save')")
        open(OUT+'save_complete.json','w').write(ls or '')
        print('errs', errs[:10]); print('log', bot.log)
        await b.close()
asyncio.run(main())
