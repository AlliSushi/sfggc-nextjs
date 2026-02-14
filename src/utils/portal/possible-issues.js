const MAX_ISSUE_DETAILS = 12;
const ADMIN_EXCLUSION_SQL = "a.pid is null";
const NON_EMPTY_LANE_SQL = "s.lane is not null and trim(s.lane) <> ''";

const formatParticipantDisplayName = (row) =>
  `${row?.first_name || ""} ${row?.last_name || ""}`.trim() || row?.pid || "Unknown";

const parseParticipantList = (rawList) =>
  String(rawList || "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const [pidPart, ...nameParts] = value.split(":");
      return {
        pid: (pidPart || "").trim(),
        name: nameParts.join(":").trim() || (pidPart || "").trim(),
      };
    })
    .filter((entry) => entry.pid);

const shouldShowPossibleIssuesSection = ({
  totalParticipants = 0,
} = {}) => {
  return totalParticipants > 0;
};

const buildPossibleIssuesFromRows = ({
  noTeamNoLaneNoPartner = [],
  partnerTargetMultipleOwners = [],
  participantWithMultiplePartners = [],
  nonReciprocalPartnerRows = [],
  laneButNoTeam = [],
} = {}) => {
  const issues = [];

  if (noTeamNoLaneNoPartner.length > 0) {
    issues.push({
      key: "no-team-no-lane-no-partner",
      title: "Participants with no team, no lane assignments, and no doubles partner",
      count: noTeamNoLaneNoPartner.length,
      details: toDetails(noTeamNoLaneNoPartner, () => "Missing team, lanes, and doubles partner"),
    });
  }

  if (partnerTargetMultipleOwners.length > 0) {
    const details = toDetails(
      partnerTargetMultipleOwners,
      (row) => `Referenced by ${row.affected_count} participants`
    ).map((detailRow, index) => ({
      ...detailRow,
      relatedParticipants: parseParticipantList(partnerTargetMultipleOwners[index]?.affected_participants),
    }));
    issues.push({
      key: "partner-target-multiple-owners",
      title: "Participants listed as doubles partner for multiple people",
      count: partnerTargetMultipleOwners.length,
      details,
    });
  }

  if (participantWithMultiplePartners.length > 0) {
    const details = toDetails(
      participantWithMultiplePartners,
      (row) => `Has ${row.affected_count} partners`
    ).map((detailRow, index) => ({
      ...detailRow,
      relatedParticipants: parseParticipantList(participantWithMultiplePartners[index]?.partner_list),
    }));
    issues.push({
      key: "participant-with-multiple-partners",
      title: "Participants assigned to multiple doubles partners",
      count: participantWithMultiplePartners.length,
      details,
    });
  }

  if (nonReciprocalPartnerRows.length > 0) {
    const details = toDetails(
      nonReciprocalPartnerRows,
      (row) =>
        row.partner_pid
          ? `Points to ${row.partner_name || "unknown"} (${row.partner_pid}) but reverse mapping is missing`
          : "Missing partner PID in doubles pair mapping"
    ).map((detailRow, index) => ({
      ...detailRow,
      relatedParticipants: nonReciprocalPartnerRows[index]?.partner_pid
        ? [
            {
              pid: String(nonReciprocalPartnerRows[index].partner_pid),
              name: nonReciprocalPartnerRows[index].partner_name || nonReciprocalPartnerRows[index].partner_pid,
            },
          ]
        : [],
    }));
    issues.push({
      key: "non-reciprocal-doubles-partners",
      title: "Non-reciprocal doubles partner mappings",
      count: nonReciprocalPartnerRows.length,
      details,
    });
  }

  if (laneButNoTeam.length > 0) {
    issues.push({
      key: "lane-without-team",
      title: "Participants with lane assignments but no team",
      count: laneButNoTeam.length,
      details: toDetails(
        laneButNoTeam,
        (row) => `Assigned lanes: ${row.lanes || "unknown"}`
      ),
    });
  }

  return issues;
};

const toDetails = (rows = [], detailFormatter = null, limit = MAX_ISSUE_DETAILS) =>
  rows.slice(0, limit).map((row) => ({
    pid: String(row?.pid || ""),
    name: formatParticipantDisplayName(row),
    detail: detailFormatter ? detailFormatter(row) : "",
  }));

const countValue = (rows = []) => Number(rows?.[0]?.count || 0);

const fetchCoverage = async (queryFn) => {
  const { rows: totalRows } = await queryFn(
    `
    select count(*) as count
    from people p
    left join admins a on a.pid = p.pid
    where ${ADMIN_EXCLUSION_SQL}
    `
  );
  const { rows: withLaneRows } = await queryFn(
    `
    select count(distinct s.pid) as count
    from scores s
    inner join people p on p.pid = s.pid
    left join admins a on a.pid = p.pid
    where ${ADMIN_EXCLUSION_SQL}
      and ${NON_EMPTY_LANE_SQL}
    `
  );
  return {
    totalParticipants: countValue(totalRows),
    participantsWithLane: countValue(withLaneRows),
  };
};

