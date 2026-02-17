import {
  getScratchMastersVisibleToParticipants,
  setScratchMastersVisibleToParticipants,
} from "../../../../../utils/portal/portal-settings-db.js";
import { createVisibilityToggleHandler } from "../../../../../utils/portal/visibility-toggle-route.js";

export default createVisibilityToggleHandler({
  valueKey: "participantsCanViewScratchMasters",
  getVisibility: getScratchMastersVisibleToParticipants,
  setVisibility: setScratchMastersVisibleToParticipants,
  action: "set_scratch_masters_visibility",
});
