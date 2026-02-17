import { toTeamSlug } from "../../../utils/portal/slug.js";
import TeamLinks from "../TeamLinks/TeamLinks.js";

const SCORE_SECTIONS = [
  { label: "Team scores", field: "teamScores" },
  { label: "Doubles scores", field: "doublesScores" },
  { label: "Singles scores", field: "singlesScores" },
];

const GAME_INDICES = [0, 1, 2];

const FormField = ({ id, label, value, onChange, colClass = "col-12 col-md-6" }) => (
  <div className={colClass}>
    <label className="form-label" htmlFor={id}>
      {label}
    </label>
    <input
      className="form-control"
      id={id}
      value={value}
      onChange={onChange}
    />
  </div>
);

const ParticipantEditForm = ({ formState, onFieldChange, onScoreChange }) => {
  const teamSlug = formState.teamName ? toTeamSlug(formState.teamName) : "";

  return (
    <section className="card">
      <div className="card-body">
        <form className="row g-3 portal-edit-form">
      <FormField
        id="first-name"
        label="First name"
        value={formState.firstName}
        onChange={onFieldChange("firstName")}
        colClass="col-12 col-md-4"
      />
      <FormField
        id="last-name"
        label="Last name"
        value={formState.lastName}
        onChange={onFieldChange("lastName")}
        colClass="col-12 col-md-4"
      />
      <FormField
        id="nickname"
        label="Nickname"
        value={formState.nickname}
        onChange={onFieldChange("nickname")}
        colClass="col-12 col-md-4"
      />
      <FormField
        id="email"
        label="Email"
        value={formState.email}
        onChange={onFieldChange("email")}
      />
      <FormField
        id="phone"
        label="Phone"
        value={formState.phone}
        onChange={onFieldChange("phone")}
      />
      <FormField
        id="birth-month"
        label="Birth month"
        value={formState.birthMonth}
        onChange={onFieldChange("birthMonth")}
        colClass="col-12 col-md-3"
      />
      <FormField
        id="birth-day"
        label="Birth day"
        value={formState.birthDay}
        onChange={onFieldChange("birthDay")}
        colClass="col-12 col-md-3"
      />
      <FormField
        id="city"
        label="City"
        value={formState.city}
        onChange={onFieldChange("city")}
        colClass="col-12 col-md-3"
      />
      <FormField
        id="region"
        label="Region"
        value={formState.region}
        onChange={onFieldChange("region")}
        colClass="col-12 col-md-3"
      />
      <FormField
        id="country"
        label="Country"
        value={formState.country}
        onChange={onFieldChange("country")}
        colClass="col-12 col-md-4"
      />
      <div className="col-12 col-md-4">
        <label className="form-label" htmlFor="scratch-masters">
          Scratch Masters
        </label>
        <select
          id="scratch-masters"
          className="form-select"
          value={formState.scratchMasters}
          onChange={onFieldChange("scratchMasters")}
        >
          <option value="1">Yes</option>
          <option value="0">No</option>
        </select>
      </div>

      <div className="col-12">
        <hr />
      </div>

      <FormField
        id="team-name"
        label="Team name"
        value={formState.teamName}
        onChange={onFieldChange("teamName")}
      />
      <FormField
        id="team-id"
        label="Team ID"
        value={formState.tnmtId}
        onChange={onFieldChange("tnmtId")}
      />
      <TeamLinks
        teamSlug={teamSlug}
        teamName={formState.teamName}
        tnmtId={formState.tnmtId}
      />

      <FormField
        id="doubles-id"
        label="Doubles ID"
        value={formState.doublesId}
        onChange={onFieldChange("doublesId")}
        colClass="col-12 col-md-4"
      />
      <FormField
        id="partner-pid"
        label="Partner PID"
        value={formState.partnerPid}
        onChange={onFieldChange("partnerPid")}
        colClass="col-12 col-md-4"
      />

      <div className="col-12">
        <hr />
      </div>

      <div className="col-12 col-md-4">
        <label className="form-label">Team lane</label>
        <input
          className="form-control"
          value={formState.laneTeam}
          onChange={onFieldChange("laneTeam")}
        />
      </div>
      <div className="col-12 col-md-4">
        <label className="form-label">Doubles lane</label>
        <input
          className="form-control"
          value={formState.laneDoubles}
          onChange={onFieldChange("laneDoubles")}
        />
      </div>
      <div className="col-12 col-md-4">
        <label className="form-label">Singles lane</label>
        <input
          className="form-control"
          value={formState.laneSingles}
          onChange={onFieldChange("laneSingles")}
        />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Book Average</label>
        <input
          className="form-control"
          value={formState.avgEntering}
          onChange={onFieldChange("avgEntering")}
        />
      </div>

      <div className="col-12">
        <hr />
      </div>

      {SCORE_SECTIONS.map((section) => (
        <div className="col-12" key={section.field}>
          <label className="form-label">{section.label}</label>
          <div className="row g-2">
            {GAME_INDICES.map((index) => (
              <div className="col-12 col-md-4" key={index}>
                <input
                  className="form-control"
                  value={formState[section.field][index] || ""}
                  onChange={onScoreChange(section.field, index)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
        </form>
      </div>
    </section>
  );
};

export default ParticipantEditForm;
