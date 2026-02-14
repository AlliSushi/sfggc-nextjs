/**
 * Handicap calculation constants per USBC (United States Bowling Congress) rules.
 *
 * The handicap formula is: floor((HANDICAP_BASE_SCORE - bookAverage) * HANDICAP_MULTIPLIER)
 *
 * Example: For a bowler with book average of 180
 *   handicap = floor((225 - 180) * 0.9) = floor(45 * 0.9) = floor(40.5) = 40
 */

// Base score used in handicap calculation (USBC standard)
export const HANDICAP_BASE_SCORE = 225;

// Multiplier applied to the difference between base score and book average
export const HANDICAP_MULTIPLIER = 0.9;

/**
 * Calculate handicap based on book average using USBC formula.
 *
 * @param {number|null|undefined} bookAverage - The bowler's book average
 * @returns {number|null} The calculated handicap, or null if book average is not provided
 */
export const calculateHandicap = (bookAverage) => {
  if (bookAverage === null || bookAverage === undefined) return null;
  return Math.max(
    0,
    Math.floor((HANDICAP_BASE_SCORE - bookAverage) * HANDICAP_MULTIPLIER)
  );
};
