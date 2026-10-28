// Vertical slider helpers. The pages snap with CSS scroll-snap (keyboard, touch, scrollbar); this script
// - turns exactly one page per mouse-wheel or trackpad gesture (plain snapping would fall back to the nearest page),
// - marks the current page in the pager,
// - starts each page's entrance animation the first time it scrolls into view,
// - plays the battle scene of page 2 with the game's hero rig frames (js/heroes.js),
// - sends the beta sign-up of page 1 (the wallet from Connect, with a Turnstile captcha) through the sign-up Worker to
//   its Google Form.
(() => {
  // Entrance animations hide content only when this script runs, so a failed load still shows every page.
  document.documentElement.classList.add("js");

  const WHEEL_IDLE_MS = 200; // wheel silence that starts a new gesture (absorbs trackpad inertia)
  const TURN_MS = 700; // minimum time between two page turns

  const slides = [...document.querySelectorAll(".slide")];
  const dots = [...document.querySelectorAll(".pager__dot")];
  const ratios = new Map(slides.map((slide) => [slide, 0]));
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  // ---------- Page 1: the beta sign-up ----------

  // The form posts to the sign-up Worker (js/config.js), which checks the captcha token and passes the answers on to
  // the Google Form; its reply says whether the sign-up was saved.
  // The wallet comes only from Connect (the visitor's wallet, EIP-1193 window.ethereum); the X page and the referral
  // code are typed.
  const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
  const SEND_ERRORS = {
    captcha: "The human check failed. Please try again.",
    blocked: "The human check didn't load. Turn off blockers for this page and reload it.",
    other: "Couldn't send. Please try again.",
  };
  const USER_REJECTED = 4001; // EIP-1193

  // MetaMask's link that opens this page inside its app (phone browsers have no wallet of their own).
  const metaMaskLink = () => `https://metamask.app.link/dapp/${location.host}${location.pathname}`;

  const signUp = document.getElementById("beta-form");
  if (signUp) {
    const config = window.LANDING_CONFIG?.signUp ?? {};
    const fields = signUp.querySelector(".beta-form__fields");
    const submit = signUp.querySelector(".beta-form__submit");
    const note = signUp.querySelector(".beta-form__note");
    const done = signUp.querySelector(".notice--success");
    const failed = signUp.querySelector(".notice--error");
    const walletInput = document.getElementById("f-wallet");
    const walletValue = document.getElementById("f-wallet-value");
    const connect = document.getElementById("f-wallet-connect");
    const walletHint = document.getElementById("f-wallet-hint");
    const xPage = document.getElementById("f-x");
    const captchaBox = document.getElementById("f-captcha");
    const wallet = window.ethereum;

    // The captcha: Cloudflare Turnstile, out of sight unless Cloudflare wants the visitor to click it. It earns a token
    // while the visitor fills the form and renews it before it expires (5 minutes). A token passes the Worker once,
    // so every send uses it up and a failed send asks for a new one.
    let widget = null;
    let token = "";
    let captchaBroken = false; // the script didn't load (a blocker) or the browser can't run it
    let waiting = null; // the send waiting for a token: { resolve, reject }
    const settle = (outcome, value) => {
      waiting?.[outcome](value);
      waiting = null;
    };
    const captchaFailed = () => {
      token = "";
      settle("reject", new Error("captcha"));
    };
    const nextToken = () => {
      if (captchaBroken) return Promise.reject(new Error("blocked"));
      return token ? Promise.resolve(token) : new Promise((resolve, reject) => (waiting = { resolve, reject }));
    };

    if (config.endpoint && config.turnstileSiteKey) {
      window.onTurnstileLoad = () => {
        widget = window.turnstile.render(captchaBox, {
          sitekey: config.turnstileSiteKey,
          action: "signup",
          theme: "dark",
          size: "flexible",
          appearance: "interaction-only",
          "response-field": false,
          callback: (value) => {
            token = value;
            settle("resolve", value);
          },
          "expired-callback": () => (token = ""),
          "error-callback": captchaFailed,
          "timeout-callback": captchaFailed,
          "unsupported-callback": () => {
            captchaBroken = true;
            settle("reject", new Error("blocked"));
          },
        });
      };
      const script = Object.assign(document.createElement("script"), { src: TURNSTILE_SCRIPT, async: true });
      script.addEventListener("error", () => {
        captchaBroken = true;
        settle("reject", new Error("blocked"));
      });
      document.head.append(script);
    } else {
      submit.disabled = true;
      submit.textContent = "Sign-ups open soon";
    }

    // A hint under the wallet field; the note under the button steps aside meanwhile, so the panel barely grows.
    const hint = (text = "", kind = "", link = null) => {
      walletHint.hidden = !text;
      walletHint.className = kind ? `form-hint is-${kind}` : "form-hint";
      walletHint.replaceChildren(text);
      if (link) {
        const anchor = Object.assign(document.createElement("a"), { href: link.href, textContent: link.text });
        anchor.target = "_blank";
        anchor.rel = "noopener";
        walletHint.append(" ", anchor);
      }
      note.hidden = Boolean(text) || !done.hidden || !failed.hidden;
    };

    // The field shows the short form (0x5ea1…0002); the hidden input sends the full address.
    const useAccount = (account) => {
      walletValue.value = account ?? "";
      walletInput.value = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "";
      walletInput.title = account ?? "";
      connect.querySelector("span").textContent = account ? "Change" : "Connect";
      if (account) hint();
    };

    if (wallet) {
      wallet.on?.("accountsChanged", (accounts) => useAccount(accounts[0]));
      // A wallet that already trusts this page fills the field without asking.
      wallet.request({ method: "eth_accounts" }).then((accounts) => useAccount(accounts[0])).catch(() => {});
    }

    connect.addEventListener("click", async () => {
      if (!wallet) {
        const phone = matchMedia("(pointer: coarse)").matches;
        hint("No wallet in this browser.", "", phone
          ? { href: metaMaskLink(), text: "Open this page in MetaMask." }
          : { href: "https://metamask.io/download/", text: "Install MetaMask." });
        return;
      }
      connect.disabled = true;
      try {
        // Change: let the wallet offer its accounts again (a wallet without this just keeps the current one).
        if (walletValue.value) {
          await wallet
            .request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] })
            .catch((error) => {
              if (error.code === USER_REJECTED) throw error;
            });
        }
        const [account] = await wallet.request({ method: "eth_requestAccounts" });
        useAccount(account);
      } catch (error) {
        hint(error.code === USER_REJECTED ? "Connection cancelled." : "Couldn't connect the wallet. Please try again.", "error");
      } finally {
        connect.disabled = false;
      }
    });

    // Stray spaces would fail the format checks, so they go before the browser checks the fields.
    for (const input of signUp.querySelectorAll(".field:not([readonly])")) {
      input.addEventListener("change", () => {
        input.value = input.value.trim();
      });
    }

    const showDone = () => {
      fields.hidden = true;
      note.hidden = true;
      failed.hidden = true;
      done.hidden = false;
    };

    signUp.addEventListener("submit", async (event) => {
      event.preventDefault();
      // The browser has checked the X page; the wallet comes from Connect only.
      if (!walletValue.value) {
        hint("Connect your wallet first.", "error");
        connect.focus();
        return;
      }
      if (document.getElementById("f-trap").value) {
        showDone(); // a bot: pretend it worked, send nothing
        return;
      }
      const data = new URLSearchParams(new FormData(signUp));
      // Any accepted form of the X page (@name, name, x.com/name, twitter.com/name) is saved as one link.
      const handle = xPage.value.trim().match(/([A-Za-z0-9_]{1,15})\/?$/)[1];
      data.set(xPage.name, `https://x.com/${handle}`);

      const label = submit.textContent;
      fields.disabled = true;
      failed.hidden = true;
      try {
        // The token may still be coming, or wait for a click on the captcha.
        submit.textContent = "Checking…";
        data.set("cf-turnstile-response", await nextToken());
        submit.textContent = "Sending…";
        token = "";
        const response = await fetch(config.endpoint, { method: "POST", body: data });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error);
        showDone();
      } catch (error) {
        // The error takes the note's place, so the panel barely grows.
        fields.disabled = false;
        note.hidden = true;
        failed.querySelector("span").textContent = SEND_ERRORS[error.message] ?? SEND_ERRORS.other;
        failed.hidden = false;
        if (widget !== null && !captchaBroken) window.turnstile.reset(widget);
      } finally {
        submit.textContent = label;
      }
    });
  }

  // ---------- Heroes ----------

  // The game's squad colours (left / right) and the HP ring's pale track.
  const RING_COLORS = { blue: "#3da5ff", red: "#ff5c5c" };
  const RING_TRACK_ALPHA = 0.35;
  const RING = { rx: 27, ry: 12, thickness: 2 };

  // Rounds halves away from zero, as the game does.
  const roundi = (value) => Math.sign(value) * Math.round(Math.abs(value));

  // The ring's cells: every art pixel the ellipses (rx - t, ry - t), t < thickness, pass.
  const ringCells = (() => {
    const seen = new Set();
    const cells = [];
    for (let t = 0; t < RING.thickness; t++) {
      const rx = RING.rx - t;
      const ry = RING.ry - t;
      const steps = Math.ceil(2 * Math.PI * Math.max(rx, ry) * 4);
      for (let i = 0; i < steps; i++) {
        const angle = (2 * Math.PI * i) / steps;
        const x = roundi(rx * Math.sin(angle));
        const y = roundi(-ry * Math.cos(angle));
        if (!seen.has(`${x},${y}`)) {
          seen.add(`${x},${y}`);
          cells.push([x, y]);
        }
      }
    }
    return cells;
  })();

  // A cell's place around the ring: 0 at the front (bottom), growing clockwise on screen.
  const turnOf = ([x, y]) => {
    const angle = Math.atan2(-x / RING.rx, y / RING.ry);
    return (((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
  };

  class Hero {
    constructor(unit) {
      this.unit = unit;
      this.sprite = unit.querySelector(".hero");
      this.data = window.HERO_SPRITES[unit.dataset.hero];
      this.loop = "idle";
      this.timer = 0;
      this.ring = document.createElement("canvas");
      this.ring.className = "ring";
      this.ring.width = 2 * RING.rx + 1;
      this.ring.height = 2 * RING.ry + 1;
      unit.prepend(this.ring);
      this.color = unit.classList.contains("unit--red") ? RING_COLORS.red : RING_COLORS.blue;
      this.setHp(1);
    }

    // The HP ring at [fraction] of the HP: solid from the front clockwise, the pale track after it.
    setHp(fraction) {
      const context = this.ring.getContext("2d");
      context.clearRect(0, 0, this.ring.width, this.ring.height);
      context.fillStyle = this.color;
      for (const cell of ringCells) {
        context.globalAlpha = fraction >= 1 || turnOf(cell) < fraction ? 1 : RING_TRACK_ALPHA;
        context.fillRect(cell[0] + RING.rx, cell[1] + RING.ry, 1, 1);
      }
    }

    // Plays [name] from its first frame; a one-shot (attack, hurt) goes back to the last loop when it ends.
    play(name) {
      const animation = this.data.animations[name];
      if (animation.loop) this.loop = name;
      clearTimeout(this.timer);
      this.sprite.style.setProperty("--row", animation.row);
      let frame = 0;
      const show = () => {
        this.sprite.style.setProperty("--col", frame);
        const hold = animation.holds[frame];
        frame += 1;
        if (frame === animation.holds.length) {
          if (!animation.loop) {
            this.timer = setTimeout(() => this.play(this.loop), hold);
            return;
          }
          frame = 0;
        }
        this.timer = setTimeout(show, hold);
      };
      show();
    }

    marker(animation, name) {
      return this.data.animations[animation].markers[name] ?? 0;
    }

    stop() {
      clearTimeout(this.timer);
      this.loop = "idle";
      this.sprite.style.removeProperty("--row");
      this.sprite.style.removeProperty("--col");
    }
  }

  // ---------- Page 2: the battle scene ----------

  // On the game's board a fighter is 1.3 cells tall, so a cell is about 62 art px; the chest is
  // 0.6 cell above the feet, the "-N" starts 1.65 cells above them.
  const CELL = 81 / 1.3;
  const CHEST = 0.6 * CELL;
  const ARROW_RELEASE_OFFSET = [17, -56]; // where the Longbow's arrow leaves, from the archer's feet (art px)
  const ARROW_SEC_PER_CELL = 0.05;
  const LUNGE_MS = 1000;
  const SPARK_MS = 360;
  const ARC_MS = 500;
  const DAMAGE_MS = 1600;
  const RUN_IN_SHARE = 0.2; // the squads start a fifth of the window away from their places

  const scene = document.querySelector(".battle__scene");
  const fighters = window.HERO_SPRITES
    ? Object.fromEntries([...scene.querySelectorAll(".unit")].map((unit) => [unit.dataset.hero, new Hero(unit)]))
    : {};
  let battleRun = 0;
  let battleStarted = false;

  // The kit's battle effects, loaded up front so a frame never shows before its picture.
  const FX_FRAMES = { "hit-spark": [1, 2, 3], "sword-arc": [2, 3] };
  const fxImages = Object.fromEntries(
    Object.entries(FX_FRAMES).map(([name, frames]) => [
      name,
      frames.map((frame) => Object.assign(new Image(), { src: `assets/fx/${name}-${frame}.png` })),
    ]),
  );

  const hs = () => parseFloat(getComputedStyle(scene).getPropertyValue("--hs")) || 1;
  // Scene px per screen px (the content is zoomed on large monitors).
  const zoom = () => scene.getBoundingClientRect().width / scene.offsetWidth || 1;
  const feet = (hero) => [hero.unit.offsetLeft, hero.unit.offsetTop];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Calls onFrame(t) with t from 0 to 1 over [ms] on animation frames; resolves at 1.
  const tween = (ms, onFrame) =>
    new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        // A frame's timestamp can be a little older than the call.
        const t = Math.min(1, Math.max(0, (now - start) / ms));
        onFrame(t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

  // An effect element in the scene with its top left corner on [x, y] (scene px).
  const effect = (tag, className, [x, y]) => {
    const element = document.createElement(tag);
    element.className = className;
    element.style.left = `${Math.round(x)}px`;
    element.style.top = `${Math.round(y)}px`;
    scene.append(element);
    return element;
  };

  // A kit effect: its frames in turn, fading out over the last 30 %, centred on [at].
  const spawnFrames = async (name, at, ms, flip = false) => {
    const frames = fxImages[name];
    const scale = hs();
    const { naturalWidth: width, naturalHeight: height } = frames[0];
    const image = effect("img", `fx${flip ? " fx--flip" : ""}`, [at[0] - (width * scale) / 2, at[1] - (height * scale) / 2]);
    image.alt = "";
    image.style.width = `${width * scale}px`;
    image.src = frames[0].src;
    let shown = 0;
    await tween(ms, (t) => {
      const frame = Math.min(Math.floor(t * frames.length), frames.length - 1);
      if (frame !== shown) {
        shown = frame;
        image.src = frames[frame].src;
      }
      image.style.opacity = t < 0.7 ? 1 : (1 - t) / 0.3;
    });
    image.remove();
  };

  // The target takes [damage]: Hurt, the hit spark on its chest, the red "-N" rising, the HP ring shrinking.
  const takeDamage = async (target, damage, hp) => {
    const scale = hs();
    const [x, y] = feet(target);
    target.play("hurt");
    target.setHp(hp);
    spawnFrames("hit-spark", [x, y - CHEST * scale], SPARK_MS);
    const label = effect("span", "fx fx--damage", [x, y - 1.65 * CELL * scale]);
    label.textContent = `-${damage}`;
    await tween(DAMAGE_MS, (t) => {
      label.style.opacity = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
      label.style.translate = `0 ${Math.round(-16 * scale * t)}px`;
    });
    label.remove();
  };

  // A squad runs in from its side: Run, sliding a fifth of the window and fading in, then Idle.
  const runIn = async (hero, from, ms) => {
    hero.play("run");
    await tween(ms, (t) => {
      hero.unit.style.translate = `${Math.round(from * (1 - t))}px 0`;
      hero.unit.style.opacity = t;
    });
    hero.play("idle");
  };

  // The archer's Longbow attack: the white-stick arrow leaves at the `release` marker and flies
  // ARROW_SEC_PER_CELL per cell to the target's chest.
  const shoot = async (archer, target, damage, hp, run) => {
    const scale = hs();
    archer.play("attack");
    await wait(archer.marker("attack", "release"));
    if (run !== battleRun) return;
    const [ax, ay] = feet(archer);
    const [tx, ty] = feet(target);
    const from = [ax + ARROW_RELEASE_OFFSET[0] * scale, ay + ARROW_RELEASE_OFFSET[1] * scale];
    const to = [tx, ty - CHEST * scale];
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const arrow = effect("span", "fx fx--arrow", from);
    arrow.style.rotate = `${Math.atan2(to[1] - from[1], to[0] - from[0])}rad`;
    await tween(ARROW_SEC_PER_CELL * 1000 * Math.max(1, distance / (CELL * scale)), (t) => {
      arrow.style.translate = `${Math.round((to[0] - from[0]) * t)}px ${Math.round((to[1] - from[1]) * t)}px`;
    });
    arrow.remove();
    if (run === battleRun) await takeDamage(target, damage, hp);
  };

  // A melee attack: the attacker lunges min(0.4, 0.6 cell / distance) of the way to the target and back over 1 s
  // under the sword arc; the target is hit at the attack's `hit` marker.
  const strike = async (attacker, target, damage, hp, run) => {
    const scale = hs();
    const [ax, ay] = feet(attacker);
    const [tx] = feet(target);
    const delta = tx - ax;
    const lunge = Math.min(0.4, (CELL * scale * 0.6) / Math.max(1, Math.abs(delta)));
    attacker.play("attack");
    spawnFrames("sword-arc", [ax + delta * lunge, ay - CHEST * scale], ARC_MS, delta < 0);
    const moving = tween(LUNGE_MS, (t) => {
      const out = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
      attacker.unit.style.translate = `${Math.round(delta * lunge * out)}px 0`;
    });
    await wait(attacker.marker("attack", "hit"));
    if (run === battleRun) await Promise.all([takeDamage(target, damage, hp), moving]);
  };

  const resetBattle = () => {
    battleRun += 1;
    battleStarted = false;
    scene.querySelectorAll(".fx").forEach((element) => element.remove());
    for (const hero of Object.values(fighters)) {
      hero.stop();
      hero.setHp(1);
      hero.unit.style.translate = "";
      hero.unit.style.opacity = reducedMotion.matches ? "" : "0";
    }
  };

  const playBattle = async () => {
    battleStarted = true;
    const run = battleRun;
    const { archer, knight, wanderer, assassin } = fighters;
    const away = (RUN_IN_SHARE * innerWidth) / zoom();
    await Promise.all([
      runIn(archer, -away, 1200),
      runIn(knight, -away, 1350),
      runIn(wanderer, away, 1250),
      runIn(assassin, away, 1450),
    ]);
    if (run !== battleRun) return;
    await wait(500);
    if (run !== battleRun) return;
    shoot(archer, wanderer, 14, 0.7, run);
    await wait(1700);
    if (run !== battleRun) return;
    strike(assassin, knight, 11, 0.75, run);
  };

  // The battle plays each time its page is opened: it starts once most of the scene shows, and resets once the
  // scene has left the screen. (The scene, not its page: a page next to the current one still touches the screen.)
  if (scene && window.HERO_SPRITES && !reducedMotion.matches) {
    resetBattle();
    new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.6 && !battleStarted) playBattle();
        else if (!entry.isIntersecting && battleStarted) resetBattle();
      },
      { threshold: [0, 0.6] },
    ).observe(scene);
  }

  // ---------- Pager, entrance, battle start ----------

  const markCurrent = () => {
    let current = slides[0];
    for (const [slide, ratio] of ratios) {
      if (ratio > ratios.get(current)) current = slide;
    }
    for (const dot of dots) {
      const isCurrent = dot.hash === `#${current.id}`;
      dot.classList.toggle("is-active", isCurrent);
      if (isCurrent) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        ratios.set(entry.target, entry.intersectionRatio);
        if (entry.intersectionRatio >= 0.25) entry.target.classList.add("is-revealed");
      }
      markCurrent();
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );

  for (const slide of slides) observer.observe(slide);

  // ---------- One page per wheel gesture ----------

  const nearestSlide = () =>
    slides.reduce((best, slide) =>
      Math.abs(slide.offsetTop - scrollY) < Math.abs(best.offsetTop - scrollY) ? slide : best,
    );

  let lastWheelAt = -Infinity;
  let lastTurnAt = -Infinity;

  addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const current = nearestSlide();
      // A page taller than the screen (tablets, phones, tiny windows) scrolls natively.
      if (current.offsetHeight > innerHeight + 1) return;

      event.preventDefault();
      const now = event.timeStamp;
      const isNewGesture = now - lastWheelAt > WHEEL_IDLE_MS;
      lastWheelAt = now;
      if (!isNewGesture || now - lastTurnAt < TURN_MS) return;

      const target = slides[slides.indexOf(current) + Math.sign(event.deltaY)];
      if (!target) return;
      lastTurnAt = now;
      target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
    },
    { passive: false },
  );
})();
