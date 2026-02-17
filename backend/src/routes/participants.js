import { getAllParticipants, getParticipantByPid } from "../data/sampleData.js";

const listParticipants = ({ search = "" } = {}) => {
  const participants = getAllParticipants();
  if (!search) {
    return participants;
  }
  const normalized = search.toLowerCase();
  return participants.filter((participant) => {
    const fullName = `${participant.firstName} ${participant.lastName}`.toLowerCase();
    return (
      participant.pid?.includes(normalized) ||
      participant.email?.toLowerCase().includes(normalized) ||
      fullName.includes(normalized)
    );
  });
};

const getParticipant = (pid) => getParticipantByPid(pid);

const updateParticipant = (pid, updates) => {
  return {
    ok: true,
    pid,
    updates,
  };
};

const adminPreviewParticipant = (pid) => {
  return {
    mode: "admin-preview",
    participant: getParticipantByPid(pid),
  };
};

export { listParticipants, getParticipant, updateParticipant, adminPreviewParticipant };
