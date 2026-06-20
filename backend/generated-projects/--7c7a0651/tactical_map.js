```javascript
/**
 * @fileoverview This file handles the tactical map functionality for the SovietBioForcesAltHistory game.
 * It includes rendering the map, handling unit placement, movement, and combat interactions.
 * The map is a grid-based representation of the game world.
 */

// --- Constants ---
const MAP_WIDTH = 50; // Width of the tactical map in grid units
const MAP_HEIGHT = 50; // Height of the tactical map in grid units
const TILE_SIZE = 32; // Size of each tile in pixels
const TERRAIN_TYPES = {
  PLAINS: 0,
  FOREST: 1,
  HILLS: 2,
  RIVER: 3,
  SWAMP: 4,
};

// --- Game State ---
let mapData = []; // 2D array representing the map tiles and their terrain
let units = []; // Array of unit objects
let selectedUnit = null; // The currently selected unit for actions
let turn = 0; // Current game turn
let currentPlayer = 0; // Index of the current player

// --- DOM Elements ---
const mapCanvas = document.getElementById('tacticalMapCanvas');
const ctx = mapCanvas.getContext('2d');
const unitInfoDiv = document.getElementById('unitInfo');
const turnDisplay = document.getElementById('turnDisplay');
const playerDisplay = document.getElementById('playerDisplay');

// --- Initialization ---
function initializeMap() {
  // Generate procedural terrain or load from a file
  for (let y = 0; y < MAP_HEIGHT; y++) {
    mapData[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Simple procedural generation for demonstration
      let terrain = TERRAIN_TYPES.PLAINS;
      const rand = Math.random();
      if (rand < 0.1) terrain = TERRAIN_TYPES.FOREST;
      else if (rand < 0.2) terrain = TERRAIN_TYPES.HILLS;
      else if (rand < 0.25) terrain = TERRAIN_TYPES.RIVER;
      else if (rand < 0.3) terrain = TERRAIN_TYPES.SWAMP;
      mapData[y][x] = terrain;
    }
  }

  // Load units (example)
  units = [
    { id: 1, type: 'Infantry', player: 0, x: 5, y: 5, hp: 100, maxHp: 100, movement: 3, attack: 10, defense: 5, terrain_bonus: { [TERRAIN_TYPES.FOREST]: 2 } },
    { id: 2, type: 'Tank', player: 0, x: 7, y: 5, hp: 150, maxHp: 150, movement: 2, attack: 25, defense: 10, terrain_bonus: { [TERRAIN_TYPES.HILLS]: 1 } },
    { id: 3, type: 'Infantry', player: 1, x: MAP_WIDTH - 6, y: MAP_HEIGHT - 6, hp: 100, maxHp: 100, movement: 3, attack: 10, defense: 5, terrain_bonus: { [TERRAIN_TYPES.FOREST]: 2 } },
    { id: 4, type: 'Tank', player: 1, x: MAP_WIDTH - 8, y: MAP_HEIGHT - 6, hp: 150, maxHp: 150, movement: 2, attack: 25, defense: 10, terrain_bonus: { [TERRAIN_TYPES.HILLS]: 1 } },
  ];

  // Set canvas size
  mapCanvas.width = MAP_WIDTH * TILE_SIZE;
  mapCanvas.height = MAP_HEIGHT * TILE_SIZE;

  // Add event listeners
  mapCanvas.addEventListener('click', handleMapClick);
}

// --- Rendering ---
function renderMap() {
  ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

  // Draw terrain
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      ctx.fillStyle = getTerrainColor(mapData[y][x]);
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // Draw movement range if a unit is selected
  if (selectedUnit) {
    drawMovementRange(selectedUnit);
  }

  // Draw units
  units.forEach(unit => {
    drawUnit(unit);
  });

  // Update UI
  updateUI();
}

function getTerrainColor(terrainType) {
  switch (terrainType) {
    case TERRAIN_TYPES.PLAINS: return '#90EE90'; // Light green
    case TERRAIN_TYPES.FOREST: return '#228B22'; // Forest green
    case TERRAIN_TYPES.HILLS: return '#8B4513'; // Brown
    case TERRAIN_TYPES.RIVER: return '#ADD8E6'; // Light blue
    case TERRAIN_TYPES.SWAMP: return '#7FFF00'; // Chartreuse
    default: return '#ccc'; // Gray
  }
}

function drawUnit(unit) {
  ctx.fillStyle = unit.player === 0 ? 'blue' : 'red';
  ctx.beginPath();
  ctx.arc(
    unit.x * TILE_SIZE + TILE_SIZE / 2,
    unit.y * TILE_SIZE + TILE_SIZE / 2,
    TILE_SIZE / 3,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Draw unit HP
  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${unit.hp}/${unit.maxHp}`,
    unit.x * TILE_SIZE + TILE_SIZE / 2,
    unit.y * TILE_SIZE + TILE_SIZE / 2 + 5
  );

  // Highlight selected unit
  if (selectedUnit && selectedUnit.id === unit.id) {
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 3;
    ctx.strokeRect(
      unit.x * TILE_SIZE,
      unit.y * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    );
    ctx.lineWidth = 1; // Reset line width
  }
}

