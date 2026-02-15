import {
  getScoresVisibleToParticipants,
  setScoresVisibleToParticipants,
} from "../../../../../utils/portal/portal-settings-db.js";
import { createVisibilityToggleHandler } from "../../../../../utils/portal/visibility-toggle-route.js";

export default createVisibilityToggleHandler({
  valueKey: "participantsCanViewScores",
  getVisibility: getScoresVisibleToParticipants,
  setVisibility: setScoresVisibleToParticipants,
  action: "set_scores_visibility",
});
