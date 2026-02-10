import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import PortalModal from "../../../components/Portal/PortalModal/PortalModal";
import ParticipantProfile from "../../../components/Portal/ParticipantProfile/ParticipantProfile";
import ParticipantEditForm from "../../../components/Portal/ParticipantEditForm/ParticipantEditForm";
import AuditLogTable from "../../../components/Portal/AuditLogTable/AuditLogTable";
import MakeAdminModal from "../../../components/Portal/MakeAdminModal/MakeAdminModal";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import useAdminSession from "../../../hooks/portal/useAdminSession.js";
import { buildParticipantPageProps } from "../../../utils/portal/participant-page-ssr.js";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";

const DEFAULT_SCORES = ["", "", ""];

const buildFormState = (participant) => ({
  firstName: participant?.firstName || "",
  lastName: participant?.lastName || "",
  nickname: participant?.nickname || "",
  email: participant?.email || "",
  phone: participant?.phone || "",
  birthMonth: participant?.birthMonth || "",
  birthDay: participant?.birthDay || "",
  city: participant?.city || "",
  region: participant?.region || "",
  country: participant?.country || "",
  teamName: participant?.team?.name || "",
  tnmtId: participant?.team?.tnmtId || "",
  doublesId: participant?.doubles?.did || "",
  partnerPid: participant?.doubles?.partnerPid || "",
  laneTeam: participant?.lanes?.team || "",
  laneDoubles: participant?.lanes?.doubles || "",
  laneSingles: participant?.lanes?.singles || "",
  avgEntering: participant?.bookAverage ?? participant?.averages?.entering ?? "",
  teamScores: participant?.scores?.team || DEFAULT_SCORES,
  doublesScores: participant?.scores?.doubles || DEFAULT_SCORES,
  singlesScores: participant?.scores?.singles || DEFAULT_SCORES,
});

const toNumberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildPayload = (formState) => ({
  firstName: formState.firstName,
  lastName: formState.lastName,
  nickname: formState.nickname,
  email: formState.email,
  phone: formState.phone,
  birthMonth: toNumberOrNull(formState.birthMonth),
  birthDay: toNumberOrNull(formState.birthDay),
  city: formState.city,
  region: formState.region,
  country: formState.country,
  bookAverage: toNumberOrNull(formState.avgEntering),
  team: { tnmtId: formState.tnmtId, name: formState.teamName },
  doubles: { did: formState.doublesId, partnerPid: formState.partnerPid },
  lanes: {
    team: formState.laneTeam,
    doubles: formState.laneDoubles,
    singles: formState.laneSingles,
  },
  averages: {
    entering: toNumberOrNull(formState.avgEntering),
  },
  scores: {
    team: formState.teamScores.map(toNumberOrNull).filter((v) => v !== null),
    doubles: formState.doublesScores.map(toNumberOrNull).filter((v) => v !== null),
    singles: formState.singlesScores.map(toNumberOrNull).filter((v) => v !== null),
  },
});

