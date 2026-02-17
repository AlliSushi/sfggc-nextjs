import {
  getOptionalEventsVisibleToParticipants,
  setOptionalEventsVisibleToParticipants,
} from "../../../../../utils/portal/portal-settings-db.js";
import { createVisibilityToggleHandler } from "../../../../../utils/portal/visibility-toggle-route.js";

export default createVisibilityToggleHandler({
  valueKey: "participantsCanViewOptionalEvents",
  getVisibility: getOptionalEventsVisibleToParticipants,
  setVisibility: setOptionalEventsVisibleToParticipants,
  action: "set_optional_events_visibility",
});

