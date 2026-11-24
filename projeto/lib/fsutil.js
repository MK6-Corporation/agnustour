'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Grava JSON de forma atômica (arquivo temporário + fsync + rename). */
async function writeJsonAtomic(file, data) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fh = await fs.promises.open(tmp, 'w', 0o600);
  try {
    await fh.writeFile(JSON.stringify(data, null, 2));
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fs.promises.rename(tmp, file);
}

module.exports = { writeJsonAtomic };
