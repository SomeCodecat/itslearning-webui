import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SetupPage from "../page";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      title: "Welcome to itslearning WebUI",
      subtitle: "Create your admin account to get started.",
      passwordMismatch: "Passwords do not match",
      createFailed: "Failed to create account",
      emailLabel: "Email address",
      emailPlaceholder: "Email address",
      firstNameLabel: "First Name",
      firstNamePlaceholder: "First Name (Optional)",
      lastNameLabel: "Last Name",
      lastNamePlaceholder: "Last Name (Optional)",
      passwordLabel: "Password",
      passwordPlaceholder: "Password",
      confirmPasswordLabel: "Confirm Password",
      confirmPasswordPlaceholder: "Confirm Password",
      creatingAccount: "Creating Account...",
      createAccount: "Create Account",
      showPassword: "Show password",
      hidePassword: "Hide password",
    };

    return (key: string) => messages[key] ?? key;
  },
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("SetupPage", () => {
  it("uses setup display type and tokenized fields", () => {
    const { container } = render(<SetupPage />);

    expect(container.firstElementChild?.className).toContain("bg-background");
    expect(screen.getByRole("heading", { name: "Welcome to itslearning WebUI" }).className).toContain(
      "text-display",
    );
    expect(screen.getByLabelText("Email address").className).toContain(
      "bg-elevated",
    );
  });
});
