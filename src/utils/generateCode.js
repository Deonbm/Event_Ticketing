const crypto = require('crypto');

// 32 characters, with the easy-to-confuse ones removed (no 0/O, 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Example result: PI-7K2QX9M4LA3F
// crypto.randomInt is truly random, so codes can't be guessed
exports.generateCode = () => {
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return 'PI-' + code;
};