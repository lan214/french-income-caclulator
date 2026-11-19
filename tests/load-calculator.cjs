const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function loadCalculator() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'calculator.js'), 'utf8');
  return vm.runInNewContext(source + '\nCALC;');
};
