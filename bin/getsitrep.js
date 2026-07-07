#!/usr/bin/env node

require('../src/cli').run(process.argv.slice(2)).catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
