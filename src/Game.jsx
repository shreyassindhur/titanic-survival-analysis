import { useEffect, useRef, useState } from 'react';

// Make canvas responsive to viewport while maintaining 8:5 aspect ratio
const getGameDimensions = () => {
  const maxWidth = window.innerWidth;
  const maxHeight = window.innerHeight;
  const aspectRatio = 8 / 5;
  
  let width = maxWidth;
  let height = width / aspectRatio;
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width: Math.floor(width), height: Math.floor(height) };
};

const { width: WIDTH, height: HEIGHT } = getGameDimensions();
const STORAGE_KEY = 'drift-best-score';
const MAX_PHASE = 7;
const STAR_COUNT = 180;
const CLOUD_COUNT = 5;
const TRAIL_LIMIT = 20;
const POWERUP_SPAWN_INTERVAL = 420;
const POWERUP_MAX = 3;
const SHIELD_DURATION = 180;
const BOOST_DURATION = 240;
const COMBO_WINDOW = 240;
const AMBIENT_BAR_MS = 4200;

const particleTypes = [
  { limit: 10, label: 'dust particle' },
  { limit: 14, label: 'meteorite' },
  { limit: 18, label: 'asteroid' },
  { limit: 22, label: 'dwarf planet' },
  { limit: 27, label: 'rocky planet' },
  { limit: 32, label: 'gas giant' },
  { limit: Infinity, label: 'rogue star' },
];

const deathReasons = [
  'orbital collapse',
  'asteroid impact',
  'gravitational pull',
  'sector breach',
  'mass overload',
  'consumed by void',
];

const quips = [
  'size is a privilege until it becomes a target.',
  'the void does not negotiate.',
  'you were briefly significant.',
  'gravity always wins in the end.',
  'the asteroid had no opinion of you.',
  'even stars collapse eventually.',
  'you grew too comfortable in empty space.',
  'the cosmos noted your presence. briefly.',
];

const palettes = [
  {
    body: ['rgba(255,194,194,0.96)', 'rgba(204,60,60,0.93)', 'rgba(72,10,10,0.96)'],
    glow: 'rgba(255,85,85,0.12)',
    ring: 'rgba(255,170,170,0.14)',
    spec: 'rgba(255,255,255,0.16)',
  },
  {
    body: ['rgba(223,188,255,0.96)', 'rgba(150,80,220,0.92)', 'rgba(42,12,74,0.97)'],
    glow: 'rgba(176,106,255,0.12)',
    ring: 'rgba(226,185,255,0.15)',
    spec: 'rgba(255,255,255,0.16)',
  },
  {
    body: ['rgba(255,236,189,0.96)', 'rgba(255,168,55,0.94)', 'rgba(74,33,0,0.98)'],
    glow: 'rgba(255,180,80,0.13)',
    ring: 'rgba(255,227,161,0.14)',
    spec: 'rgba(255,255,255,0.18)',
  },
  {
    body: ['rgba(255,205,228,0.96)', 'rgba(255,96,170,0.94)', 'rgba(72,10,40,0.97)'],
    glow: 'rgba(255,110,180,0.12)',
    ring: 'rgba(255,194,224,0.15)',
    spec: 'rgba(255,255,255,0.17)',
  },
  {
    body: ['rgba(201,231,255,0.96)', 'rgba(68,154,255,0.94)', 'rgba(9,32,72,0.97)'],
    glow: 'rgba(90,180,255,0.12)',
    ring: 'rgba(190,225,255,0.15)',
    spec: 'rgba(255,255,255,0.17)',
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getPlanetType(radius) {
  return particleTypes.find((entry) => radius < entry.limit).label;
}

function getMassPercent(radius) {
  return clamp(((radius - 6) / 30) * 100, 0, 100);
}

function colorForMass(mass) {
  if (mass >= 72) {
    return 'rgba(255,98,98,0.96)';
  }

  if (mass >= 40) {
    return 'rgba(255,190,105,0.96)';
  }

  return 'rgba(255,255,255,0.94)';
}

function createStar() {
  return {
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    r: randomBetween(0.2, 1.4),
    phase: Math.random() * Math.PI * 2,
    speed: randomBetween(0.012, 0.04),
    alpha: randomBetween(0.35, 0.95),
  };
}

function createCloud() {
  const hue = pick(['rgba(124,71,255', 'rgba(39,190,175', 'rgba(255,113,132']);
  return {
    x: randomBetween(WIDTH * 0.12, WIDTH * 0.88),
    y: randomBetween(HEIGHT * 0.14, HEIGHT * 0.86),
    radius: randomBetween(110, 220),
    spread: randomBetween(0.5, 0.95),
    color: hue,
    phase: Math.random() * Math.PI * 2,
  };
}

function createEnemy(player, phase, difficultyEase = 1) {
  const edge = Math.floor(Math.random() * 4);
  const radius = randomBetween(5.5, 11.5);
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = -radius - 8;
    y = Math.random() * HEIGHT;
  } else if (edge === 1) {
    x = WIDTH + radius + 8;
    y = Math.random() * HEIGHT;
  } else if (edge === 2) {
    x = Math.random() * WIDTH;
    y = -radius - 8;
  } else {
    x = Math.random() * WIDTH;
    y = HEIGHT + radius + 8;
  }

  const angle = Math.atan2(player.y - y, player.x - x);
  const baseSpeed = 0.2 + phase * 0.08 + Math.random() * 0.15;
  const easeMultiplier = 0.35 + 0.65 * difficultyEase;
  const speed = baseSpeed * easeMultiplier;
  const palette = pick(palettes);

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius,
    angle: Math.random() * Math.PI * 2,
    spin: randomBetween(-0.02, 0.02),
    palette,
    hasRing: Math.random() < 0.65,
    ringTilt: randomBetween(0.25, 0.58),
    ringScale: randomBetween(1.35, 1.8),
  };
}