function drawMovementRange(unit) {
  const visited = new Set();
  const queue = [{ x: unit.x, y: unit.y, movesLeft: unit.movement }];

  while (queue.length > 0) {
    const { x, y, movesLeft } = queue.shift();
    const key = `${x},${y}`;

    if (visited.has(key) || movesLeft < 0) continue;
    visited.add(key);

    // Draw highlight for reachable tile
    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Semi-transparent yellow
    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    // Explore neighbors
    const neighbors = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ];

    for (const { dx, dy } of neighbors) {
      const nextX = x + dx;
      const nextY = y + dy;

      if (nextX >= 0 && nextX < MAP_WIDTH && nextY >= 0 && nextY < MAP_HEIGHT) {
        const terrain = mapData[nextY][nextX];
        let cost = 1; // Default movement cost
        if (terrain === TERRAIN_TYPES.FOREST || terrain === TERRAIN_TYPES.SWAMP) cost = 2;
        if (terrain === TERRAIN_TYPES.RIVER) cost = 3; // Rivers are difficult to cross

        queue.push({ x: nextX, y: nextY, movesLeft: movesLeft - cost });
      }
    }
  }
}

function updateUI() {
  turnDisplay.textContent = `Turn: ${turn}`;
  playerDisplay.textContent = `Player: ${currentPlayer === 0 ? 'Soviet' : 'Chechen'}`;

  if (selectedUnit) {
    unitInfoDiv.innerHTML = `
      <h3>${selectedUnit.type}</h3>
      <p>HP: ${selectedUnit.hp}/${selectedUnit.maxHp}</p>
      <p>Movement: ${selectedUnit.movement}</p>
      <p>Attack: ${selectedUnit.attack}</p>
      <p>Defense: ${selectedUnit.defense}</p>
      <p>Position: (${selectedUnit.x}, ${selectedUnit.y})</p>
    `;
  } else {
    unitInfoDiv.innerHTML = '<p>Select a unit to see its info.</p>';
  }
}

// --- Event Handlers ---
function handleMapClick(event) {
  const rect = mapCanvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
  const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);

  // Check if clicking on a unit
  const clickedUnit = units.find(unit => unit.x === x && unit.y === y);

  if (clickedUnit) {
    // If the clicked unit belongs to the current player, select it
    if (clickedUnit.player === currentPlayer) {
      selectedUnit = clickedUnit;
    } else {
      // If it's an enemy unit, attempt to attack
      if (selectedUnit && isAdjacent(selectedUnit, clickedUnit)) {
        attackUnit(selectedUnit, clickedUnit);
        // After attacking, end the turn (or allow further actions depending on game rules)
        endTurn();
      } else {
        // If not adjacent or no unit selected, deselect or show message
        selectedUnit = null;
        alert("You can only attack adjacent enemy units.");
      }
    }
  } else {
    // If clicking on an empty tile
    if (selectedUnit) {
      // Try to move the selected unit
      const terrain = mapData[y][x];
      const movementCost = getMovementCost(selectedUnit, x, y);

      if (movementCost !== Infinity && selectedUnit.movement >= movementCost) {
        // Check if the target tile is within movement range (this check is simplified, a proper pathfinding would be better)
        // For now, we rely on the visual range indicator and assume a valid move if within range.
        // A more robust solution would involve A* pathfinding.
        moveUnit(selectedUnit, x, y, movementCost);
        // After moving, deselect the unit or allow further actions
        // selectedUnit = null; // Uncomment to deselect after move
      } else {
        // If move is invalid or too far
        // selectedUnit = null; // Uncomment to deselect if move is invalid
        console.log("Invalid move or out of range.");
      }
    } else {
      // Deselect if clicking on empty tile with no unit selected
      selectedUnit = null;
    }
  }

  renderMap();
}

