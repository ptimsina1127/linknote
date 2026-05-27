const Jimp = require('jimp');

async function main() {
  const width = 1200;
  const height = 630;

  const image = await Jimp.create(width, height, '#1e40af');

  // Draw a simple darker header accent
  for (let y = 0; y < 6; y++) {
    image.scan(0, y, width, 1, function (x, y, idx) {
      this.bitmap.data[idx + 0] = 30;
      this.bitmap.data[idx + 1] = 58;
      this.bitmap.data[idx + 2] = 138;
      this.bitmap.data[idx + 3] = 255;
    });
  }

  // Load white fonts
  const font128 = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
  const font64 = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

  // Measure "LinkedPad" to center it
  const headingText = 'LinkedPad';
  const headingW = Jimp.measureText(font128, headingText);
  const headingX = (width - headingW) / 2;

  image.print(font128, headingX, 180, headingText);

  // Subtitle
  const subtitleText = 'An Anonymous & Shareable Online Notepad';
  const subtitleW = Jimp.measureText(font64, subtitleText);
  const subtitleX = (width - subtitleW) / 2;
  image.print(font64, subtitleX, 340, subtitleText);

  // URL
  const urlText = 'linkedpad.me';
  const urlW = Jimp.measureText(font32, urlText);
  const urlX = (width - urlW) / 2;
  image.print(font32, urlX, height - 60, urlText);

  await image.writeAsync('public/og-image.png');
  console.log('OG image generated successfully');
}

main().catch(console.error);