function createPowerup(player) {
  let x = randomBetween(WIDTH * 0.12, WIDTH * 0.88);
  let y = randomBetween(HEIGHT * 0.14, HEIGHT * 0.86);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const dx = x - player.x;
    const dy = y - player.y;
    if (Math.hypot(dx, dy) > 120) {
      break;
    }

    x = randomBetween(WIDTH * 0.12, WIDTH * 0.88);
    y = randomBetween(HEIGHT * 0.14, HEIGHT * 0.86);
  }

  return {
    x,
    y,
    r: randomBetween(7.5, 9.5),
    angle: Math.random() * Math.PI * 2,
    spin: randomBetween(-0.04, 0.04),
    pulse: Math.random() * Math.PI * 2,
  };
}

function createCollisionBurst(x, y, radius) {
  const sparks = [];
  const sparkCount = 8;

  for (let index = 0; index < sparkCount; index += 1) {
    const angle = (Math.PI * 2 * index) / sparkCount + randomBetween(-0.2, 0.2);
    sparks.push({
      angle,
      distance: randomBetween(radius * 0.9, radius * 1.8),
      speed: randomBetween(0.35, 0.9),
      size: randomBetween(0.8, 1.6),
    });
  }

  return {
    x,
    y,
    age: 0,
    life: 48,
    radius,
    sparks,
  };
}

function drawPlanet(ctx, x, y, radius, palette, rotation, glowOpacity, trailStyle = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  if (!trailStyle) {
    const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.6);
    glow.addColorStop(0, palette.glow.replace('0.12', `${glowOpacity}`));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const fill = ctx.createRadialGradient(-radius * 0.28, -radius * 0.28, radius * 0.12, 0, 0, radius * 1.1);
  fill.addColorStop(0, palette.body[0]);
  fill.addColorStop(0.45, palette.body[1]);
  fill.addColorStop(1, palette.body[2]);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  const spec = ctx.createRadialGradient(-radius * 0.28, -radius * 0.28, radius * 0.05, -radius * 0.28, -radius * 0.28, radius * 0.34);
  spec.addColorStop(0, palette.spec);
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(-radius * 0.28, -radius * 0.28, radius * 0.18, 0, Math.PI * 2);
  ctx.fill();

  if (!trailStyle && Math.random() < 0.0001) {
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
  }

  ctx.restore();
}

