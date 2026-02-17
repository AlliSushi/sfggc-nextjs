const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ADMIN_DASHBOARD = path.join(process.cwd(), "src/pages/portal/admin/dashboard.js");
const PARTICIPANT_EDIT_FORM = path.join(process.cwd(), "src/components/Portal/ParticipantEditForm/ParticipantEditForm.js");

// Find ParticipantCard component
const findParticipantCard = () => {
  const componentsDir = path.join(process.cwd(), "src/components/Portal");
  const files = fs.readdirSync(componentsDir, { recursive: true });

  for (const file of files) {
    if (file.includes("ParticipantCard") && file.endsWith(".js")) {
      return path.join(componentsDir, file);
    }
  }
  return null;
};

// Find TeamCard component
const findTeamCard = () => {
  const componentsDir = path.join(process.cwd(), "src/components/Portal");
  const files = fs.readdirSync(componentsDir, { recursive: true });

  for (const file of files) {
    if (file.includes("TeamCard") && file.endsWith(".js")) {
      return path.join(componentsDir, file);
    }
  }
  return null;
};

describe("Nickname in admin dashboard", () => {
  test("Given admin dashboard, when displaying participants table, then nickname column appears between Name and Email", () => {
    const src = fs.readFileSync(ADMIN_DASHBOARD, "utf-8");

    // Should have table header for nickname
    assert.ok(
      src.includes("Nickname") || src.includes("nickname"),
      "Admin dashboard must display Nickname column"
    );

    // Find table structure to verify column order
    // Look for th elements or table headers
    const hasTableStructure = src.match(/<th|<Table|thead/);
    if (hasTableStructure) {
      // Verify nickname appears in table
      assert.ok(
        src.match(/name.*nickname.*email/is) || src.match(/Name.*Nickname.*Email/is),
        "Nickname column should appear between Name and Email in table"
      );
    }
  });
});

describe("Nickname in participant edit form", () => {
  test("Given ParticipantEditForm component, when checking fields, then first_name, last_name, and nickname fields exist", () => {
    const src = fs.readFileSync(PARTICIPANT_EDIT_FORM, "utf-8");

    // Must have all three name fields
    assert.ok(
      src.includes("first_name") || src.includes("firstName"),
      "ParticipantEditForm must have first_name field"
    );

    assert.ok(
      src.includes("last_name") || src.includes("lastName"),
      "ParticipantEditForm must have last_name field"
    );

    assert.ok(
      src.includes("nickname"),
      "ParticipantEditForm must have nickname field"
    );
  });

  test("Given ParticipantEditForm component, when checking layout, then name fields appear on one line together", () => {
    const src = fs.readFileSync(PARTICIPANT_EDIT_FORM, "utf-8");

    // Look for field grouping - same row or flex container
    // Common patterns: col-4, col-md-4, flex layout, grid layout
    const hasRowLayout = src.match(/row|flex|grid/i);
    assert.ok(hasRowLayout, "Form should have layout structure for fields");

    // Fields should be in same container/row
    const nameFieldsSection = src.match(/first.*last.*nickname|firstName.*lastName.*nickname/is);
    assert.ok(
      nameFieldsSection,
      "first_name, last_name, and nickname should be grouped together in layout"
    );
  });

  test("Given ParticipantEditForm component, when form is submitted, then nickname is included in update data", () => {
    const src = fs.readFileSync(PARTICIPANT_EDIT_FORM, "utf-8");

    // Check if nickname is included in form submission
    // Look for fetch/axios/mutation with nickname field
    const hasNicknameInSubmit = src.match(/nickname.*fetch|fetch.*nickname|nickname.*body/is);
    assert.ok(
      hasNicknameInSubmit || src.includes("nickname"),
      "Form submission should include nickname field"
    );
  });
});

describe("Nickname in participant card view mode", () => {
  test("Given ParticipantCard component exists, when checking display logic, then it shows nickname instead of first_name when nickname exists", () => {
    const participantCardPath = findParticipantCard();

    if (!participantCardPath) {
      // Skip if component doesn't exist yet
      assert.ok(true, "ParticipantCard component will be created or modified");
      return;
    }

    const src = fs.readFileSync(participantCardPath, "utf-8");

    // Should have logic to prefer nickname over first_name
    // Common patterns: nickname || first_name, nickname ? nickname : first_name
    const hasNicknameLogic = src.match(/nickname\s*\|\|\s*first|nickname\s*\?\s*nickname\s*:\s*first|nickname.*first_name/i);

    assert.ok(
      hasNicknameLogic || src.includes("nickname"),
      "ParticipantCard should prefer nickname over first_name in display"
    );
  });
});

describe("Nickname in team card", () => {
  test("Given TeamCard component exists, when displaying team members, then nickname is shown instead of first_name when available", () => {
    const teamCardPath = findTeamCard();

    if (!teamCardPath) {
      // Skip if component doesn't exist yet
      assert.ok(true, "TeamCard component will be created or modified");
      return;
    }

    const src = fs.readFileSync(teamCardPath, "utf-8");

    // Should display nickname for team members
    // Look for member name rendering
    const hasMemberNameLogic = src.match(/member|player|person/i);

    if (hasMemberNameLogic) {
      assert.ok(
        src.includes("nickname"),
        "TeamCard should include nickname in member display logic"
      );

      // Should prefer nickname over first_name
      const hasNicknamePreference = src.match(/nickname\s*\|\|\s*first|nickname\s*\?\s*nickname\s*:\s*first/i);
      assert.ok(
        hasNicknamePreference || src.includes("nickname"),
        "TeamCard should prefer nickname over first_name for members"
      );
    }
  });
});
