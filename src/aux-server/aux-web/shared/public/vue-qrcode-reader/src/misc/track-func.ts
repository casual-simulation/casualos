export function thinSquare({ color }: any) {
  return function(location: any, ctx: any) {
    const {
      topLeftCorner,
      topRightCorner,
      bottomLeftCorner,
      bottomRightCorner
    } = location;

    ctx.strokeStyle = color;

    ctx.beginPath();
    ctx.moveTo(topLeftCorner.x, topLeftCorner.y);
    ctx.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
    ctx.lineTo(bottomRightCorner.x, bottomRightCorner.y);
    ctx.lineTo(topRightCorner.x, topRightCorner.y);
    ctx.lineTo(topLeftCorner.x, topLeftCorner.y);
    ctx.closePath();

    ctx.stroke();
  };
}
