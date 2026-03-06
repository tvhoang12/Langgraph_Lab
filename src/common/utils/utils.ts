export const calculateDateDiff = (dateStart: Date, dateEnd: Date): number => {
  const diffTime = Math.abs(dateEnd.getTime() - dateStart.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const reduceNumber = (
  num: number,
  exceptValues: number[] = [11, 22, 33],
  maxVal: number = 10
): number => {
  if (!maxVal || num < maxVal || exceptValues.includes(num)) {
    return num;
  }

  let digit = num;
  num = 0;
  while (digit !== 0) {
    num += digit % 10;
    digit = Math.floor(digit / 10);
  }

  return reduceNumber(num, exceptValues);
};
