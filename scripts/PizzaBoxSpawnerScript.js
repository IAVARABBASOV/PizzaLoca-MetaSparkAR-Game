const Scene = require('Scene');
const Blocks = require('Blocks');
const Time = require('Time');
const Reactive = require('Reactive');
const Patches = require('Patches');
const Random = require('Random');
const Haptic = require('HapticFeedback');

let player = null;
let isSpawnerWorking = false;
let isSpawnerStoped = false;
let spawnSubs = null;
let score = 0;
let highScore = 0;
let spawnDelay = 1000;
let minSpawnDelay = 200;
let spawnDelayDecreamentAmount = 50;

const trigger_onCollected = 'onCollected';
const trigger_onGameOver = 'onGameOver';
const trigger_onReload = 'onReload';
const trigger_playAnim = 'playAnim_';
const trigger_randomChance = 'randomChance';

(async function () {

  for (let index = 1; index <= 3; index++) {
    const animPulse = trigger_playAnim + index;

    Patches.inputs.setPulse(animPulse, Reactive.once());
  }

  // Locate the focal distance object in the scene
  const spawnedObjectsParent = await Scene.root.findFirst("spawnedObjects");

  // Dynamically locate the spawn points
  const [pl, spawnPoint1, spawnPoint2, spawnPoint3] = await Promise.all([
    Scene.root.findFirst('playerCollider'),
    Scene.root.findFirst('spawnPoint_1'),
    Scene.root.findFirst('spawnPoint_2'),
    Scene.root.findFirst('spawnPoint_3'),
  ]);

  player = pl;

  const spawnPoints = [spawnPoint1, spawnPoint2, spawnPoint3];

  (await Patches.outputs.getPulse('startSpawner')).subscribe(() => {
    if (!isSpawnerWorking && !isSpawnerStoped) {
      spawnDelay = 1000;
      isSpawnerWorking = true;
      isSpawnerStoped = false;

      // Start the game with spawning pizza boxes
      startSpawningPizzaBoxes(spawnedObjectsParent, spawnPoints);
    }
  });

  (await Patches.outputs.getPulse('stopSpawner')).subscribe(() => {
    if (!isSpawnerStoped) {
      spawnDelay = 1000;
      isSpawnerStoped = true;
      isSpawnerWorking = false;

      // Start the game with spawning pizza boxes
      stopSpawningPizzaBoxes();
    }
  });

  (await Patches.outputs.getPulse('reloadGame')).subscribe(() => {
    score = 0;
    Patches.inputs.setPulse(trigger_onReload, Reactive.once());
    Patches.inputs.setScalar(trigger_onCollected, score);
    isSpawnerWorking = false;
    isSpawnerStoped = false;
  });
})();

async function spawnPizzaBox(focalPoint, delay, spawnPoint, index) {

  let randomItemName = await getRandomItemName();

  const itemBoxBlock = await Blocks.instantiate("pizzaBoxBlock", { "name": randomItemName, "hidden": false });

  spawnWithDelay(itemBoxBlock, delay, spawnPoint, focalPoint, index, () => {
    Time.setTimeout(() => {

      spawnItemHandle(itemBoxBlock);

    }, 1);
  });
}

function spawnItemHandle(itemBoxBlock) {

  const startPosition = Reactive.vector(
    itemBoxBlock.transform.position.x.pinLastValue(),
    itemBoxBlock.transform.position.y.pinLastValue(),
    itemBoxBlock.transform.position.z.pinLastValue());

  if (itemBoxBlock.name == "Trash") {
    itemBoxBlock.inputs.setPulse('enableTrash', Reactive.once());
  } else {
    itemBoxBlock.inputs.setPulse('enablePizza', Reactive.once());
  }
  itemBoxBlock.inputs.setVector('startPosition', startPosition);

  const outputs = itemBoxBlock.outputs;

  if (outputs) {

    outputs.getVector('position').then((pos) => {
      itemBoxBlock.transform.position = pos;
      collisionHandler(itemBoxBlock, player);
    });

    outputs.getPulseOrFallback('onCollected').subscribe(() => {
      if (isSpawnerWorking) {
        score++;

        if (score > highScore) highScore = score;

        Patches.inputs.setScalar(trigger_onCollected, score);
        Patches.inputs.setScalar('onHighScore', highScore);
        vibrateOnCollect();
      }
    });

    outputs.getPulseOrFallback('onTrash').subscribe(() => {
      if (isSpawnerWorking) {
        Patches.inputs.setPulse(trigger_onGameOver, Reactive.once());
        vibrateOnGameOver();
      }
    });

    outputs.getPulseOrFallback('destroyMe').subscribe(() => {
      Scene.destroy(itemBoxBlock);
    });

  }

  return itemBoxBlock;
}