const fetchNoTeamNoLaneNoPartner = async (queryFn) => {
  const { rows } = await queryFn(
    `
    select p.pid, p.first_name, p.last_name
    from people p
    left join admins a on a.pid = p.pid
    left join scores s on s.pid = p.pid and ${NON_EMPTY_LANE_SQL}
    left join doubles_pairs dp_self on dp_self.pid = p.pid and dp_self.partner_pid is not null
    left join doubles_pairs dp_partner on dp_partner.partner_pid = p.pid
    where ${ADMIN_EXCLUSION_SQL}
      and (p.tnmt_id is null or trim(p.tnmt_id) = '')
      and s.pid is null
      and dp_self.pid is null
      and dp_partner.pid is null
    order by p.last_name, p.first_name
    `
  );
  return rows;
};

const fetchPartnerTargetMultipleOwners = async (queryFn) => {
  const { rows } = await queryFn(
    `
    select
      dp.partner_pid as pid,
      pp.first_name,
      pp.last_name,
      count(distinct dp.pid) as affected_count,
      group_concat(distinct concat(dp.pid, ':', p.first_name, ' ', p.last_name)
        order by p.last_name, p.first_name separator ' | ') as affected_participants
    from doubles_pairs dp
    left join people pp on pp.pid = dp.partner_pid
    left join people p on p.pid = dp.pid
    where dp.partner_pid is not null
    group by dp.partner_pid, pp.first_name, pp.last_name
    having count(distinct dp.pid) > 1
    order by affected_count desc, pp.last_name, pp.first_name
    `
  );
  return rows;
};

const fetchParticipantWithMultiplePartners = async (queryFn) => {
  const { rows } = await queryFn(
    `
    select
      dp.pid,
      p.first_name,
      p.last_name,
      count(distinct dp.partner_pid) as affected_count,
      group_concat(distinct concat(dp.partner_pid, ':', pp.first_name, ' ', pp.last_name)
        order by pp.last_name, pp.first_name separator ' | ') as partner_list
    from doubles_pairs dp
    join people p on p.did = dp.did
    left join people pp on pp.pid = dp.partner_pid
    group by dp.pid, p.first_name, p.last_name
    having count(distinct dp.partner_pid) > 1
    order by affected_count desc, p.last_name, p.first_name
    `
  );
  return rows;
};

const fetchNonReciprocalPartnerRows = async (queryFn) => {
  const { rows } = await queryFn(
    `
    select
      dp.pid,
      p.first_name,
      p.last_name,
      dp.partner_pid,
      concat(pp.first_name, ' ', pp.last_name) as partner_name
    from doubles_pairs dp
    left join doubles_pairs rev
      on rev.pid = dp.partner_pid and rev.partner_pid = dp.pid
    left join people p on p.pid = dp.pid
    left join people pp on pp.pid = dp.partner_pid
    where dp.partner_pid is not null
      and rev.pid is null
    order by p.last_name, p.first_name
    `
  );
  return rows;
};

const fetchLaneButNoTeam = async (queryFn) => {
  const { rows } = await queryFn(
    `
    select
      p.pid,
      p.first_name,
      p.last_name,
      group_concat(distinct concat(s.event_type, ':', s.lane) order by s.event_type separator ', ') as lanes
    from people p
    inner join scores s on s.pid = p.pid and ${NON_EMPTY_LANE_SQL}
    left join admins a on a.pid = p.pid
    where ${ADMIN_EXCLUSION_SQL}
      and (p.tnmt_id is null or trim(p.tnmt_id) = '')
    group by p.pid, p.first_name, p.last_name
    order by p.last_name, p.first_name
    `
  );
  return rows;
};

const buildPossibleIssuesReport = async (queryFn) => {
  const { totalParticipants, participantsWithLane } = await fetchCoverage(queryFn);
  const noTeamNoLaneNoPartner = await fetchNoTeamNoLaneNoPartner(queryFn);
  const partnerTargetMultipleOwners = await fetchPartnerTargetMultipleOwners(queryFn);
  const participantWithMultiplePartners = await fetchParticipantWithMultiplePartners(queryFn);
  const nonReciprocalPartnerRows = await fetchNonReciprocalPartnerRows(queryFn);
  const laneButNoTeam = await fetchLaneButNoTeam(queryFn);

  const issues = buildPossibleIssuesFromRows({
    noTeamNoLaneNoPartner,
    partnerTargetMultipleOwners,
    participantWithMultiplePartners,
    nonReciprocalPartnerRows,
    laneButNoTeam,
  });

  const showSection = shouldShowPossibleIssuesSection({
    totalParticipants,
    participantsWithLane,
  }) && issues.length > 0;

  return {
    showSection,
    coverage: {
      totalParticipants,
      participantsWithLane,
      laneCoveragePct: totalParticipants
        ? Number(((participantsWithLane * 100) / totalParticipants).toFixed(2))
        : 0,
    },
    issues,
  };
};

export {
  parseParticipantList,
  shouldShowPossibleIssuesSection,
  buildPossibleIssuesFromRows,
  buildPossibleIssuesReport,
  MAX_ISSUE_DETAILS,
};
