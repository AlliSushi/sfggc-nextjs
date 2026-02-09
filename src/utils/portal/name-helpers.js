/**
 * Shared utilities for building participant names consistently across the application.
 */

/**
 * Build a full name from first and last name.
 * Uses the person's legal first name and last name.
 *
 * @param {Object} person - Person object with first_name and last_name
 * @returns {string} Full name (e.g., "John Smith")
 */
export const buildFullName = (person) =>
  `${person.first_name || ""} ${person.last_name || ""}`.trim();

/**
 * Build a display name using nickname (if available) or first name.
 * Prefers nickname for informal contexts (team rosters, etc).
 *
 * @param {Object} person - Person object with nickname, first_name, and last_name
 * @returns {string} Display name (e.g., "Johnny Smith" or "John Smith")
 */
export const buildDisplayName = (person) =>
  `${person.nickname || person.first_name || ""} ${person.last_name || ""}`.trim();
