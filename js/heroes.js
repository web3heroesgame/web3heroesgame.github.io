// Generated from the game's hero rig. Do not edit by hand.
// Per hero: frame box and feet point (art px), per animation: sheet row, hold of each frame (ms),
// loop, markers (ms from the start).
window.HERO_SPRITES = {
  "knight": {
    "frame": [128, 101],
    "feet": [58, 99],
    "animations": {
      "idle": {"row": 0, "holds": [450, 450, 350, 350], "loop": true, "markers": {}},
      "run": {
        "row": 1,
        "holds": [140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140],
        "loop": true,
        "markers": {}
      },
      "attack": {"row": 2, "holds": [160, 120, 120, 140, 140, 170], "loop": false, "markers": {"hit": 400}},
      "hurt": {"row": 3, "holds": [100, 100, 100], "loop": false, "markers": {}}
    },
    "sheet": [1536, 404]
  },
  "wanderer": {
    "frame": [114, 85],
    "feet": [53, 82],
    "animations": {
      "idle": {"row": 0, "holds": [700, 700], "loop": true, "markers": {}},
      "run": {
        "row": 1,
        "holds": [140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140],
        "loop": true,
        "markers": {}
      },
      "attack": {"row": 2, "holds": [140, 160, 120, 140, 160], "loop": false, "markers": {"hit": 300}},
      "hurt": {"row": 3, "holds": [100, 100, 100], "loop": false, "markers": {}}
    },
    "sheet": [1368, 340]
  },
  "archer": {
    "frame": [99, 85],
    "feet": [53, 84],
    "animations": {
      "idle": {"row": 0, "holds": [700, 700], "loop": true, "markers": {}},
      "run": {
        "row": 1,
        "holds": [140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140],
        "loop": true,
        "markers": {}
      },
      "attack": {"row": 2, "holds": [140, 140, 140, 140, 140, 200], "loop": false, "markers": {"release": 560}},
      "hurt": {"row": 3, "holds": [100, 100, 100], "loop": false, "markers": {}}
    },
    "sheet": [1188, 340]
  },
  "assassin": {
    "frame": [94, 84],
    "feet": [55, 82],
    "animations": {
      "idle": {"row": 0, "holds": [700, 700], "loop": true, "markers": {}},
      "run": {
        "row": 1,
        "holds": [140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140],
        "loop": true,
        "markers": {}
      },
      "attack": {"row": 2, "holds": [140, 160, 120, 140, 160], "loop": false, "markers": {"hit": 300}},
      "hurt": {"row": 3, "holds": [100, 100, 100], "loop": false, "markers": {}}
    },
    "sheet": [1128, 336]
  }
};