function vibrateOnCollect() {
  setTimeout(() => {

    let pattern = {
      vibrationPattern: [
        { durationMilliseconds: 3, amplitudeNormalized: 1 }]
    };
    Haptic.vibrate(pattern);

  }, 100);
}

function vibrateOnGameOver() {
  let pattern = {
    vibrationPattern: [
      { durationMilliseconds: 400, amplitudeNormalized: 1 }]
  };

  Haptic.vibrate(pattern);
}

const overlapX = Reactive.val(0.06);
const overlapY = Reactive.val(0.06);
const threshold = Reactive.val(0.1);

// Function to check for collisions and handle them
function collisionHandler(item, player) {
  const playerPos = player.worldTransform.position;
  const itemPos = item.worldTransform.position;

  const distanceX = Reactive.abs(playerPos.x.sub(itemPos.x));
  const distanceY = Reactive.abs(playerPos.y.sub(itemPos.y));

  const distanceXWithOverlap = distanceX.add(overlapX);
  const distanceYWithOverlap = distanceY.add(overlapY);

  // Check if the child is colliding with the player
  const isCollidingX = distanceXWithOverlap.lt(threshold);
  const isCollidingY = distanceYWithOverlap.lt(threshold);

  const isCollided = isCollidingX.and(isCollidingY);

  if (item.name == "Trash") {
    item.inputs.setBoolean('isTrashed', isCollided);
  } else {
    item.inputs.setBoolean('isCollected', isCollided);
  }
}

async function getRandomItemName() {
  const randomChance = await Patches.outputs.getScalarSync(trigger_randomChance);
  let randomName = Random.random() <= randomChance ? "PizzaBoxInstance" : "Trash";

  return await randomName;
}

// Function to add the pizzaBoxBlock to the scene with delay
function spawnWithDelay(block, delay, spawnPoint, focalPoint, pointIndex, action) {
  Time.setTimeout(() => {

    if (isSpawnerWorking) {

      focalPoint.addChild(block);
      block.transform.position = spawnPoint.transform.position;

      let animIndex = pointIndex + 1;
      const animPulse = trigger_playAnim + animIndex;

      Patches.inputs.setPulse(animPulse, Reactive.once());

      action();
    }
  }, delay);
}

// Utility function to get a random spawn point
function getRandomSpawnPoint(spawnPoints) {
  const randomIndex = Math.floor(Math.random() * spawnPoints.length);
  return [spawnPoints[randomIndex], randomIndex];
}

// Function to start spawning pizza boxes during game time
function startSpawningPizzaBoxes(focalPoint, spawnPoints) {

  function spawn() {
    const delay = Math.random() * spawnDelay + 300; // Random delay between 500ms and 2500ms
    const spawnPoint = getRandomSpawnPoint(spawnPoints);
    spawnPizzaBox(focalPoint, delay, spawnPoint[0], spawnPoint[1]);
    spawnSubs = Time.setTimeout(spawn, delay); // Schedule next spawn

    if (spawnDelay > minSpawnDelay) {
      spawnDelay -= spawnDelayDecreamentAmount;
      if (spawnDelay < minSpawnDelay) spawnDelay = minSpawnDelay;
    }
  }

  if (isSpawnerWorking) {
    spawn(); // Start the spawning loop
  }
}

function stopSpawningPizzaBoxes() {
  Time.clearTimeout(spawnSubs);
}