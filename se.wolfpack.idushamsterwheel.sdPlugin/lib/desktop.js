// Linux (OpenDeck) or Windows (Elgato Stream Deck): the same interface, see desktop-linux.js
"use strict";
module.exports = process.platform === "win32" ? require("./desktop-win") : require("./desktop-linux");
