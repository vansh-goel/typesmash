import kaplay from "kaplay";
import "kaplay/global";

const k = kaplay();

k.loadSprite("character", "sprites/bean.png");

const DEF_COUNT = 80;
const DEF_GRAVITY = 800;
const DEF_AIR_DRAG = 0.9;
const DEF_VELOCITY = [1000, 4000];
const DEF_ANGULAR_VELOCITY = [-200, 200];
const DEF_FADE = 0.3;
const DEF_SPREAD = 60;
const DEF_SPIN = [2, 8];
const DEF_SATURATION = 0.7;
const DEF_LIGHTNESS = 0.6;

function addConfetti(opt = {}) {
  const sample = (s) => (typeof s === "function" ? s() : s);
  for (let i = 0; i < (opt.count ?? DEF_COUNT); i++) {
    const p = add([
      pos(sample(opt.pos ?? vec2(0, 0))),
      choose([rect(rand(5, 20), rand(5, 20)), circle(rand(3, 10))]),
      color(
        sample(
          opt.color ?? hsl2rgb(rand(0, 1), DEF_SATURATION, DEF_LIGHTNESS)
        )
      ),
      opacity(1),
      lifespan(4),
      scale(1),
      anchor("center"),
      rotate(rand(0, 360)),
    ]);
    const spin = rand(DEF_SPIN[0], DEF_SPIN[1]);
    const gravity = opt.gravity ?? DEF_GRAVITY;
    const airDrag = opt.airDrag ?? DEF_AIR_DRAG;
    const heading = sample(opt.heading ?? 0) - 90;
    const spread = opt.spread ?? DEF_SPREAD;
    const head = heading + rand(-spread / 2, spread / 2);
    const fade = opt.fade ?? DEF_FADE;
    const vel = sample(opt.velocity ?? rand(DEF_VELOCITY[0], DEF_VELOCITY[1]));
    let velX = Math.cos(deg2rad(head)) * vel;
    let velY = Math.sin(deg2rad(head)) * vel;
    const velA = sample(
      opt.angularVelocity ?? rand(DEF_ANGULAR_VELOCITY[0], DEF_ANGULAR_VELOCITY[1])
    );
    p.onUpdate(() => {
      velY += gravity * dt();
      p.pos.x += velX * dt();
      p.pos.y += velY * dt();
      p.angle += velA * dt();
      p.opacity -= fade * dt();
      velX *= airDrag;
      velY *= airDrag;
      p.scale.x = wave(-1, 1, time() * spin);
    });
  }
}

async function fetchRandomWords(count = 100) {
  const response = await fetch(`https://random-word-api.herokuapp.com/word?number=${count}`);
  const words = await response.json();
  return words;
}

function getMissedWordsThreshold(spawnInterval) {
  if (spawnInterval <= 0.5) return 30;
  if (spawnInterval <= 0.75) return 25;
  if (spawnInterval <= 1) return 20;
  if (spawnInterval <= 1.25) return 15;
  if (spawnInterval <= 1.5) return 10;
  return 20;
}