function isAdjacent(unit1, unit2) {
  const dx = Math.abs(unit1.x - unit2.x);
  const dy = Math.abs(unit1.y - unit2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function getMovementCost(unit, targetX, targetY) {
  const terrain = mapData[targetY][targetX];
  let cost = 1;
  switch (terrain) {
    case TERRAIN_TYPES.FOREST: cost = 2; break;
    case TERRAIN_TYPES.HILLS: cost = 2; break;
    case TERRAIN_TYPES.RIVER: cost = 3; break;
    case TERRAIN_TYPES.SWAMP: cost = 2; break;
    default: cost = 1; // Plains
  }

  // Add terrain specific bonuses/penalties for the unit
  if (unit.terrain_bonus && unit.terrain_bonus[terrain] !== undefined) {
    cost += unit.terrain_bonus[terrain];
  }

  // Check if the target tile is occupied by a friendly unit
  const occupiedByAlly = units.some(u => u.x === targetX && u.y === targetY && u.player === unit.player);
  if (occupiedByAlly) {
    return Infinity; // Cannot move onto a tile occupied by an ally
  }

  return cost;
}


function moveUnit(unit, targetX, targetY, cost) {
  // Subtract movement cost
  unit.movement -= cost;

  // Update unit position
  unit.x = targetX;
  unit.y = targetY;

  // Reset selected unit after move if desired
  // selectedUnit = null;
}

function attackUnit(attacker, defender) {
  // Calculate damage (simplified example)
  const terrainDefenseBonus = getTerrainDefenseBonus(defender);
  const totalDefense = defender.defense + terrainDefenseBonus;
  const damage = Math.max(0, attacker.attack - totalDefense);

  defender.hp -= damage;
  console.log(`${attacker.type} attacked ${defender.type} for ${damage} damage.`);

  if (defender.hp <= 0) {
    console.log(`${defender.type} was destroyed!`);
    units = units.filter(u => u.id !== defender.id); // Remove destroyed unit
  }

  // Reset attacker's movement after attacking
  attacker.movement = 0; // Or some other logic for post-attack movement
}

function getTerrainDefenseBonus(unit) {
  const terrain = mapData[unit.y][unit.x];
  if (unit.terrain_bonus && unit.terrain_bonus[terrain] !== undefined) {
    return unit.terrain_bonus[terrain];
  }
  return 0;
}

// --- Game Flow ---
function nextTurn() {
  turn++;
  currentPlayer = (currentPlayer + 1) % 2; // Switch to the next player

  // Reset unit movement for the new turn
  units.forEach(unit => {
    if (unit.player === currentPlayer) {
      unit.movement = getUnitMaxMovement(unit); // Reset to max movement
    }
  });

  selectedUnit = null; // Deselect any unit
  renderMap();
}

function getUnitMaxMovement(unit) {
  // This function should return the base max movement of a unit type
  // For now, we'll just return its current maxHp as a placeholder
  // In a real game, you'd have a lookup table for unit types.
  switch(unit.type) {
    case 'Infantry': return 3;
    case 'Tank': return 2;
    default: return 1;
  }
}

function endTurn() {
  // Perform any end-of-turn logic (e.g., resource generation, status effects)
  console.log(`Ending turn ${turn} for Player ${currentPlayer}.`);
  nextTurn();
}

// --- Game Start ---
initializeMap();
renderMap();

// Example of how to bind next turn button
document.getElementById('nextTurnButton').addEventListener('click', endTurn);


// --- Essay Section ---
// The following is a placeholder for the essay content requested in the prompt.
// In a real application, this would likely be loaded from a separate file or a CMS.

const essayContent = `
## Развитие Войск Специального Назначения в Сердце СССР: Война с Чеченской и Стрелковой Угрозой

Советский Союз, могучая держава, всегда уделял особое внимание развитию своих вооруженных сил. В условиях постоянно меняющейся геополитической обстановки и появления новых угроз, особую актуальность приобрело формирование и совершенствование войск специального назначения. В альтернативной истории, где внутренние и внешние вызовы приняли специфические формы, развитие этих элитных подразделений в СССР приобретает уникальный характер, особенно в контексте борьбы с гипотетическими "чеченской" и "стрелковой" угрозами.

Под "чеченской угрозой" в данном контексте мы можем подразумевать не только этнический аспект, но и некую собирательную силу, олицетворяющую децентрализованное, партизанское сопротивление, основанное на глубоком знании местности и высокой мотивации. Такая угроза требовала от советских спецподразделений адаптации к асимметричным методам ведения войны. Развитие происходило по нескольким ключевым направлениям:

1.  **Малая мобильность и скрытность:** В отличие от традиционных армейских подразделений, ориентированных на фронтальные столкновения, спецназ должен был действовать малыми группами, незаметно проникая в тыл противника. Это стимулировало разработку легкого, но мощного вооружения, средств маскировки, бес