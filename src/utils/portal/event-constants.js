/**
 * Tournament event type constants.
 * These constants are used throughout the application to identify
 * the three main bowling events: team, doubles, and singles.
 */

/**
 * Event type identifiers
 */
export const EVENT_TYPES = {
  TEAM: 'team',
  DOUBLES: 'doubles',
  SINGLES: 'singles',
};

/**
 * Array of all event types in standard order
 * Use this for iteration when processing all events
 */
export const EVENT_TYPE_LIST = [
  EVENT_TYPES.TEAM,
  EVENT_TYPES.DOUBLES,
  EVENT_TYPES.SINGLES,
];

/**
 * Human-readable labels for event types
 * Use these for display in UI components
 */
export const EVENT_LABELS = {
  [EVENT_TYPES.TEAM]: 'Team',
  [EVENT_TYPES.DOUBLES]: 'Doubles',
  [EVENT_TYPES.SINGLES]: 'Singles',
};
