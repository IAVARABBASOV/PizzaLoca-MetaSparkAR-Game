const Scene = require('Scene');
const FaceTracking = require('FaceTracking');
const Reactive = require('Reactive');
const Patches = require('Patches');

(async function () {
  // Load the required objects
  const [face, player] = await Promise.all([
    FaceTracking.face(0),
    Scene.root.findFirst('player')
  ]);

  // Get the rotation of the face (in radians)
  const headRotationY = face.cameraTransform.rotationY;

  // Define the ranges for the head rotation and player position
  const fromRangeMin = -2; // Adjust these ranges based on actual rotation values
  const fromRangeMax = 2;
  const toRangeMin = -1; // Adjust as necessary for the player position range
  const toRangeMax = 1;

  // Define the limits for the player's X position to stay within screen bounds
  const playerMinX = -0.1; // Adjust this value based on your screen dimensions
  const playerMaxX = 0.1;  // Adjust this value based on your screen dimensions

  // Map the head rotation to the player position X
  const normalizedRotation = Reactive.sub(headRotationY, fromRangeMin)
    .div(Reactive.sub(fromRangeMax, fromRangeMin));
  let playerX = Reactive.add(
    Reactive.mul(normalizedRotation, Reactive.sub(toRangeMax, toRangeMin)),
    toRangeMin
  );

  // Clamp the player's X position within the defined limits
  playerX = Reactive.clamp(playerX, playerMinX, playerMaxX);

  const isPlayerControllable = await Patches.outputs.getBoolean('isPlayerContollable');

  function setPlayerXPos(xPos) {
    player.transform.x = xPos;
  }

  isPlayerControllable.onOn({ fireOnInitialValue: true }).subscribe((event) => {
    setPlayerXPos(playerX);
  });

  isPlayerControllable.onOff().subscribe((event) => {

    let lastPosX = player.transform.x.pinLastValue();

    setPlayerXPos(lastPosX);
  });

})();
