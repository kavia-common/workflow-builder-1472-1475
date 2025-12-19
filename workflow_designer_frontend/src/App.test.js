import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders toolbar", () => {
  render(<App />);
  expect(screen.getByRole("toolbar", { name: /workflow actions/i })).toBeInTheDocument();
});
