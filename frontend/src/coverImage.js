// Matches the orbit's book face, so uploaded covers are cropped rather than stretched.
const COVER_WIDTH = 633;
const COVER_HEIGHT = 1000;

export function coverCrop(width, height) {
  const target = COVER_WIDTH / COVER_HEIGHT;
  const cropWidth = Math.min(width, height * target);
  const cropHeight = cropWidth / target;
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
}

export async function prepareCover(file) {
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const context = canvas.getContext('2d');
  // JPEG has no transparency, so transparent areas would otherwise turn black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  const crop = coverCrop(image.width, image.height);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, COVER_WIDTH, COVER_HEIGHT);
  image.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('This image could not be processed. Try another file.');
  return blob;
}
