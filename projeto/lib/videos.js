'use strict';
/**
 * Vídeos dos destinos (sem som). Basta colocar o arquivo em public/video/<id-da-viagem>.mp4
 * (H.264, sem áudio) e, opcionalmente, public/video/<id-da-viagem>.jpg como capa.
 * Sem vídeo, o card continua mostrando as fotos.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'video');

function tripVideo(id) {
  const file = path.join(DIR, `${id}.mp4`);
  if (!fs.existsSync(file)) return null;
  const poster = fs.existsSync(path.join(DIR, `${id}.jpg`)) ? `video/${id}.jpg` : null;
  return { src: `video/${id}.mp4`, poster };
}

module.exports = { tripVideo, VIDEO_DIR: DIR };
