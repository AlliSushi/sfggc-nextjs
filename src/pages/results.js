import { useEffect, useState } from "react";
import RootLayout from "../components/layout/layout";
import Results from "../components/Results/Results";
import ScrMstWinners from "../components/ScrMstWinners/ScrMstWinners";

const ResultsPage = () => {
  const [showStandingsLink, setShowStandingsLink] = useState(false);
  const [showOptionalEventsLink, setShowOptionalEventsLink] = useState(false);

  useEffect(() => {
    fetch("/api/portal/admin/scores/visibility")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.participantsCanViewScores) setShowStandingsLink(true);
      })
      .catch(() => {});
    fetch("/api/portal/admin/optional-events/visibility")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.participantsCanViewOptionalEvents) setShowOptionalEventsLink(true);
      })
      .catch(() => {});
  }, []);

  return (
    <div>

      <Results
        showStandingsLink={showStandingsLink}
        showOptionalEventsLink={showOptionalEventsLink}
      />
      <ScrMstWinners/>

    </div>
  )
}

ResultsPage.getLayout = function getLayout(page) {
  return (
    <RootLayout>
      {page}
    </RootLayout>
  );
}

export default ResultsPage;
