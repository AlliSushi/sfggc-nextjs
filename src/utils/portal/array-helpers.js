/**
 * Removes null and undefined values from an array.
 *
 * @param {Array} arr - The array to filter.
 * @returns {Array} A new array with null and undefined values removed.
 */
const filterNonNull = (arr) => arr.filter((v) => v !== null && v !== undefined);

export { filterNonNull };
