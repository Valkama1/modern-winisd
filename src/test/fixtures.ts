import { Project } from "../types";
import { createDefaultProject } from "../lib/projectDefaults";

/**
 * A complete Project for tests, from the same factory the app uses — so a new field
 * cannot be added to Project without the fixtures getting it too.
 */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    ...createDefaultProject("test-project", "Test Project", "#4f8ff7"),
    ...overrides,
  };
}
