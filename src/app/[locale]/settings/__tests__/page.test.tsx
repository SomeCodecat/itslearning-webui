import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import SettingsPage from "../page";

const mockFetch = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      title: "Settings",
      subtitle: "Manage your profile and school connection.",
      profile: "Profile",
      schoolConnection: "School Connection",
      personalInformation: "Personal Information",
      loadingProfile: "Loading profile...",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      saving: "Saving...",
      saveChanges: "Save Changes",
      saved: "Saved!",
      saveFailed: "Failed to save.",
      connectItslearning: "Connect to itslearning",
      itslearningUrl: "itslearning URL",
      organizationUrlHint: "Usually your organization's login page.",
      username: "Username",
      password: "Password",
      environment: "Environment",
      externalUrl: "External URL:",
      notSet: "Not set",
      showPassword: "Show password",
      hidePassword: "Hide password",
    };

    return (key: string) => messages[key] ?? key;
  },
}));

function renderWithSWR() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SettingsPage />
    </SWRConfig>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          firstName: "Lena",
          lastName: "Schmidt",
          email: "lena@example.com",
          itslearningUrl: "https://sso.itslearning.com",
          itslearningUser: "lena",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses the tokenized segmented control and field kit", async () => {
    const { container } = renderWithSWR();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Lena")).toBeDefined();
    });

    expect(container.firstElementChild?.className).toContain("bg-background");
    expect(screen.getByRole("button", { name: "Profile" }).className).toContain(
      "bg-card",
    );
    expect(screen.getByLabelText("First Name").className).toContain(
      "bg-elevated",
    );
  });
});