scene("game", () => {
  k.loadSprite("background", "sprites/s4m_ur4i-bg_clouds.png");

  let wordCount = 10;
  let spawnInterval = 2;
  let wordsQueue = [];
  let wordsFetched = 0;
  let typedWords = 0;
  let missedWords = 0;
  let totalTypedWords = 0;
  let correctTypedWords = 0;
  let startTime = Date.now();

  add([
    sprite("background", { width: width(), height: height() }),
    pos(0, 0),
    layer("background"),
  ]);

  k.add([
    rect(width(), 20),
    pos(0, height() - 20),
    area(),
    outline(4),
    area(),
    body({ isStatic: true }),
    color(32, 30, 67),
    "platform",
  ]);

  const player = add([
    sprite("character"),
    pos(width() / 2, height() - 40),
    area(),
    body(),
    "player",
  ]);

  const wpmLabel = add([
    text("WPM: 0"),
    pos(24, 24),
  ]);

  const typingText = add([
    text("", { size: 24 }),
    pos(width() - 150, 24),
    color(0, 0, 0),
  ]);

  let currentTyping = "";
  let targetWord = null;

  async function fetchAndQueueWords() {
    const words = await fetchRandomWords();
    wordsQueue.push(...words);
    wordsFetched += words.length;
  }

  async function spawnWords() {
    if (wordsQueue.length === 0) {
      await fetchAndQueueWords();
    }

    const word = wordsQueue.shift();
    const wordObj = add([
      text(word, { size: 26 }),
      pos(width(), rand(50, height() - 30)),
      area(),
      color(0, 0, 0),
      move(LEFT, rand(100, 200)),
      "word",
      { value: word },
    ]);

    wordObj.onUpdate(() => {
      if (wordObj.pos.x < 0) {
        destroy(wordObj);
        missedWords++;
        if (missedWords > getMissedWordsThreshold(spawnInterval)) {
          go("lose", calculateWPM(), calculateAccuracy(), missedWords, spawnInterval);
        }
      }
    });

    if (wordsFetched - wordsQueue.length >= 90) {
      fetchAndQueueWords();
    }
  }

  loop(spawnInterval, () => {
    spawnWords();
  });

  function spawnBullet(p) {
    add([
      rect(12, 48),
      area(),
      pos(p),
      anchor("center"),
      color(127, 127, 255),
      outline(4),
      move(UP, BULLET_SPEED),
      offscreen({ destroy: true }),
      "bullet",
    ]);
  }

  onCollide("bullet", "word", (b, w) => {
    destroy(b);
    destroy(w);
    correctTypedWords++;
    totalTypedWords++;
    wpmLabel.text = `WPM: ${calculateWPM()}`;
    typingText.text = "";
    addConfetti({ pos: w.pos });
  });

  onKeyPress((key) => {
    if (key.length === 1 && /[a-z]/i.test(key)) {
      currentTyping += key.toLowerCase();
    } else if (key === "backspace") {
      currentTyping = currentTyping.slice(0, -1);
    } else if (key === "space") {
      const words = get("word");
      let wordTyped = false;
      for (const word of words) {
        if (word.value.toLowerCase() === currentTyping.toLowerCase()) {
          correctTypedWords++;
          destroy(word);
          addKaboom(word.pos);
          addConfetti({ pos: word.pos });
          wordTyped = true;
          player.jump(400);
          player.pos = word.pos.clone();
          break;
        }
      }
      if (wordTyped) {
        totalTypedWords++;
      }
      currentTyping = "";
      targetWord = null;
    }
    typingText.text = currentTyping;
    wpmLabel.text = `WPM: ${calculateWPM()}`;

    if (currentTyping.length === 1) {
      const words = get("word");
      for (const word of words) {
        if (word.value.toLowerCase().startsWith(currentTyping.toLowerCase())) {
          targetWord = word;
          break;
        }
      }
    }

    if (targetWord) {
      const targetX = targetWord.pos.x;
      if (player.pos.x < targetX) {
        player.move(`${targetX / 2}`, 0); // Move right
      } else if (player.pos.x > targetX) {
        player.move(`${-(targetX / 2)}`, 0); // Move left
      }
    }
  });

  onUpdate(() => {
    const accuracy = calculateAccuracy();
    if (totalTypedWords > 10 && accuracy < 30) {
      go("lose", calculateWPM(), accuracy, missedWords, spawnInterval);
    }

    const wpm = calculateWPM();
    if (wpm >= 5 && wordCount < 11) {
      wordCount = 11;
      spawnInterval = 1.5;
    } else if (wpm >= 10 && wordCount < 12) {
      wordCount = 12;
      spawnInterval = 1.25;
    } else if (wpm >= 15 && wordCount < 13) {
      wordCount = 13;
      spawnInterval = 1;
    } else if (wpm >= 20 && wordCount < 14) {
      wordCount = 14;
      spawnInterval = 0.75;
    } else if (wpm >= 25 && wordCount < 15) {
      wordCount = 15;
      spawnInterval = 0.5;
    }
  });

    function calculateWPM() {
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        const charactersTyped = totalTypedWords * 5; // 
        const grossWPM = charactersTyped / 5 / elapsedMinutes;
        const accuracy = correctTypedWords / totalTypedWords;
        const netWPM = grossWPM * accuracy;
        return Math.round(netWPM || 0);
    }

  function calculateAccuracy() {
    return Math.round((correctTypedWords / totalTypedWords) * 100 || 0);
  }
});

scene("lose", (wpm, accuracy, missedWords, spawnInterval) => {
  k.loadSprite("background", "sprites/background.jpg");
  add([
    sprite("background", { width: width(), height: height() }),
    pos(0, 0),
    layer("background"),
  ]);

  addKaboom(center());

  k.add([
    text(`Game Over!\nWPM: ${wpm}\nAccuracy: ${accuracy}%\nMissed Words: ${missedWords}`, { size: 36 }),
    pos(center()),
    anchor("center"),
  ]);

  if (accuracy < 30) {
    add([
      text("You were defeated due to less than 30% accuracy", { size: 24 }),
      pos(center().add(0, 80)),
      anchor("center"),
    ]);
  }

  if (missedWords > getMissedWordsThreshold(spawnInterval)) {
    add([
      text(`You were defeated due to missing more than ${getMissedWordsThreshold(spawnInterval)} words`, { size: 24 }),
      pos(center().add(0, 120)),
      anchor("center"),
    ]);
  }

  add([
    text("Press Space to Restart", { size: 24 }),
    pos(center().add(0, 160)),
    anchor("center"),
  ]);

  onKeyPress("space", () => {
    go("game");
  });
});

setGravity(900)

go("game");