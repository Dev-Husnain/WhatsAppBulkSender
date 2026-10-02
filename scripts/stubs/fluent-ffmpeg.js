// Stand-in for fluent-ffmpeg in the exe. whatsapp-web.js loads it at startup but only
// uses it to turn videos into stickers, which this app never does.
function ffmpeg() {
  throw new Error('Video conversion is not available in this build');
}
ffmpeg.setFfmpegPath = () => {};

module.exports = ffmpeg;