const ParticipantProfilePage = ({ participant: initialParticipant }) => {
  const router = useRouter();
  const { pid } = router.query;
  const [participant, setParticipant] = useState(initialParticipant);
  const [formState, setFormState] = useState(buildFormState(initialParticipant));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [auditLogs, setAuditLogs] = useState([]);
  const { isAdmin, adminRole } = useAdminSession();
  const [showMakeAdmin, setShowMakeAdmin] = useState(false);
  const [linkedAdmin, setLinkedAdmin] = useState(null);
  const [showRevokeAdmin, setShowRevokeAdmin] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");

  const adminEmailHeader = useMemo(() => {
    if (process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return { "x-admin-email": process.env.NEXT_PUBLIC_ADMIN_EMAIL };
    }
    return {};
  }, []);

  useEffect(() => {
    setParticipant(initialParticipant);
    setFormState(buildFormState(initialParticipant));
  }, [initialParticipant]);

  useEffect(() => {
    if (!participant?.email || adminRole !== "super-admin") return;
    portalFetch(`/api/portal/admins/lookup?q=${encodeURIComponent(participant.email)}`)
      .then((response) => response.json())
      .then((data) => {
        setLinkedAdmin(data?.admin || null);
      })
      .catch(() => setLinkedAdmin(null));
  }, [participant?.email, adminRole]);

  useEffect(() => {
    if (!pid || adminRole !== "super-admin") return;
    portalFetch(`/api/portal/participants/${pid}/audit`)
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setAuditLogs(data);
      })
      .catch(() => setAuditLogs([]));
  }, [pid, isEditing, adminRole]);

  const handleChange = (field) => (event) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleScoreChange = (field, index) => (event) => {
    setFormState((prev) => {
      const nextScores = [...prev[field]];
      nextScores[index] = event.target.value;
      return { ...prev, [field]: nextScores };
    });
  };

  const handleSave = async () => {
    if (!pid) return;
    setIsSaving(true);
    setError("");

    const response = await portalFetch(`/api/portal/participants/${pid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...adminEmailHeader },
      body: JSON.stringify(buildPayload(formState)),
    });

    if (!response.ok) {
      setError("Unable to save participant updates.");
      setIsSaving(false);
      return;
    }

    const updated = await response.json();
    setParticipant(updated);
    setFormState(buildFormState(updated));
    setIsEditing(false);
    setIsSaving(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormState(buildFormState(participant));
  };

  const handleRevokeAdmin = async () => {
    if (!linkedAdmin) return;
    setIsRevoking(true);
    setRevokeError("");
    try {
      const response = await portalFetch(`/api/portal/admins/${linkedAdmin.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        setRevokeError(data?.error || "Unable to revoke admin.");
        setIsRevoking(false);
        return;
      }
      setLinkedAdmin(null);
      setShowRevokeAdmin(false);
      setIsRevoking(false);
    } catch (err) {
      setRevokeError("Unable to revoke admin.");
      setIsRevoking(false);
    }
  };

  return (
    <div>
      <PortalShell
        title="Participant details"
        subtitle="Review your lanes, partner, and scores."
      >
        <div className="row g-3 mb-3 align-items-end">
          <div className="col-12 col-md-6 d-flex flex-wrap gap-2 portal-actions">
          {isAdmin && (
            <Link className="btn btn-outline-secondary" href="/portal/admin/dashboard">
              Back to dashboard
            </Link>
          )}
          {isAdmin && !isEditing && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              Edit participant
            </button>
          )}
          {adminRole === "super-admin" && !isEditing && !linkedAdmin && (
            <button
              className="btn btn-outline-primary"
              type="button"
              onClick={() => setShowMakeAdmin(true)}
            >
              Make admin
            </button>
          )}
          {adminRole === "super-admin" && !isEditing && linkedAdmin && (
            <button
              className="btn btn-outline-danger"
              type="button"
              onClick={() => setShowRevokeAdmin(true)}
            >
              Revoke admin
            </button>
          )}
          {isAdmin && isEditing && (
            <>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </>
          )}
          </div>
          {isAdmin && (
            <div className="col-12 col-md-6 text-md-end">
              <AdminMenu adminRole={adminRole} />
            </div>
          )}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {!isEditing && <ParticipantProfile participant={participant} isAdmin={isAdmin} />}

        {isAdmin && isEditing && (
          <ParticipantEditForm
            formState={formState}
            onFieldChange={handleChange}
            onScoreChange={handleScoreChange}
          />
        )}

        {adminRole === "super-admin" && <AuditLogTable auditLogs={auditLogs} />}

        {showMakeAdmin && (
          <MakeAdminModal
            participant={participant}
            onClose={() => setShowMakeAdmin(false)}
          />
        )}

        {showRevokeAdmin && linkedAdmin && (
          <PortalModal
            title="Revoke admin access"
            onClose={() => { if (!isRevoking) setShowRevokeAdmin(false); }}
            actions={
              <>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  disabled={isRevoking}
                  onClick={() => setShowRevokeAdmin(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={isRevoking}
                  onClick={handleRevokeAdmin}
                >
                  {isRevoking ? "Revoking..." : "Revoke access"}
                </button>
              </>
            }
          >
            <p>
              Are you sure you want to revoke admin access for{" "}
              <strong>{participant?.firstName} {participant?.lastName}</strong>
              {participant?.email ? ` (${participant.email})` : ""}?
            </p>
            <p className="text-muted mb-0">
              This action will be recorded in the audit log.
            </p>
            {revokeError && <div className="alert alert-danger mt-3">{revokeError}</div>}
          </PortalModal>
        )}
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ params, req }) => {
  return buildParticipantPageProps({ params, req });
};

ParticipantProfilePage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default ParticipantProfilePage;
