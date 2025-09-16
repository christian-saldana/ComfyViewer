import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "./theme-toggle";

// Mock the useTheme hook
jest.mock("next-themes", () => ({
  useTheme: jest.fn(),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Sun: () => <div data-testid="sun-icon" />,
  Moon: () => <div data-testid="moon-icon" />,
}));

describe("ThemeToggle", () => {
  const mockSetTheme = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    (useTheme as jest.Mock).mockClear();
    mockSetTheme.mockClear();
  });

  it('renders correctly and shows sun icon for "light" theme', () => {
    (useTheme as jest.Mock).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("moon-icon")).toBeInTheDocument(); // It's present but scaled to 0
  });

  it('renders correctly and shows moon icon for "dark" theme', () => {
    (useTheme as jest.Mock).mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("sun-icon")).toBeInTheDocument(); // It's present but scaled to 0
  });

  it('calls setTheme with "dark" when current theme is "light"', () => {
    (useTheme as jest.Mock).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it('calls setTheme with "light" when current theme is "dark"', () => {
    (useTheme as jest.Mock).mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});