export default function Game() {
  const canvasRef = useRef(null);
  const scoreRef = useRef(null);
  const bestRef = useRef(null);
  const bonusRef = useRef(null);
  const massFillRef = useRef(null);
  const massTypeRef = useRef(null);
  const sectorRef = useRef(null);
  const gameRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioMasterRef = useRef(null);
  const audioMusicRef = useRef({ intervalId: null, gain: null, filter: null, active: false, barIndex: 0 });
  const pointerRef = useRef({ x: WIDTH / 2, y: HEIGHT / 2, active: false });
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [ending, setEnding] = useState({ reason: '', score: 0, quip: '', classification: '' });

  const ensureAudio = () => {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!audioContextRef.current) {
      const context = new AudioContextClass();
      const master = context.createGain();
      master.gain.value = 0.24;
      master.connect(context.destination);
      audioContextRef.current = context;
      audioMasterRef.current = master;
    }

    return audioContextRef.current;
  };

  const scheduleTone = (context, destination, options) => {
    if (!context || !destination) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startTime = options.startTime ?? context.currentTime;
    const duration = options.duration ?? 0.16;
    const startFrequency = options.frequency;
    const endFrequency = options.endFrequency ?? startFrequency;
    const attack = options.attack ?? 0.015;
    const release = options.release ?? 0.02;

    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.5, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + release + 0.04);
  };

  const playTone = (options) => {
    const context = ensureAudio();
    const master = audioMasterRef.current;
    if (!context || !master) {
      return;
    }

    if (context.state === 'suspended') {
      context.resume();
    }

    scheduleTone(context, master, options);
  };

  const stopAmbientMusic = () => {
    const musicState = audioMusicRef.current;
    if (musicState.intervalId) {
      window.clearInterval(musicState.intervalId);
      musicState.intervalId = null;
    }

    if (musicState.gain && audioContextRef.current) {
      const context = audioContextRef.current;
      const now = context.currentTime;
      musicState.gain.gain.cancelScheduledValues(now);
      musicState.gain.gain.setValueAtTime(Math.max(musicState.gain.gain.value, 0.0001), now);
      musicState.gain.gain.linearRampToValueAtTime(0.0001, now + 0.45);

      window.setTimeout(() => {
        try {
          musicState.filter?.disconnect();
          musicState.gain?.disconnect();
        } catch {
          // Ignore teardown disconnect errors.
        }
      }, 500);
    }

    audioMusicRef.current = { intervalId: null, gain: null, filter: null, active: false, barIndex: 0 };
  };

  const startAmbientMusic = () => {
    const context = ensureAudio();
    const master = audioMasterRef.current;
    if (!context || !master) {
      return;
    }

    if (context.state === 'suspended') {
      context.resume();
    }

    stopAmbientMusic();

    const musicFilter = context.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 1600;
    musicFilter.Q.value = 0.8;

    const musicGain = context.createGain();
    musicGain.gain.value = 0.0001;

    musicFilter.connect(musicGain);
    musicGain.connect(master);

    musicGain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.8);

    const chordProgression = [220, 261.63, 196, 246.94];
    const musicState = audioMusicRef.current;
    musicState.gain = musicGain;
    musicState.filter = musicFilter;
    musicState.active = true;
    musicState.barIndex = 0;

    const scheduleAmbientBar = () => {
      if (!audioMusicRef.current.active) {
        return;
      }

      const currentState = audioMusicRef.current;
      const barStart = context.currentTime + 0.04;
      const root = chordProgression[currentState.barIndex % chordProgression.length];
      const fifth = root * 1.5;
      const octave = root * 2;

      scheduleTone(context, musicFilter, { type: 'sine', frequency: root, endFrequency: root * 0.995, duration: 2.8, volume: 0.08, attack: 0.08, release: 0.3, startTime: barStart });
      scheduleTone(context, musicFilter, { type: 'triangle', frequency: fifth, endFrequency: fifth * 1.01, duration: 1.6, volume: 0.04, attack: 0.12, release: 0.22, startTime: barStart + 0.6 });
      scheduleTone(context, musicFilter, { type: 'sine', frequency: octave, endFrequency: octave * 1.01, duration: 1.0, volume: 0.028, attack: 0.15, release: 0.2, startTime: barStart + 1.45 });
      scheduleTone(context, musicFilter, { type: 'triangle', frequency: root * 0.5, endFrequency: root * 0.5, duration: 2.1, volume: 0.022, attack: 0.08, release: 0.25, startTime: barStart + 1.8 });

      if (currentState.barIndex % 2 === 0) {
        scheduleTone(context, musicFilter, { type: 'sine', frequency: root * 2, endFrequency: root * 2, duration: 0.45, volume: 0.02, attack: 0.02, release: 0.18, startTime: barStart + 3.0 });
      }

      currentState.barIndex += 1;
    };

    scheduleAmbientBar();
    musicState.intervalId = window.setInterval(scheduleAmbientBar, AMBIENT_BAR_MS);
  };

  const playCollectSound = () => {
    playTone({ type: 'triangle', frequency: 520, endFrequency: 920, duration: 0.14, volume: 0.7 });
    playTone({ type: 'sine', frequency: 1040, endFrequency: 1560, duration: 0.1, volume: 0.3 });
  };

  const playShieldSound = () => {
    playTone({ type: 'sine', frequency: 220, endFrequency: 440, duration: 0.2, volume: 0.55 });
  };

  const playHitSound = () => {
    playTone({ type: 'sawtooth', frequency: 180, endFrequency: 60, duration: 0.22, volume: 0.5 });
  };

  const playStartSound = () => {
    playTone({ type: 'triangle', frequency: 260, endFrequency: 520, duration: 0.12, volume: 0.42 });
    playTone({ type: 'sine', frequency: 520, endFrequency: 780, duration: 0.11, volume: 0.26 });
  };

  useEffect(() => {
    const stars = Array.from({ length: STAR_COUNT }, createStar);
    const clouds = Array.from({ length: CLOUD_COUNT }, createCloud);
    const storedBest = Number(localStorage.getItem(STORAGE_KEY) || '0') || 0;
    if (bestRef.current) {
      bestRef.current.textContent = `best — ${storedBest.toFixed(1)}s`;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const state = {
      ticker: 0,
      startTime: 0,
      phase: 1,
      spawnInterval: 85,
      sectorTimer: 0,
      sectorLabel: 'sector 1',
      score: 0,
      best: storedBest,
      player: {
        x: WIDTH / 2,
        y: HEIGHT / 2,
        r: 6,
        targetR: 6,
      },
      trail: [],
      enemies: [],
      powerups: [],
      collisionBursts: [],
      started: false,
      dead: false,
      graceTimer: 0,
      shieldTimer: 0,
      boostTimer: 0,
      combo: 0,
      comboTimer: 0,
      stars,
      clouds,
      lastMassType: 'dust particle',
      lastMassPercent: 0,
      inputX: WIDTH / 2,
      inputY: HEIGHT / 2,
    };

    gameRef.current = state;

    const updateHud = () => {
      const currentType = getPlanetType(state.player.r);
      const massPercent = getMassPercent(state.player.r);
      state.lastMassType = currentType;
      state.lastMassPercent = massPercent;

      if (scoreRef.current) {
        scoreRef.current.textContent = `${state.score.toFixed(1)}s`;
      }

      if (bestRef.current) {
        bestRef.current.textContent = `best — ${state.best.toFixed(1)}s`;
      }

      if (bonusRef.current) {
        const bonusParts = [];
        if (state.shieldTimer > 0) {
          bonusParts.push(`shield ${Math.ceil(state.shieldTimer / 60)}s`);
        }
        if (state.boostTimer > 0) {
          bonusParts.push('boosted drift');
        }
        if (state.combo > 1) {
          bonusParts.push(`combo x${state.combo}`);
        }

        bonusRef.current.textContent = bonusParts.length > 0 ? bonusParts.join(' · ') : 'collect stardust';
        bonusRef.current.style.opacity = bonusParts.length > 0 ? '0.92' : '0.26';
      }

      if (massTypeRef.current) {
        massTypeRef.current.textContent = currentType;
      }

      if (massFillRef.current) {
        massFillRef.current.style.width = `${massPercent}%`;
        massFillRef.current.style.background = colorForMass(massPercent);
      }

      if (sectorRef.current) {
        const alpha = state.sectorTimer > 0 ? clamp(state.sectorTimer / 120, 0, 1) * 0.9 : 0;
        sectorRef.current.textContent = state.sectorLabel;
        sectorRef.current.style.opacity = `${alpha}`;
      }
    };

    const setInputFromEvent = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      state.inputX = (clientX - rect.left) * scaleX;
      state.inputY = (clientY - rect.top) * scaleY;
      pointerRef.current = { x: state.inputX, y: state.inputY, active: true };
    };

    const onMouseMove = (event) => {
      setInputFromEvent(event.clientX, event.clientY);
    };

    const onMouseDown = (event) => {
      ensureAudio();
      setInputFromEvent(event.clientX, event.clientY);
    };

    const onTouchStart = (event) => {
      event.preventDefault();
      ensureAudio();
      const touch = event.touches[0];
      if (touch) {
        setInputFromEvent(touch.clientX, touch.clientY);
      }
    };

    const onTouchMove = (event) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (touch) {
        setInputFromEvent(touch.clientX, touch.clientY);
      }
    };

    const onTouchEnd = (event) => {
      event.preventDefault();
      pointerRef.current.active = false;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    const handleDeath = (reasonOverride) => {
      state.dead = true;
      state.collisionBursts.push(createCollisionBurst(state.player.x, state.player.y, state.player.r));
      playHitSound();
      stopAmbientMusic();
      const finalScore = state.score;
      const isBest = finalScore > state.best;

      if (isBest) {
        state.best = finalScore;
        localStorage.setItem(STORAGE_KEY, String(finalScore));
      }

      const finalRadius = state.player.r;
      const finalType = getPlanetType(finalRadius);
      const finalMass = getMassPercent(finalRadius);
      const reason = reasonOverride || pick(deathReasons);
      const quip = pick(quips);
      setEnding({
        reason,
        score: finalScore,
        quip,
        classification: `classification: ${finalType} · mass: ${finalMass.toFixed(0)}%`,
      });
      setGameOver(true);
    };

    const drawPowerup = (powerup) => {
      const pulse = 0.75 + Math.sin((state.ticker * 0.08) + powerup.pulse) * 0.25;
      ctx.save();
      ctx.translate(powerup.x, powerup.y);
      ctx.rotate(powerup.angle);

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, powerup.r * 3.2);
      glow.addColorStop(0, `rgba(140,240,255,${0.42 * pulse})`);
      glow.addColorStop(0.45, `rgba(120,180,255,${0.14 * pulse})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, powerup.r * 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(220,250,255,${0.9 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -powerup.r * 1.5);
      ctx.lineTo(powerup.r * 0.7, 0);
      ctx.lineTo(0, powerup.r * 1.5);
      ctx.lineTo(-powerup.r * 0.7, 0);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = `rgba(255,255,255,${0.85 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, powerup.r * 0.48, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawCollisionBurst = (burst) => {
      const progress = burst.age / burst.life;
      const fade = 1 - progress;
      const ringRadius = burst.radius * (1.2 + progress * 2.8);

      ctx.save();
      ctx.globalAlpha = fade;

      const ring = ctx.createRadialGradient(burst.x, burst.y, ringRadius * 0.45, burst.x, burst.y, ringRadius * 1.12);
      ring.addColorStop(0, 'rgba(235,250,255,0)');
      ring.addColorStop(0.65, 'rgba(210,240,255,0.18)');
      ring.addColorStop(1, 'rgba(210,240,255,0)');
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, ringRadius * 1.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(220,245,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      for (const spark of burst.sparks) {
        const travel = spark.distance + burst.age * spark.speed;
        const sx = burst.x + Math.cos(spark.angle) * travel;
        const sy = burst.y + Math.sin(spark.angle) * travel;
        ctx.fillStyle = 'rgba(240,250,255,0.9)';
        ctx.beginPath();
        ctx.arc(sx, sy, spark.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const drawBackground = () => {
      ctx.fillStyle = '#03030a';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      for (const cloud of state.clouds) {
        const pulse = 0.65 + Math.sin((state.ticker * 0.005) + cloud.phase) * 0.35;
        const gradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius);
        gradient.addColorStop(0, `${cloud.color},${0.07 * pulse})`);
        gradient.addColorStop(0.38, `${cloud.color},${0.03 * pulse})`);
        gradient.addColorStop(1, 'rgba(3,3,10,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const star of state.stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(state.ticker * star.speed + star.phase);
        ctx.fillStyle = `rgba(255,255,255,${star.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawTrail = () => {
      for (let index = 0; index < state.trail.length; index += 1) {
        const point = state.trail[index];
        const progress = (index + 1) / state.trail.length;
        ctx.save();
        ctx.globalAlpha = progress * 0.15;
        ctx.fillStyle = 'rgba(180,220,200,1)';
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r * progress * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const drawPlayer = () => {
      const { x, y, r } = state.player;
      const boostActive = state.boostTimer > 0;
      const shieldActive = state.shieldTimer > 0;
      const glowColor = boostActive ? 'rgba(120,230,255,0.18)' : 'rgba(150,210,185,0.08)';
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * (boostActive ? 2.1 : 1.6));
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, 'rgba(150,210,185,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * (boostActive ? 2.1 : 1.6), 0, Math.PI * 2);
      ctx.fill();

      const body = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, r * 0.08, x, y, r * 1.1);
      body.addColorStop(0, boostActive ? 'rgba(220,255,255,0.98)' : 'rgba(200,240,220,0.95)');
      body.addColorStop(0.45, boostActive ? 'rgba(105,220,240,0.92)' : 'rgba(80,160,120,0.9)');
      body.addColorStop(1, boostActive ? 'rgba(18,56,72,0.95)' : 'rgba(10,40,25,0.95)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      const spec = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, r * 0.02, x - r * 0.28, y - r * 0.28, r * 0.36);
      spec.addColorStop(0, 'rgba(255,255,255,0.18)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.18, 0, Math.PI * 2);
      ctx.fill();

      if (shieldActive) {
        ctx.strokeStyle = 'rgba(180,240,255,0.38)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.05, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const drawEnemy = (enemy) => {
      const palette = enemy.palette;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.r * 1.8);
      glow.addColorStop(0, palette.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r * 1.8, 0, Math.PI * 2);
      ctx.fill();

      const body = ctx.createRadialGradient(-enemy.r * 0.3, -enemy.r * 0.3, enemy.r * 0.08, 0, 0, enemy.r * 1.08);
      body.addColorStop(0, palette.body[0]);
      body.addColorStop(0.46, palette.body[1]);
      body.addColorStop(1, palette.body[2]);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r, 0, Math.PI * 2);
      ctx.fill();

      const spec = ctx.createRadialGradient(-enemy.r * 0.3, -enemy.r * 0.3, enemy.r * 0.02, -enemy.r * 0.3, -enemy.r * 0.3, enemy.r * 0.34);
      spec.addColorStop(0, palette.spec);
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(-enemy.r * 0.3, -enemy.r * 0.3, enemy.r * 0.18, 0, Math.PI * 2);
      ctx.fill();

      if (enemy.hasRing) {
        ctx.strokeStyle = palette.ring;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.r * enemy.ringScale, enemy.r * enemy.ringTilt, enemy.angle * 0.12, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    let animationFrameId = 0;

    const updateFrame = () => {
      if (!gameRef.current) {
        return;
      }

      if (state.started && !state.dead) {
        state.ticker += 1;
        state.score = (Date.now() - state.startTime) / 1000;
        // Extend difficulty curve: reaches max at 240 seconds instead of 45, for much more gradual increase
        const difficultyEase = Math.min(1, state.score / 240);

        state.shieldTimer = Math.max(0, state.shieldTimer - 1);
        state.boostTimer = Math.max(0, state.boostTimer - 1);
        state.comboTimer = Math.max(0, state.comboTimer - 1);
        state.graceTimer = Math.max(0, state.graceTimer - 1);
        if (state.comboTimer === 0) {
          state.combo = 0;
        }

        const nextBursts = [];
        for (const burst of state.collisionBursts) {
          burst.age += 1;
          if (burst.age < burst.life) {
            nextBursts.push(burst);
          }
        }
        state.collisionBursts = nextBursts;

        if (state.ticker % POWERUP_SPAWN_INTERVAL === 0 && state.powerups.length < POWERUP_MAX) {
          state.powerups.push(createPowerup(state.player));
        }

        const nextPhase = Math.min(MAX_PHASE, 1 + Math.floor(state.score / 25));
        if (nextPhase !== state.phase) {
          state.phase = nextPhase;
          state.spawnInterval = Math.max(35, 200 - state.phase * 16);
          state.sectorLabel = `sector ${state.phase}`;
          state.sectorTimer = 120;
        }

        state.sectorTimer = Math.max(0, state.sectorTimer - 1);

        state.player.targetR = Math.min(36, 6 + state.ticker * 0.00085);
        state.player.r = lerp(state.player.r, state.player.targetR, 0.008);

        const lerpSpeed = Math.max(0.055, (state.boostTimer > 0 ? 0.24 : 0.18) - (state.player.r - 6) * 0.0028);
        state.player.x = lerp(state.player.x, state.inputX, lerpSpeed);
        state.player.y = lerp(state.player.y, state.inputY, lerpSpeed);

        state.trail.unshift({ x: state.player.x, y: state.player.y, r: state.player.r });
        if (state.trail.length > TRAIL_LIMIT) {
          state.trail.length = TRAIL_LIMIT;
        }

        if (state.ticker % state.spawnInterval === 0) {
          const nextEnemies = [
            createEnemy(state.player, state.phase, difficultyEase),
            createEnemy(state.player, state.phase, difficultyEase),
            createEnemy(state.player, state.phase, difficultyEase),
          ];
          state.enemies.push(...nextEnemies);
        }

        if (state.phase >= 3 && state.ticker % (state.spawnInterval + 15) === 0) {
          state.enemies.push(createEnemy(state.player, state.phase, difficultyEase));
        }

        const phaseFiveInterval = Math.max(1, Math.floor(state.spawnInterval * 0.7));
        if (state.phase >= 5 && state.ticker % phaseFiveInterval === 0) {
          state.enemies.push(createEnemy(state.player, state.phase, difficultyEase));
        }

        const nextPowerups = [];
        for (const powerup of state.powerups) {
          powerup.angle += powerup.spin;
          const dx = state.player.x - powerup.x;
          const dy = state.player.y - powerup.y;
          const distance = Math.hypot(dx, dy);

          if (distance < state.player.r + powerup.r * 1.25) {
            state.shieldTimer = Math.max(state.shieldTimer, SHIELD_DURATION);
            state.boostTimer = Math.max(state.boostTimer, BOOST_DURATION);
            state.combo = Math.min(9, state.combo + 1);
            state.comboTimer = COMBO_WINDOW;
            playCollectSound();
            playShieldSound();
            continue;
          }

          if (powerup.x > -120 && powerup.x < WIDTH + 120 && powerup.y > -120 && powerup.y < HEIGHT + 120) {
            nextPowerups.push(powerup);
          }
        }
        state.powerups = nextPowerups;

        const nextEnemies = [];
        for (const enemy of state.enemies) {
          const easeMultiplier = 0.35 + 0.65 * difficultyEase;
          enemy.vx += (state.player.x - enemy.x) * 0.00018 * state.phase * easeMultiplier;
          enemy.vy += (state.player.y - enemy.y) * 0.00018 * state.phase * easeMultiplier;
          enemy.x += enemy.vx;
          enemy.y += enemy.vy;
          enemy.angle += enemy.spin;

          const dx = state.player.x - enemy.x;
          const dy = state.player.y - enemy.y;
          const distance = Math.hypot(dx, dy);
          if (distance < state.player.r + enemy.r * 0.8) {
            if (state.graceTimer > 0) {
              enemy.vx = -enemy.vx * 0.5;
              enemy.vy = -enemy.vy * 0.5;
              enemy.x += dx * 0.45;
              enemy.y += dy * 0.45;
              nextEnemies.push(enemy);
              continue;
            }

            if (state.shieldTimer > 0) {
              state.shieldTimer = Math.max(0, state.shieldTimer - 90);
              state.boostTimer = Math.max(state.boostTimer, 90);
              playShieldSound();
              enemy.vx = -enemy.vx * 0.65;
              enemy.vy = -enemy.vy * 0.65;
              enemy.x += dx * 0.4;
              enemy.y += dy * 0.4;
              nextEnemies.push(enemy);
              continue;
            }

            handleDeath();
            break;
          }

          if (enemy.x > -120 && enemy.x < WIDTH + 120 && enemy.y > -120 && enemy.y < HEIGHT + 120) {
            nextEnemies.push(enemy);
          }
        }
        state.enemies = nextEnemies;

        if (!state.dead && state.player.x > -40 && state.player.x < WIDTH + 40 && state.player.y > -40 && state.player.y < HEIGHT + 40) {
          // keep the player inside the playable area without snapping the motion
          state.player.x = clamp(state.player.x, 0, WIDTH);
          state.player.y = clamp(state.player.y, 0, HEIGHT);
        }
      }

      drawBackground();
      drawTrail();

      for (const powerup of state.powerups) {
        drawPowerup(powerup);
      }

      for (const burst of state.collisionBursts) {
        drawCollisionBurst(burst);
      }

      for (const enemy of state.enemies) {
        drawEnemy(enemy);
      }

      if (state.started && !state.dead) {
        drawPlayer();
      }

      updateHud();
      animationFrameId = requestAnimationFrame(updateFrame);
    };

    updateHud();
    animationFrameId = requestAnimationFrame(updateFrame);

    const onKeyDown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (!state.started || state.dead) {
          startGame();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      stopAmbientMusic();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const startGame = async () => {
    const state = gameRef.current;
    if (!state) {
      return;
    }

    const context = ensureAudio();
    if (context && context.state === 'suspended') {
      try {
        await context.resume();
      } catch {
        // If the browser refuses to resume immediately, the game can still continue.
      }
    }

    state.ticker = 0;
    state.startTime = Date.now();
    state.phase = 1;
    state.spawnInterval = 200;
    state.sectorTimer = 120;
    state.sectorLabel = 'sector 1';
    state.score = 0;
    state.player = {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      r: 6,
      targetR: 6,
    };
    state.trail = [];
    state.enemies = [];
    state.powerups = [createPowerup({ x: WIDTH / 2, y: HEIGHT / 2 })];
    state.collisionBursts = [];
    state.started = true;
    state.dead = false;
    state.graceTimer = 240;
    state.shieldTimer = 0;
    state.boostTimer = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.inputX = pointerRef.current.active ? pointerRef.current.x : WIDTH / 2;
    state.inputY = pointerRef.current.active ? pointerRef.current.y : HEIGHT / 2;
    setGameOver(false);
    setStarted(true);
    playStartSound();
    startAmbientMusic();
  };

  const restartGame = () => {
    startGame();
  };

  const stateForOverlay = gameOver ? ending : null;

  return (
    <div className="drift-app">
      <div className="drift-stage" style={{ width: '100%', height: '100%', maxWidth: 'none' }}>
        <canvas ref={canvasRef} className="drift-canvas" width={WIDTH} height={HEIGHT} />

        <div className="drift-hud" aria-hidden="true">
          <div className="hud-top-left">
            <div ref={scoreRef} className="hud-score">0.0s</div>
            <div ref={bestRef} className="hud-best">best — 0.0s</div>
          </div>

          <div ref={bonusRef} className="hud-bonus">collect stardust</div>

          <div className="hud-top-right">
            <div className="hud-mass-label">mass</div>
            <div className="hud-mass-track">
              <div ref={massFillRef} className="hud-mass-fill" />
            </div>
            <div ref={massTypeRef} className="hud-mass-type">dust particle</div>
          </div>

          <div ref={sectorRef} className="hud-sector">sector 1</div>
        </div>

        {!started && !gameOver ? (
          <div className="drift-overlay">
            <div className="drift-card">
              <div className="drift-title">
                drift<span className="muted-dot">.</span>
              </div>
              <div className="drift-poem">
                you are a planet.
                {'\n'}the galaxy does not care.
                {'\n'}survive.
                {'\n'}you will grow.
                {'\n'}growing will kill you.
              </div>
              <button type="button" className="drift-action" onClick={startGame}>
                begin
              </button>
            </div>
          </div>
        ) : null}

        {gameOver && stateForOverlay ? (
          <div className="drift-overlay">
            <div className="drift-card">
              <div className="drift-reason">{stateForOverlay.reason}</div>
              <div className="drift-score">{stateForOverlay.score.toFixed(1)}</div>
              <div className="drift-seconds">seconds</div>
              <div className="drift-quip">{stateForOverlay.quip}</div>
              <div className="drift-classification">{stateForOverlay.classification}</div>
              <button type="button" className="drift-action" onClick={restartGame}>
                again
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
