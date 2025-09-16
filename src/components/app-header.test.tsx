import React from "react";

import { render, screen, fireEvent } from "@testing-library/react";

import { AppHeader } from "./app-header";

const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

window.ResizeObserver = mockResizeObserver;

// Mock child components to isolate the AppHeader component
jest.mock("./theme-toggle", () => ({
  ThemeToggle: () => <button>Toggle Theme</button>,
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  ...jest.requireActual("lucide-react"),
  ArrowUpNarrowWide: () => <div data-testid="icon-asc" />,
  ArrowDownWideNarrow: () => <div data-testid="icon-desc" />,
  ResizeObserver: () => <div data-testid="icon-desc" />,
}));

describe("AppHeader", () => {
  const mockProps = {
    isLoading: false,
    progress: 0,
    gridCols: 4,
    onGridColsChange: jest.fn(),
    sortBy: "lastModified" as "lastModified" | "size",
    onSortByChange: jest.fn(),
    sortOrder: "desc" as "asc" | "desc",
    onSortOrderChange: jest.fn(),
  };

  it("renders the header with title", () => {
    render(<AppHeader {...mockProps} />);
    expect(
      screen.getByRole("heading", { name: /comfyviewer/i })
    ).toBeInTheDocument();
  });

  it("does not show progress bar when not loading", () => {
    render(<AppHeader {...mockProps} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows progress bar when loading", () => {
    render(<AppHeader {...mockProps} isLoading={true} progress={50} />);
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("calls onSortOrderChange when sort direction button is clicked", () => {
    render(<AppHeader {...mockProps} sortOrder="desc" />);
    const sortButton = screen.getByRole("button", {
      name: /sort by/i,
    });
    fireEvent.click(sortButton);
    expect(mockProps.onSortOrderChange).toHaveBeenCalledWith("asc");
  });

  it("displays the correct sort direction icon", () => {
    const { rerender } = render(<AppHeader {...mockProps} sortOrder="desc" />);
    expect(screen.getByTestId("icon-desc")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-asc")).not.toBeInTheDocument();

    rerender(<AppHeader {...mockProps} sortOrder="asc" />);
    expect(screen.getByTestId("icon-asc")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-desc")).not.toBeInTheDocument();
  });
});