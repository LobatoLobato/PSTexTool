export const truncatePath = (path: string, max_length: number) => {
  if (path.length <= max_length) return path;
  const firsthalf = path.slice(0, max_length / 2);
  const secondhalf = path.slice((max_length / 2) + (path.length - max_length), path.length);

  return firsthalf + "..." + secondhalf
}