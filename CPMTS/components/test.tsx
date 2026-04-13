import { Project, ProjectStatus } from "../types";

const REMOTE_URL = ""; // unused test file
const API_KEY = "";
const API_SECRET = "";

// ─────────────────────────────────────────────
// Frappe Response Types
// ─────────────────────────────────────────────

interface FrappeProject {
  name: string;
  project_name: string;
  status: string;
  financial_year: string;
  department: string;
  contractor_name: string;
  project_scope: string;
  admin_names: string;
  amount_paid: number;
  image?: string; // only returned by single-document endpoint, not list
}

interface FrappeFilters {
  status?: string;
  financial_year?: string;
  department?: string;
  ward?: string; // maps to admin_names in Frappe
}

export interface FrappeFeedback {
  name: string;         // Frappe document ID (auto-generated)
  subject: string;
  project: string;      // Link field → ProjectX
  project_name: string;
  full_name: string;
  description: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getFrappeImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return "";
  if (!imagePath.startsWith("/files/")) return "";
  return `${REMOTE_URL}${imagePath}`;
};

const mapFrappeStatus = (status: string): ProjectStatus => {
  if (!status) return ProjectStatus.ONGOING;

  const s = status.toLowerCase().trim();

  if (s === "complete" || s.includes("complete")) return ProjectStatus.COMPLETED;
  if (s === "ongoing") return ProjectStatus.ONGOING;
  if (s === "stalled") return ProjectStatus.STALLED;
  if (s === "not stalled") return ProjectStatus.NOT_STARTED;

  return ProjectStatus.ONGOING;
};

const transformFrappeProject = (fp: FrappeProject): Project => {
  // image is only available from the single-document endpoint (/api/resource/ProjectX/{id}).
  // The list endpoint rejects it with "Field not permitted in query", so it may be undefined here.
  const imageUrl = getFrappeImageUrl(fp.image);

  return {
    id: fp.name,
    title: fp.project_name,
    description: fp.project_scope || "No description provided",
    department: fp.department,
    subCounty: "",
    ward: fp.admin_names,
    financialYear: fp.financial_year,
    budget: fp.amount_paid || 0,
    progress: 0,
    expenditure: 0,
    status: mapFrappeStatus(fp.status),
    contractor: fp.contractor_name || "TBD",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 31536000000).toISOString().split("T")[0],
    pmcMembers: [],
    images: imageUrl ? [imageUrl] : [],
  };
};

// ─────────────────────────────────────────────
// API Calls
// ─────────────────────────────────────────────

const AUTH_HEADERS = {
  Authorization: `token ${API_KEY}:${API_SECRET}`,
  Accept: "application/json",
};

const FIELDS = [
  "name",
  "project_name",
  "status",
  "financial_year",
  "department",
  "contractor_name",
  "project_scope",
  "admin_names",
  "amount_paid",
  // "image"      — not permitted in ProjectX list queries (Frappe raises DataError);
  //                it IS returned by the single-document endpoint used in fetchFrappeProjectById.
  // "sub_county" — field does not exist in ProjectX doctype
  // "progress"   — field does not exist in ProjectX doctype
];

/**
 * Fetch all projects from Frappe (ProjectX doctype) with pagination.
 */
export const fetchFrappeProjects = async (
  filters?: FrappeFilters,
  pageSize = 500
): Promise<Project[]> => {
  try {
    let allProjects: FrappeProject[] = [];
    let start = 0;
    let hasMore = true;

    const frappeFilters: [string, string, string][] = [];
    if (filters) {
      if (filters.status) frappeFilters.push(["status", "=", filters.status]);
      if (filters.financial_year) frappeFilters.push(["financial_year", "=", filters.financial_year]);
      if (filters.department) frappeFilters.push(["department", "=", filters.department]);
      if (filters.ward) frappeFilters.push(["admin_names", "=", filters.ward]);
    }

    while (hasMore) {
      const params = new URLSearchParams({
        fields: JSON.stringify(FIELDS),
        limit_start: String(start),
        limit_page_length: String(pageSize),
        order_by: "creation desc",
      });

      if (frappeFilters.length > 0) {
        params.append("filters", JSON.stringify(frappeFilters));
      }

      const response = await fetch(
        `${REMOTE_URL}/api/resource/ProjectX?${params}`,
        { method: "GET", headers: AUTH_HEADERS }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const batch: FrappeProject[] = result.data || [];

      allProjects = allProjects.concat(batch);
      hasMore = batch.length === pageSize;
      start += pageSize;
    }

    return allProjects.map(transformFrappeProject);
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch a single project by its Frappe document ID.
 * This endpoint returns all fields including `image`, unlike the list endpoint.
 */
export const fetchFrappeProjectById = async (id: string): Promise<Project | null> => {
  try {
    const response = await fetch(
      `${REMOTE_URL}/api/resource/ProjectX/${id}`,
      { method: "GET", headers: AUTH_HEADERS }
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const result = await response.json();
    return transformFrappeProject(result.data);
  } catch (error) {
    return null;
  }
};

/**
 * Fetch projects filtered by financial year.
 */
export const fetchFrappeProjectsByYear = async (financialYear: string): Promise<Project[]> => {
  return fetchFrappeProjects({ financial_year: financialYear });
};

/**
 * Fetch projects filtered by status.
 */
export const fetchFrappeProjectsByStatus = async (status: string): Promise<Project[]> => {
  return fetchFrappeProjects({ status });
};

// ─────────────────────────────────────────────
// Feedback
// ─────────────────────────────────────────────

/**
 * Fetch all feedback entries linked to a given ProjectX document ID.
 */
export const fetchFeedbackByProject = async (projectId: string): Promise<FrappeFeedback[]> => {
  try {
    const params = new URLSearchParams({
      fields: JSON.stringify([
        "name",
        "subject",
        "project",
        "project_name",
        "full_name",
        "phone_number",
        "email",
        "description",
      ]),
      filters: JSON.stringify([["project", "=", projectId]]),
      order_by: "creation desc",
    });

    const response = await fetch(
      `${REMOTE_URL}/api/resource/ProjectX Feedback?${params}`,
      { method: "GET", headers: AUTH_HEADERS }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return [];
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    return [];
  }
};

/**
 * Submit citizen feedback linked to a ProjectX document.
 */
export const submitFeedbackToFrappe = async (payload: {
  subject: string;
  project: string;       // ProjectX document ID (e.g. "006/133/404/13-14")
  project_name: string;  // Human-readable project title
  full_name: string;
  phone_number: string;
  email: string;
  description: string;
}): Promise<boolean> => {
  try {
    const response = await fetch(
      `${REMOTE_URL}/api/resource/ProjectX Feedback`,
      {
        method: "POST",
        headers: {
          ...AUTH_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return false;
    }

    const result = await response.json();
    return true;
  } catch (error) {
    return false;
  }
};

export default {
  fetchFrappeProjects,
  fetchFrappeProjectById,
  fetchFrappeProjectsByYear,
  fetchFrappeProjectsByStatus,
  fetchFeedbackByProject,
  submitFeedbackToFrappe,
};