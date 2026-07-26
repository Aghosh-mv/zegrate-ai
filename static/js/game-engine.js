(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let gameRunning = false;
  let gamePaused = false;
  let animFrame = null;
  let lastTime = 0;
  let gameCtx = null;

  const templates = {
    platformer: `// Platformer Game Template
const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const SPEED = 4;
let player = { x: 100, y: 300, vx: 0, vy: 0, w: 32, h: 48, grounded: false };
let platforms = [];
let coins = [];
let score = 0;
let keys = {};

function init() {
  platforms = [
    { x: 0, y: 440, w: 800, h: 40 },
    { x: 200, y: 350, w: 120, h: 16 },
    { x: 400, y: 280, w: 120, h: 16 },
    { x: 100, y: 200, w: 100, h: 16 },
    { x: 500, y: 180, w: 140, h: 16 },
  ];
  coins = [
    { x: 240, y: 320, r: 8 },
    { x: 440, y: 250, r: 8 },
    { x: 130, y: 170, r: 8 },
    { x: 550, y: 150, r: 8 },
  ];
  score = 0;
  player = { x: 100, y: 300, vx: 0, vy: 0, w: 32, h: 48, grounded: false };
}

function update(dt) {
  if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -SPEED;
  else if (keys['ArrowRight'] || keys['KeyD']) player.vx = SPEED;
  else player.vx = 0;

  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.grounded) {
    player.vy = JUMP_FORCE;
    player.grounded = false;
  }

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;
  player.grounded = false;

  for (const p of platforms) {
    if (player.x + player.w > p.x && player.x < p.x + p.w &&
        player.y + player.h > p.y && player.y + player.h < p.y + p.h + 10 && player.vy >= 0) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.grounded = true;
    }
  }

  coins = coins.filter(c => {
    const dx = player.x + player.w/2 - c.x;
    const dy = player.y + player.h/2 - c.y;
    if (Math.sqrt(dx*dx+dy*dy) < c.r + 16) { score++; return false; }
    return true;
  });

  if (player.y > 500) { init(); }
}

function render(ctx) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 800, 480);

  for (const p of platforms) {
    ctx.fillStyle = '#4a4a6a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  for (const c of coins) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#6366f1';
  ctx.fillRect(player.x, player.y, player.w, player.h);

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('Score: ' + score, 10, 25);
}

function handleInput(event) {
  if (event.type === 'keydown') keys[event.code] = true;
  if (event.type === 'keyup') keys[event.code] = false;
}`,

    topdown: `// Top-Down RPG Template
let player = { x: 400, y: 240, speed: 3, dir: 0 };
let npcs = [
  { x: 200, y: 200, msg: "Welcome, traveler!" },
  { x: 600, y: 150, msg: "Beware the dungeon..." },
];
let trees = [];
let keys = {};

function init() {
  player = { x: 400, y: 240, speed: 3, dir: 0 };
  trees = [];
  for (let i = 0; i < 30; i++) {
    trees.push({ x: Math.random()*800, y: Math.random()*480, r: 10+Math.random()*15 });
  }
}

function update(dt) {
  let dx = 0, dy = 0;
  if (keys['ArrowUp'] || keys['KeyW']) { dy = -player.speed; player.dir = 0; }
  if (keys['ArrowDown'] || keys['KeyS']) { dy = player.speed; player.dir = 2; }
  if (keys['ArrowLeft'] || keys['KeyA']) { dx = -player.speed; player.dir = 3; }
  if (keys['ArrowRight'] || keys['KeyD']) { dx = player.speed; player.dir = 1; }
  player.x += dx;
  player.y += dy;
  player.x = Math.max(16, Math.min(784, player.x));
  player.y = Math.max(16, Math.min(464, player.y));
}

function render(ctx) {
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, 0, 800, 480);

  ctx.fillStyle = '#1a3d15';
  for (const t of trees) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.fillStyle = '#e8b84b';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 12, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 6, 0, Math.PI*2);
  ctx.fill();

  for (const n of npcs) {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(n.x, n.y, 10, 0, Math.PI*2);
    ctx.fill();
    const dx = player.x - n.x;
    const dy = player.y - n.y;
    if (Math.sqrt(dx*dx+dy*dy) < 50) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(n.x-60, n.y-35, 120, 22);
      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.msg, n.x, n.y-20);
      ctx.textAlign = 'left';
    }
  }
}

function handleInput(event) {
  if (event.type === 'keydown') keys[event.code] = true;
  if (event.type === 'keyup') keys[event.code] = false;
}`,

    shooter: `// Space Shooter Template
let ship = { x: 400, y: 420, w: 32, h: 32 };
let bullets = [];
let enemies = [];
let score = 0;
let spawnTimer = 0;
let keys = {};

function init() {
  ship = { x: 400, y: 420, w: 32, h: 32 };
  bullets = [];
  enemies = [];
  score = 0;
  spawnTimer = 0;
}

function update(dt) {
  if (keys['ArrowLeft'] || keys['KeyA']) ship.x -= 5;
  if (keys['ArrowRight'] || keys['KeyD']) ship.x += 5;
  if (keys['ArrowUp'] || keys['KeyW']) ship.y -= 5;
  if (keys['ArrowDown'] || keys['KeyS']) ship.y += 5;
  ship.x = Math.max(16, Math.min(784, ship.x));
  ship.y = Math.max(16, Math.min(464, ship.y));

  if (keys['Space'] && Math.random() < 0.3) {
    bullets.push({ x: ship.x, y: ship.y - 16, vy: -8 });
  }

  bullets = bullets.filter(b => { b.y += b.vy; return b.y > -10; });

  spawnTimer++;
  if (spawnTimer > 40) {
    spawnTimer = 0;
    enemies.push({ x: 30 + Math.random()*740, y: -20, vy: 2 + Math.random()*2 });
  }

  enemies = enemies.filter(e => {
    e.y += e.vy;
    if (e.y > 500) return false;
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (Math.abs(bullets[i].x - e.x) < 20 && Math.abs(bullets[i].y - e.y) < 20) {
        bullets.splice(i, 1);
        score += 10;
        return false;
      }
    }
    return true;
  });
}

function render(ctx) {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, 800, 480);

  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y - 16);
  ctx.lineTo(ship.x - 12, ship.y + 12);
  ctx.lineTo(ship.x + 12, ship.y + 12);
  ctx.fill();

  ctx.fillStyle = '#ff0';
  for (const b of bullets) {
    ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
  }

  ctx.fillStyle = '#ef4444';
  for (const e of enemies) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, 10, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('Score: ' + score, 10, 25);
}

function handleInput(event) {
  if (event.type === 'keydown') keys[event.code] = true;
  if (event.type === 'keyup') keys[event.code] = false;
}`,

    puzzle: `// Puzzle Game Template (Match-3 style)
const GRID = 8;
const SIZE = 50;
const COLORS = ['#ef4444','#22c55e','#3b82f6','#eab308','#a855f7'];
let grid = [];
let selected = null;
let offsetX = 40, offsetY = 40;

function init() {
  grid = [];
  for (let r = 0; r < GRID; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID; c++) {
      grid[r][c] = Math.floor(Math.random() * COLORS.length);
    }
  }
}

function update(dt) {}

function render(ctx) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 800, 480);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const x = offsetX + c * SIZE;
      const y = offsetY + r * SIZE;
      ctx.fillStyle = COLORS[grid[r][c]];
      ctx.fillRect(x+2, y+2, SIZE-4, SIZE-4);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(x, y, SIZE, SIZE);
    }
  }
  if (selected) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(offsetX + selected.c * SIZE, offsetY + selected.r * SIZE, SIZE, SIZE);
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText('Click two adjacent tiles to swap', 40, 460);
}

function handleInput(event) {
  if (event.type !== 'click') return;
  const rect = event.target.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const c = Math.floor((mx - offsetX) / SIZE);
  const r = Math.floor((my - offsetY) / SIZE);
  if (r < 0 || r >= GRID || c < 0 || c >= GRID) return;
  if (!selected) { selected = { r, c }; return; }
  if (Math.abs(selected.r-r)+Math.abs(selected.c-c) === 1) {
    [grid[selected.r][selected.c], grid[r][c]] = [grid[r][c], grid[selected.r][selected.c]];
  }
  selected = null;
}`,

    racing: `// Racing Game Template
let car = { x: 400, y: 400, angle: 0, speed: 0 };
let track = [];
let keys = {};
let lap = 0;
let checkpoints = [
  { x: 400, y: 50 }, { x: 700, y: 240 },
  { x: 400, y: 430 }, { x: 100, y: 240 }
];
let nextCP = 0;

function init() {
  car = { x: 400, y: 400, angle: -Math.PI/2, speed: 0 };
  lap = 0; nextCP = 0;
}

function update(dt) {
  if (keys['ArrowUp'] || keys['KeyW']) car.speed = Math.min(car.speed + 0.1, 5);
  else if (keys['ArrowDown'] || keys['KeyS']) car.speed = Math.max(car.speed - 0.1, -2);
  else car.speed *= 0.97;

  if (keys['ArrowLeft'] || keys['KeyA']) car.angle -= 0.04 * (car.speed > 0 ? 1 : -1);
  if (keys['ArrowRight'] || keys['KeyD']) car.angle += 0.04 * (car.speed > 0 ? 1 : -1);

  car.x += Math.cos(car.angle) * car.speed;
  car.y += Math.sin(car.angle) * car.speed;
  car.x = Math.max(10, Math.min(790, car.x));
  car.y = Math.max(10, Math.min(470, car.y));

  const cp = checkpoints[nextCP];
  if (Math.hypot(car.x-cp.x, car.y-cp.y) < 40) {
    nextCP = (nextCP+1) % checkpoints.length;
    if (nextCP === 0) lap++;
  }
}

function render(ctx) {
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, 0, 800, 480);
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.ellipse(400, 240, 300, 170, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#777';
  ctx.beginPath();
  ctx.ellipse(400, 240, 260, 140, 0, 0, Math.PI*2);
  ctx.fill();

  for (let i = 0; i < checkpoints.length; i++) {
    ctx.fillStyle = i === nextCP ? '#ff0' : '#fff';
    ctx.fillRect(checkpoints[i].x-5, checkpoints[i].y-5, 10, 10);
  }

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-12, -8, 24, 16);
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(10, -6, 4, 4);
  ctx.fillRect(10, 2, 4, 4);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('Lap: ' + lap, 10, 25);
}

function handleInput(event) {
  if (event.type === 'keydown') keys[event.code] = true;
  if (event.type === 'keyup') keys[event.code] = false;
}`,

    fighting: `// Fighting Game Template
let p1 = { x: 200, y: 350, hp: 100, vx: 0, facing: 1, punching: false, punchTimer: 0 };
let p2 = { x: 550, y: 350, hp: 100, vx: 0, facing: -1, punching: false, punchTimer: 0 };
let keys = {};
let particles = [];

function init() {
  p1 = { x: 200, y: 350, hp: 100, vx: 0, facing: 1, punching: false, punchTimer: 0 };
  p2 = { x: 550, y: 350, hp: 100, vx: 0, facing: -1, punching: false, punchTimer: 0 };
  particles = [];
}

function update(dt) {
  // P1 controls: WASD + F
  if (keys['KeyA']) p1.vx = -3;
  else if (keys['KeyD']) p1.vx = 3;
  else p1.vx = 0;
  if (keys['KeyW'] && p1.y >= 350) p1.vy = -12;
  p1.x += p1.vx;
  if (keys['KeyF'] && !p1.punching) { p1.punching = true; p1.punchTimer = 15; }
  if (p1.punching) {
    p1.punchTimer--;
    if (p1.punchTimer <= 0) p1.punching = false;
    if (p1.punchTimer === 12 && Math.abs(p1.x - p2.x) < 60) {
      p2.hp -= 8;
      for (let i=0;i<5;i++) particles.push({x:p2.x,y:p2.y-30,vx:(Math.random()-0.5)*4,vy:-Math.random()*3,life:20});
    }
  }

  // P2: Arrow + Period
  if (keys['ArrowLeft']) p2.vx = -3;
  else if (keys['ArrowRight']) p2.vx = 3;
  else p2.vx = 0;
  if (keys['ArrowUp'] && p2.y >= 350) p2.vy = -12;
  p2.x += p2.vx;
  if (keys['Period'] && !p2.punching) { p2.punching = true; p2.punchTimer = 15; }
  if (p2.punching) {
    p2.punchTimer--;
    if (p2.punchTimer <= 0) p2.punching = false;
    if (p2.punchTimer === 12 && Math.abs(p2.x - p1.x) < 60) {
      p1.hp -= 8;
      for (let i=0;i<5;i++) particles.push({x:p1.x,y:p1.y-30,vx:(Math.random()-0.5)*4,vy:-Math.random()*3,life:20});
    }
  }

  p1.facing = p1.x < p2.x ? 1 : -1;
  p2.facing = p2.x < p1.x ? 1 : -1;
  p1.x = Math.max(30, Math.min(770, p1.x));
  p2.x = Math.max(30, Math.min(770, p2.x));

  particles = particles.filter(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.life--; return p.life>0; });

  if (p1.hp <= 0 || p2.hp <= 0) { setTimeout(init, 1000); }
}

function render(ctx) {
  ctx.fillStyle = '#1a0a2e';
  ctx.fillRect(0, 0, 800, 480);
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 420, 800, 60);

  function drawFighter(p, color) {
    ctx.fillStyle = color;
    ctx.fillRect(p.x-15, p.y-50, 30, 50);
    ctx.fillRect(p.x-10*p.facing, p.y-45, 20*p.facing, 10);
    if (p.punching) {
      ctx.fillStyle = '#ff0';
      ctx.fillRect(p.x + 15*p.facing, p.y-40, 20*p.facing, 12);
    }
  }

  drawFighter(p1, '#6366f1');
  drawFighter(p2, '#ef4444');

  for (const p of particles) {
    ctx.fillStyle = 'rgba(255,200,50,' + (p.life/20) + ')';
    ctx.fillRect(p.x, p.y, 3, 3);
  }

  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText('P1 HP: ' + Math.max(0,p1.hp), 10, 25);
  ctx.fillText('P2 HP: ' + Math.max(0,p2.hp), 680, 25);
  ctx.font = '11px monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText('P1: WASD+F | P2: Arrows+.', 300, 470);
}

function handleInput(event) {
  if (event.type === 'keydown') keys[event.code] = true;
  if (event.type === 'keyup') keys[event.code] = false;
}`,

    roguelike: `// Roguelike Template
let player = { x: 5, y: 5, hp: 20, atk: 3, xp: 0, level: 1 };
let dungeon = [];
let enemies = [];
let items = [];
const W = 20, H = 15, TILE = 32;

function init() {
  dungeon = [];
  for (let y = 0; y < H; y++) {
    dungeon[y] = [];
    for (let x = 0; x < W; x++) {
      dungeon[y][x] = Math.random() < 0.3 ? 1 : 0; // 1=wall
    }
  }
  // Carve paths
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (dungeon[y][x] === 1) continue;
    let adj = 0;
    for (let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const ny=y+dy,nx=x+dx;
      if (ny>=0&&ny<H&&nx>=0&&nx<W&&dungeon[ny][nx]===1) adj++;
    }
    if (adj > 5) dungeon[y][x] = 1;
  }
  dungeon[player.y][player.x] = 0;
  enemies = [];
  items = [];
  for (let i = 0; i < 8; i++) {
    let ex, ey;
    do { ex=Math.floor(Math.random()*W); ey=Math.floor(Math.random()*H); } while(dungeon[ey][ex]!==0);
    enemies.push({ x:ex, y:ey, hp:5+Math.floor(Math.random()*5), atk:2, char:'g' });
  }
  for (let i = 0; i < 4; i++) {
    let ix, iy;
    do { ix=Math.floor(Math.random()*W); iy=Math.floor(Math.random()*H); } while(dungeon[iy][ix]!==0);
    items.push({ x:ix, y:iy, type:'potion' });
  }
}

function movePlayer(dx, dy) {
  const nx = player.x+dx, ny = player.y+dy;
  if (nx<0||nx>=W||ny<0||ny>=H||dungeon[ny][nx]===1) return;
  const e = enemies.find(e=>e.x===nx&&e.y===ny);
  if (e) { e.hp -= player.atk; if(e.hp<=0) { player.xp+=5; enemies=enemies.filter(x=>x!==e); } return; }
  player.x = nx; player.y = ny;
  const item = items.find(i=>i.x===nx&&i.y===ny);
  if (item) { player.hp = Math.min(20, player.hp+5); items=items.filter(x=>x!==item); }
  // Enemy turn
  for (const e2 of enemies) {
    const d = Math.abs(e2.x-player.x)+Math.abs(e2.y-player.y);
    if (d===1) { player.hp -= e2.atk; }
    else if (d < 6) {
      const sdx = Math.sign(player.x-e2.x), sdy = Math.sign(player.y-e2.y);
      if (dungeon[e2.y+sdy]&&dungeon[e2.y+sdy][e2.x+sdx]===0) { e2.x+=sdx; e2.y+=sdy; }
    }
  }
  if (player.hp <= 0) init();
  if (player.xp >= player.level*10) { player.level++; player.atk++; player.xp=0; }
}

function update(dt) {}
function render(ctx) {
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,800,480);
  const ox = player.x*TILE-384, oy = player.y*TILE-208;
  for (let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const sx=x*TILE-ox, sy=y*TILE-oy;
    if (sx<-TILE||sx>800+TILE||sy<-TILE||sy>480+TILE) continue;
    ctx.fillStyle = dungeon[y][x]===1 ? '#444' : '#222';
    ctx.fillRect(sx,sy,TILE-1,TILE-1);
  }
  ctx.fillStyle='#22c55e';
  ctx.fillRect(player.x*TILE-ox+4,player.y*TILE-oy+4,TILE-8,TILE-8);
  ctx.fillStyle='#ef4444';
  for(const e of enemies) ctx.fillRect(e.x*TILE-ox+6,e.y*TILE-oy+6,TILE-12,TILE-12);
  ctx.fillStyle='#ffd700';
  for(const i of items) ctx.fillRect(i.x*TILE-ox+10,i.y*TILE-oy+10,TILE-20,TILE-20);
  ctx.fillStyle='#fff';ctx.font='14px monospace';
  ctx.fillText('HP:'+player.hp+' ATK:'+player.atk+' LVL:'+player.level+' XP:'+player.xp,10,25);
}

function handleInput(event) {
  if (event.type==='keydown') {
    if(event.key==='ArrowUp') movePlayer(0,-1);
    if(event.key==='ArrowDown') movePlayer(0,1);
    if(event.key==='ArrowLeft') movePlayer(-1,0);
    if(event.key==='ArrowRight') movePlayer(1,0);
  }
}`,

    sandbox: `// Sandbox Template (Minecraft-lite)
const TILE = 16;
const W = 50, H = 30;
let world = [];
let cam = { x: 0, y: 0 };
let selectedBlock = 1;
const BLOCKS = ['#8B4513','#228B22','#4682B4','#FFD700','#808080','#FF4500'];
let keys = {};

function init() {
  world = [];
  for (let y = 0; y < H; y++) {
    world[y] = [];
    for (let x = 0; x < W; x++) {
      if (y > H - 4) world[y][x] = 1;
      else if (y === H - 4) world[y][x] = 2;
      else world[y][x] = 0;
    }
  }
}

function update(dt) {
  if (keys['ArrowLeft'] || keys['KeyA']) cam.x -= 3;
  if (keys['ArrowRight'] || keys['KeyD']) cam.x += 3;
  if (keys['ArrowUp'] || keys['KeyW']) cam.y -= 3;
  if (keys['ArrowDown'] || keys['KeyS']) cam.y += 3;
}

function render(ctx) {
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, 800, 480);
  const sx = Math.floor(cam.x/TILE), sy = Math.floor(cam.y/TILE);
  for (let y = sy; y < sy+32; y++) {
    for (let x = sx; x < sx+52; x++) {
      if (y<0||y>=H||x<0||x>=W) continue;
      const px = x*TILE - cam.x, py = y*TILE - cam.y;
      if (world[y][x] > 0) {
        ctx.fillStyle = BLOCKS[world[y][x]-1] || '#fff';
        ctx.fillRect(px, py, TILE-1, TILE-1);
      }
    }
  }
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText('WASD/Arrows=Move | 1-6=Select Block | Click=Place | 0=Erase', 10, 20);
}

function handleInput(event) {
  if (event.type==='keydown') {
    keys[event.code]=true;
    if(event.key>='1'&&event.key<='6') selectedBlock=parseInt(event.key);
    if(event.key==='0') selectedBlock=0;
  }
  if(event.type==='keyup') keys[event.code]=false;
  if(event.type==='click') {
    const rect=event.target.getBoundingClientRect();
    const mx=event.clientX-rect.left+cam.x, my=event.clientY-rect.top+cam.y;
    const wx=Math.floor(mx/TILE), wy=Math.floor(my/TILE);
    if(wy>=0&&wy<H&&wx>=0&&wx<W) world[wy][wx]=selectedBlock;
  }
}`
  };

  function setupGameEngine() {
    const playBtn = $('#gamePlayBtn');
    const pauseBtn = $('#gamePauseBtn');
    const stopBtn = $('#gameStopBtn');
    const templateSelect = $('#gameTemplate');
    const codeEditor = $('#gameCodeEditor');
    const previewCanvas = $('#gamePreviewCanvas');
    const fragShader = $('#gameFragShader');

    if (!playBtn) return;

    playBtn.addEventListener('click', () => runGame());
    pauseBtn.addEventListener('click', () => {
      if (!gameRunning) return;
      gamePaused = !gamePaused;
      pauseBtn.classList.toggle('active', gamePaused);
      if (!gamePaused) { lastTime = performance.now(); loop(lastTime); }
    });
    stopBtn.addEventListener('click', () => stopGame());

    templateSelect.addEventListener('change', () => {
      const t = templateSelect.value;
      if (templates[t]) {
        codeEditor.value = templates[t];
        templateSelect.value = '';
      }
    });

    // Game tabs
    $$('.game-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.game-tab').forEach(t => t.classList.remove('active'));
        $$('.game-tab-content').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById('gtab-' + tab.dataset.gtab);
        if (panel) panel.classList.add('active');
      });
    });

    // Tab support in code editor
    codeEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = codeEditor.selectionStart;
        codeEditor.value = codeEditor.value.substring(0, s) + '  ' + codeEditor.value.substring(codeEditor.selectionEnd);
        codeEditor.selectionStart = codeEditor.selectionEnd = s + 2;
      }
    });

    // New Game button
    const newGameBtn = $('#newGameBtn');
    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => {
        stopGame();
        codeEditor.value = templates.platformer;
        fragShader.value = `// Fragment shader (GLSL)\nprecision mediump float;\nuniform float u_time;\nuniform vec2 u_resolution;\nvoid main() {\n  vec2 uv = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(uv, sin(u_time)*0.5+0.5, 1.0);\n}`;
      });
    }
  }

  function runGame() {
    stopGame();
    const code = $('#gameCodeEditor').value;
    const canvas = $('#gamePreviewCanvas');
    if (!canvas) return;
    gameCtx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 480;

    // Switch to visual tab
    $$('.game-tab').forEach(t => t.classList.remove('active'));
    $$('.game-tab-content').forEach(p => p.classList.remove('active'));
    const visTab = document.querySelector('[data-gtab="visual"]');
    const visPanel = document.getElementById('gtab-visual');
    if (visTab) visTab.classList.add('active');
    if (visPanel) visPanel.classList.add('active');

    try {
      const wrapped = `(function(ctx, canvas) {
        ${code}
        const __game = { init, update, render, handleInput };
        return __game;
      })(gameCtx, gameCanvas)`;
      const gameObj = new Function('gameCtx', 'gameCanvas', `
        ${code}
        return { init, update, render, handleInput };
      `)(gameCtx, canvas);

      window._gameObj = gameObj;
      if (gameObj.init) gameObj.init();

      // Input handlers
      window._gameKeyDown = (e) => {
        if (gameObj.handleInput) gameObj.handleInput(e);
      };
      window._gameKeyUp = (e) => {
        if (gameObj.handleInput) gameObj.handleInput(e);
      };
      window._gameClick = (e) => {
        if (gameObj.handleInput) gameObj.handleInput(e);
      };
      document.addEventListener('keydown', window._gameKeyDown);
      document.addEventListener('keyup', window._gameKeyUp);
      canvas.addEventListener('click', window._gameClick);

      gameRunning = true;
      gamePaused = false;
      lastTime = performance.now();
      loop(lastTime);
    } catch (e) {
      gameCtx.fillStyle = '#ef4444';
      gameCtx.font = '14px monospace';
      gameCtx.fillText('Error: ' + e.message, 20, 30);
    }
  }

  function loop(time) {
    if (!gameRunning || gamePaused) return;
    const dt = (time - lastTime) / 1000;
    lastTime = time;
    const gameObj = window._gameObj;
    if (gameObj) {
      if (gameObj.update) gameObj.update(dt);
      if (gameObj.render) gameObj.render(gameCtx);
    }
    animFrame = requestAnimationFrame(loop);
  }

  function stopGame() {
    gameRunning = false;
    gamePaused = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (window._gameKeyDown) document.removeEventListener('keydown', window._gameKeyDown);
    if (window._gameKeyUp) document.removeEventListener('keyup', window._gameKeyUp);
    const canvas = $('#gamePreviewCanvas');
    if (canvas && window._gameClick) canvas.removeEventListener('click', window._gameClick);
    window._gameObj = null;
  }

  document.addEventListener('DOMContentLoaded', setupGameEngine);
})();
