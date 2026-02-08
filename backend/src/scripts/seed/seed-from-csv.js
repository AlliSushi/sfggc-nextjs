import { getAllParticipants } from "../../data/sampleData.js";

const seedFromCsv = () => {
  const participants = getAllParticipants();
  return {
    participantsCount: participants.length,
  };
};

export { seedFromCsv };
