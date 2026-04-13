import { Project, ProjectStatus, PMCMember } from "../types";
import { SUB_COUNTY_WARDS } from "../constants";

// All Frappe API calls are routed through the server-side proxy to keep credentials secure.
// The proxy runs on the same host and is reachable at /proxy (Apache forwards to localhost:3001).
const API_BASE = "/proxy/frappe-api";
const IMAGE_PROXY_PATH = "/proxy/image";
const IMAGE_PROXY_TOKEN = import.meta.env.VITE_IMAGE_PROXY_TOKEN || "";

// ─────────────────────────────────────────────
// Cache & Deduplication
// ─────────────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Get cached data if it exists and hasn't expired
 */
const getCached = <T>(key: string): T | null => {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

/**
 * Set cache entry with current timestamp
 */
const setCache = <T>(key: string, data: T): void => {
  cache.set(key, { data, timestamp: Date.now() });
};

/**
 * Deduplicate requests: if a request is already in-flight, return the same promise
 */
const dedupe = async <T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> => {
  // Check if this request is already in-flight
  const inFlight = inFlightRequests.get(key);
  if (inFlight) {
    return inFlight;
  }

  // Create the promise and store it
  const promise = fetcher();
  inFlightRequests.set(key, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    // Clean up after the request completes
    inFlightRequests.delete(key);
  }
};

/**
 * Invalidate cache entries. If id is provided, only invalidate that project.
 * Otherwise, clear all caches for lists and feedback.
 */
export const invalidateCache = (id?: string): void => {
  if (id) {
    cache.delete(`project:${id}`);
  }
  // Clear all list caches on any modification (delete/edit)
  for (const key of cache.keys()) {
    if (key.startsWith('projects:') || key.startsWith('feedback:')) {
      cache.delete(key);
    }
  }
};

// ─────────────────────────────────────────────
// Frappe Response Types
// ─────────────────────────────────────────────

interface FrappeProject {
  name: string;
  project_name: string;
  project_number?: string;
  status: string;
  financial_year: string;
  department: string;
  contractor_name: string;
  project_scope: string;
  admin_names: string;
  amount_paid: number;
  estimated_cost?: number;
  completion_level?: number;
  expected_start_date?: string;
  expected_end_date?: string;
  implemented_by?: string;
  partner?: string;
  contract_period?: number;
  approval_number?: string;
  technical_rating?: string;
  image?: string;
}

export interface FrappeFilters {
  status?: string;
  financial_year?: string;
  department?: string;
  ward?: string;
  wards?: string[];
  search?: string;
}

export interface FrappeFeedback {
  name: string;
  subject: string;
  project: string;
  project_name: string;
  full_name: string;
  category?: string;
  rating?: number;
  description: string;
  creation?: string;
}

interface FrappePMCMember {
  full_name: string;
  gender?: string;
  designation: string;
  group_representing?: string;
  telephone_number?: string;
}

interface FrappePMC {
  name: string;
  project: string;
  project_name?: string;
  members?: FrappePMCMember[];
}

interface FrappeGalleryItem {
  attach_file?: string;
  short_title?: string;
  description?: string;
}

interface FrappeGallery {
  name: string;
  project: string;
  project_name?: string;
  items?: FrappeGalleryItem[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getFrappeImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return "";
  if (!imagePath.startsWith("/files/") && !imagePath.startsWith("/private/files/")) return "";
  return imagePath;
};

// Cache for blob URLs to avoid refetching
const blobUrlCache = new Map<string, string>();

// ─────────────────────────────────────────────
// Concurrent image fetch limiter
// ─────────────────────────────────────────────
const MAX_CONCURRENT_IMAGE_FETCHES = 8;
let activeImageFetches = 0;
const imageQueue: Array<{ resolve: (v: void) => void }> = [];

const acquireImageSlot = (): Promise<void> => {
  if (activeImageFetches < MAX_CONCURRENT_IMAGE_FETCHES) {
    activeImageFetches++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    imageQueue.push({ resolve });
  });
};

const releaseImageSlot = (): void => {
  const next = imageQueue.shift();
  if (next) {
    next.resolve();
  } else {
    activeImageFetches--;
  }
};

/**
 * Fetch a private file from Frappe with authentication and return a blob URL.
 * For public files (/files/), returns the URL directly.
 * For private files (/private/files/), fetches with auth headers and creates a blob URL.
 * Limits concurrent fetches to avoid overwhelming the server.
 */
/**
 * Build a proxy image URL string (no network fetch). Use this for <img src> directly.
 * Returns empty string if proxy is not configured or imageUrl is invalid.
 */
export const getProxyImageUrl = (
  imageUrl: string,
  opts?: { w?: number; h?: number; q?: number; format?: string }
): string => {
  if (!imageUrl || !IMAGE_PROXY_TOKEN) return "";
  if (imageUrl.startsWith("blob:") || imageUrl.startsWith("http")) return imageUrl;
  const params = new URLSearchParams({ url: imageUrl, token: IMAGE_PROXY_TOKEN });
  if (opts?.w) params.set("w", String(opts.w));
  if (opts?.h) params.set("h", String(opts.h));
  if (opts?.q) params.set("q", String(opts.q));
  if (opts?.format) params.set("format", opts.format);
  return `${IMAGE_PROXY_PATH}?${params}`;
};

/**
 * Build an optimized image URL through the proxy, or return a direct URL.
 * All images (public + private) are routed through /proxy/image for Sharp
 * optimization (resize, webp, quality) so they load fast on the frontend.
 * @param imageUrl - Frappe file path like /files/photo.jpg or /private/files/photo.jpg
 * @param opts - Optional resize/quality params (defaults: w=800, q=70, format=webp)
 */
export const fetchAuthenticatedImageUrl = async (
  imageUrl: string,
  opts?: { w?: number; h?: number; q?: number; format?: string }
): Promise<string> => {
  if (!imageUrl) return "";

  // If already a blob URL or external URL, return as-is
  if (imageUrl.startsWith("blob:") || imageUrl.startsWith("http")) return imageUrl;

  // Skip private files entirely — only serve public /files/
  if (imageUrl.startsWith("/private/")) return "";
  if (!imageUrl.startsWith("/files/")) return "";

  // Build cache key including size params
  const w = opts?.w ?? 800;
  const q = opts?.q ?? 70;
  const fmt = opts?.format ?? "webp";
  const sizeKey = `${imageUrl}|${w}|${opts?.h || ""}|${q}|${fmt}`;
  const cached = blobUrlCache.get(sizeKey);
  if (cached) return cached;

  if (!IMAGE_PROXY_TOKEN) {
    // No token — fall back to unoptimized direct URL
    return imageUrl;
  }

  // Route public images through the optimization proxy
  await acquireImageSlot();
  try {
    const params = new URLSearchParams({
      url: imageUrl,
      token: IMAGE_PROXY_TOKEN,
      w: String(w),
      q: String(q),
      format: fmt,
    });
    if (opts?.h) params.set("h", String(opts.h));

    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${IMAGE_PROXY_PATH}?${params}`);
        if (response.ok) {
          const blob = await response.blob();
          if (blob.size > 0) {
            const blobUrl = URL.createObjectURL(blob);
            blobUrlCache.set(sizeKey, blobUrl);
            releaseImageSlot();
            return blobUrl;
          }
        }
        if (attempt < MAX_RETRIES && (response.status === 403 || response.status >= 500)) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        break;
      } catch {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
      }
    }
  } catch {
    // Fall through
  }
  releaseImageSlot();
  // Fallback: return the direct public URL unoptimized
  return imageUrl;
};

const mapFrappeStatus = (status: string): ProjectStatus => {
  if (!status) return ProjectStatus.ONGOING;

  const s = status.toLowerCase().trim();

  if (s === "complete" || s.includes("complete")) return ProjectStatus.COMPLETED;
  if (s === "ongoing") return ProjectStatus.ONGOING;
  if (s === "stalled") return ProjectStatus.STALLED;
  if (s === "not started" || s.includes("not started")) return ProjectStatus.NOT_STARTED;

  return ProjectStatus.ONGOING;
};

// Derive sub-county from ward name using the SUB_COUNTY_WARDS mapping
const getSubCountyFromWard = (wardName: string): string => {
  if (!wardName) return "";
  const lower = wardName.toLowerCase();
  for (const [subCounty, wards] of Object.entries(SUB_COUNTY_WARDS)) {
    if (wards.some(w => lower.includes(w.toLowerCase()))) {
      return subCounty;
    }
  }
  return "";
};

const transformFrappeProject = (fp: FrappeProject): Project => {
  const imageUrl = getFrappeImageUrl(fp.image);
  const ward = fp.admin_names || "";

  return {
    id: fp.name,
    title: fp.project_name,
    description: fp.project_scope || "No description provided",
    department: fp.department,
    subCounty: getSubCountyFromWard(ward),
    ward: ward,
    financialYear: fp.financial_year,
    budget: fp.amount_paid || 0,
    progress: fp.completion_level || 0,
    expenditure: 0,
    status: mapFrappeStatus(fp.status),
    contractor: fp.contractor_name || "TBD",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 31536000000).toISOString().split("T")[0],
    pmcMembers: [],
    images: imageUrl ? [imageUrl] : [],
  };
};

// No auth headers needed — the server-side proxy injects credentials.

// ─────────────────────────────────────────────
// Shared field list for feedback queries
// ─────────────────────────────────────────────

const FEEDBACK_FIELDS = [
  "name",
  "subject",
  "project",
  "project_name",
  "full_name",
  "description",
  "rating",
  "creation",
];

const PMC_FIELDS = [
  "name",
  "project",
  "project_name",
  "members.full_name",
  "members.gender",
  "members.designation",
  "members.group_representing",
];

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
];

// Extended fields for report exports
const REPORT_FIELDS = [
  "name",
  "project_number",
  "project_name",
  "status",
  "financial_year",
  "department",
  "contractor_name",
  "estimated_cost",
  "amount_paid",
  "completion_level",
  "admin_names",
  "project_scope",
  "implemented_by",
  "partner",
  "expected_start_date",
  "expected_end_date",
  "contract_period",
  "approval_number",
  "technical_rating",
];

// Minimal fields for fast list loading (excludes heavy project_scope field)
const FIELDS_LIST = [
  "name",
  "project_name",
  "status",
  "financial_year",
  "department",
  "admin_names",
  "amount_paid",
  "completion_level",
];

// ─────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────

const PAGE_SIZE = 2000; // Full data fetches use larger pages
const LIST_PAGE_SIZE = 150; // List views fetch smaller chunks for faster initial load
const MAX_CONCURRENT_PAGES = 4; // Fetch up to 4 pages in parallel

// Sort projects so Kaloleni ward appears first
const sortKaloleniFirst = (projects: Project[]): Project[] =>
  projects.sort((a, b) => {
    const aIsKaloleni = a.ward?.toLowerCase().includes("kaloleni") ? 0 : 1;
    const bIsKaloleni = b.ward?.toLowerCase().includes("kaloleni") ? 0 : 1;
    return aIsKaloleni - bIsKaloleni;
  });

/**
 * Fetch a single page of projects
 */
const fetchProjectsPage = async (
  start: number,
  pageSize: number,
  frappeFilters: [string, string, string][]
): Promise<FrappeProject[]> => {
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
    `${API_BASE}/resource/ProjectX?${params}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result.data || [];
};

export const fetchFrappeProjects = async (
  filters?: FrappeFilters,
  pageSize = PAGE_SIZE
): Promise<Project[]> => {
  try {
    // Create cache key from filters
    const cacheKey = `projects:${JSON.stringify(filters || {})}`;

    // Check cache first
    const cached = getCached<Project[]>(cacheKey);
    if (cached) {
      // logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    // Deduplicate: if this request is already in-flight, return the existing promise
    return await dedupe(cacheKey, async () => {
      const frappeFilters: [string, string, string][] = [];
      if (filters) {
        if (filters.status) frappeFilters.push(["status", "=", filters.status]);
        if (filters.financial_year) frappeFilters.push(["financial_year", "=", filters.financial_year]);
        if (filters.department) frappeFilters.push(["department", "=", filters.department]);
        if (filters.ward) frappeFilters.push(["admin_names", "=", filters.ward]);
        if (filters.wards && filters.wards.length > 0) frappeFilters.push(["admin_names", "in", filters.wards.join(",")]);
      }

      // Fetch first page to determine if more pages exist
      // logger.debug(`Fetching projects page 0`);
      const firstPage = await fetchProjectsPage(0, pageSize, frappeFilters);

      // If first page is not full, we got everything
      if (firstPage.length < pageSize) {
        const result = sortKaloleniFirst(firstPage.map(transformFrappeProject));
        setCache(cacheKey, result);
        return result;
      }

      // Otherwise, fetch remaining pages in parallel
      const totalNeeded = firstPage.length;
      const pagePromises: Promise<FrappeProject[]>[] = [];

      for (let pageNum = 1; pageNum * pageSize < totalNeeded + pageSize; pageNum++) {
        pagePromises.push(
          fetchProjectsPage(pageNum * pageSize, pageSize, frappeFilters)
        );

        // Fire off MAX_CONCURRENT_PAGES at a time
        if (pagePromises.length === MAX_CONCURRENT_PAGES || pageNum * pageSize >= totalNeeded + pageSize) {
          const results = await Promise.all(pagePromises);
          pagePromises.length = 0; // Reset array

          // Check if the last batch was incomplete (no more pages after this)
          const lastBatch = results[results.length - 1];
          if (lastBatch.length < pageSize) {
            // This is the last page, merge and return
            const allPages = [firstPage, ...results.flat()];
            const flatPages = allPages.flat();
            const result = sortKaloleniFirst(flatPages.map(transformFrappeProject));
            setCache(cacheKey, result);
            return result;
          }
        }
      }

      // Fallback: merge everything we have
      const allResults = sortKaloleniFirst(firstPage.map(transformFrappeProject));
      setCache(cacheKey, allResults);
      return allResults;
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch all projects at once (for react-query caching)
 * Returns array of all projects
 */
export const fetchAllProjects = async (): Promise<Project[]> => {
  return fetchFrappeProjects({}, PAGE_SIZE);
};

/**
 * Fetch projects paginated (for UI pagination)
 * Returns paginated results with metadata
 */
export interface PaginatedProjects {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const fetchProjectsPaginated = async (
  page: number = 0,
  pageSize: number = 20
): Promise<PaginatedProjects> => {
  try {
    const cacheKey = `projects:paginated:${page}:${pageSize}`;

    // Check cache first
    const cached = getCached<PaginatedProjects>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get all projects from main cache
    const allProjects = await fetchAllProjects();

    // Calculate pagination
    const start = page * pageSize;
    const end = start + pageSize;
    const paginatedProjects = allProjects.slice(start, end);

    const result: PaginatedProjects = {
      projects: paginatedProjects,
      total: allProjects.length,
      page,
      pageSize,
      hasMore: end < allProjects.length,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * OPTIMIZED: Fetch projects for list view with smaller pages and minimal fields
 * Returns first page immediately, subsequent pages on demand
 * Uses LIST_PAGE_SIZE (50) instead of PAGE_SIZE (2000) for faster initial load
 */
export const fetchProjectsForList = async (
  page: number = 0,
  filters?: FrappeFilters
): Promise<PaginatedProjects> => {
  try {
    const cacheKey = `projects:list:${page}:${JSON.stringify(filters || {})}`;

    // Check cache first
    const cached = getCached<PaginatedProjects>(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate in-flight requests
    return await dedupe(cacheKey, async () => {
      const frappeFilters: [string, string, string][] = [];
      if (filters) {
        if (filters.status) frappeFilters.push(["status", "=", filters.status]);
        if (filters.financial_year) frappeFilters.push(["financial_year", "=", filters.financial_year]);
        if (filters.department) frappeFilters.push(["department", "=", filters.department]);
        if (filters.ward) frappeFilters.push(["admin_names", "=", filters.ward]);
        if (filters.wards && filters.wards.length > 0) frappeFilters.push(["admin_names", "in", filters.wards.join(",")]);
      }

      // Fetch requested page with list fields only
      const params = new URLSearchParams({
        fields: JSON.stringify(FIELDS_LIST),
        limit_start: String(page * LIST_PAGE_SIZE),
        limit_page_length: String(LIST_PAGE_SIZE + 1), // +1 to detect if more pages exist
        order_by: "creation desc",
      });

      if (frappeFilters.length > 0) {
        params.append("filters", JSON.stringify(frappeFilters));
      }

      // Server-side text search across name and project_name
      if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        params.append("or_filters", JSON.stringify([
          ["name", "like", searchTerm],
          ["project_name", "like", searchTerm],
        ]));
      }

      const response = await fetch(
        `${API_BASE}/resource/ProjectX?${params}`,
        { method: "GET" }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const rawProjects = result.data || [];

      // Check if there are more pages
      const hasMore = rawProjects.length > LIST_PAGE_SIZE;
      const projects = rawProjects.slice(0, LIST_PAGE_SIZE).map(transformFrappeProject);

      const paginatedResult: PaginatedProjects = {
        projects: sortKaloleniFirst(projects),
        total: -1, // Total is unknown without additional query
        page,
        pageSize: LIST_PAGE_SIZE,
        hasMore,
      };

      setCache(cacheKey, paginatedResult);
      return paginatedResult;
    });
  } catch (error) {
    throw error;
  }
};

// ─────────────────────────────────────────────
// Report Export — fetches ALL projects with extended fields
// ─────────────────────────────────────────────

export interface ReportProject {
  id: string;
  projectNumber: string;
  title: string;
  department: string;
  subCounty: string;
  ward: string;
  financialYear: string;
  status: string;
  estimatedCost: number;
  amountPaid: number;
  progress: number;
  contractor: string;
  implementedBy: string;
  partner: string;
  startDate: string;
  endDate: string;
  contractPeriod: number;
  approvalNumber: string;
  technicalRating: string;
  description: string;
}

const transformFrappeProjectForReport = (fp: FrappeProject): ReportProject => {
  const ward = fp.admin_names || "";
  return {
    id: fp.name,
    projectNumber: fp.project_number || "",
    title: fp.project_name || "",
    department: fp.department || "",
    subCounty: getSubCountyFromWard(ward),
    ward,
    financialYear: fp.financial_year || "",
    status: fp.status || "",
    estimatedCost: fp.estimated_cost || 0,
    amountPaid: fp.amount_paid || 0,
    progress: fp.completion_level || 0,
    contractor: fp.contractor_name || "",
    implementedBy: fp.implemented_by || "",
    partner: fp.partner || "",
    startDate: fp.expected_start_date || "",
    endDate: fp.expected_end_date || "",
    contractPeriod: fp.contract_period || 0,
    approvalNumber: fp.approval_number || "",
    technicalRating: fp.technical_rating || "",
    description: fp.project_scope || "",
  };
};

export const fetchAllProjectsForReport = async (): Promise<ReportProject[]> => {
  const cacheKey = "report:all-projects";
  const cached = getCached<ReportProject[]>(cacheKey);
  if (cached) return cached;

  return dedupe(cacheKey, async () => {
    const allProjects: FrappeProject[] = [];
    const batchSize = 2000;
    let start = 0;

    while (true) {
      const params = new URLSearchParams({
        fields: JSON.stringify(REPORT_FIELDS),
        limit_start: String(start),
        limit_page_length: String(batchSize),
        order_by: "creation desc",
      });

      const response = await fetch(
        `${API_BASE}/resource/ProjectX?${params}`,
        { method: "GET" }
      );

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      const batch: FrappeProject[] = result.data || [];
      allProjects.push(...batch);

      if (batch.length < batchSize) break;
      start += batchSize;
    }

    const projects = allProjects.map(transformFrappeProjectForReport);
    setCache(cacheKey, projects);
    return projects;
  });
};

export const fetchFrappeProjectById = async (id: string): Promise<Project | null> => {
  try {
    const cacheKey = `project:${id}`;

    // Check cache first
    const cached = getCached<Project>(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests for the same project
    return await dedupe(cacheKey, async () => {
      const response = await fetch(
        `${API_BASE}/resource/ProjectX/${id}`,
        { method: "GET" }
      );

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      const project = transformFrappeProject(result.data);
      setCache(cacheKey, project);
      return project;
    });
  } catch (error) {
    return null;
  }
};

export const fetchFrappeProjectsByYear = async (financialYear: string): Promise<Project[]> => {
  return fetchFrappeProjects({ financial_year: financialYear });
};

export const fetchFrappeProjectsByStatus = async (status: string): Promise<Project[]> => {
  return fetchFrappeProjects({ status });
};

// ─────────────────────────────────────────────
// PMC Members
// ─────────────────────────────────────────────

/**
 * Fetch PMC members linked to a project from the ProjectX PMC parent document.
 * The ProjectX PMC doctype contains a child table 'members' with member details.
 * Data is cached with 5-minute TTL and request deduplication is applied.
 */
export const fetchProjectXPMC = async (projectId: string): Promise<PMCMember[]> => {
  try {
    const cacheKey = `pmc:${projectId}`;

    // Check cache first
    const cached = getCached<PMCMember[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests for the same project's PMC
    return await dedupe(cacheKey, async () => {
      // First, try without fields parameter - should return full document
      const params = new URLSearchParams({
        filters: JSON.stringify([["project", "=", projectId]]),
      });

      const url = `${API_BASE}/resource/ProjectX%20PMC?${params}`;

      const response = await fetch(url, { method: "GET" });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorObj = JSON.parse(errorText);
        } catch (e) {
        }
        return [];
      }

      const result = await response.json();
      // Parse response - if we got a list, use the first item's name to fetch full details
      const pmcDocuments: FrappePMC[] = result.data || [];

      // If we have PMC documents but no members field, fetch the full document directly
      let members: PMCMember[] = [];

      for (const pmcDocPartial of pmcDocuments) {
        // If members field is missing, fetch the full PMC document
        if (!pmcDocPartial.members) {
          try {
            const fullDocResponse = await fetch(
              `${API_BASE}/resource/ProjectX%20PMC/${pmcDocPartial.name}`,
              { method: "GET" }
            );
            if (fullDocResponse.ok) {
              const fullDocResult = await fullDocResponse.json();
              const pmcDoc = fullDocResult.data;

              if (pmcDoc.members && Array.isArray(pmcDoc.members)) {
                const docMembers = pmcDoc.members.map((member, idx) => ({
                  id: `${pmcDoc.name}-${idx}`,
                  name: member.full_name || "Unknown",
                  role: member.designation || "Member",
                  contact: member.telephone_number || undefined,
                }));
                members.push(...docMembers);
              }
            }
          } catch (e) {
          }
        } else {
          // Members were already in the list view
          const docMembers = pmcDocPartial.members.map((member, idx) => ({
            id: `${pmcDocPartial.name}-${idx}`,
            name: member.full_name || "Unknown",
            role: member.designation || "Member",
            contact: member.telephone_number || undefined,
          }));
          members.push(...docMembers);
        }
      }

      setCache(cacheKey, members);
      return members;
    });
  } catch (error) {
    return [];
  }
};

// ─────────────────────────────────────────────
// Gallery Images
// ─────────────────────────────────────────────

/**
 * Fetch gallery images linked to a project from the ProjectX Gallery parent document.
 * The ProjectX Gallery doctype contains a child table 'items' with image attachments.
 * Data is cached with 5-minute TTL and request deduplication is applied.
 */
export const fetchProjectXGallery = async (projectId: string): Promise<string[]> => {
  try {
    const cacheKey = `gallery:${projectId}`;

    // Check cache first
    const cached = getCached<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests for the same project's gallery
    return await dedupe(cacheKey, async () => {
      // Query for gallery documents linked to this project
      const params = new URLSearchParams({
        filters: JSON.stringify([["project", "=", projectId]]),
      });

      const url = `${API_BASE}/resource/ProjectX%20Gallery?${params}`;

      const response = await fetch(url, { method: "GET" });

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      const galleryDocuments: FrappeGallery[] = result.data || [];

      if (galleryDocuments.length === 0) {
        return [];
      }

      let imageUrls: string[] = [];

      for (const galleryDocPartial of galleryDocuments) {
        // Always fetch the full document to ensure we get all fields
        try {
          const fullDocResponse = await fetch(
            `${API_BASE}/resource/ProjectX%20Gallery/${galleryDocPartial.name}`,
            { method: "GET" }
          );
          if (fullDocResponse.ok) {
            const fullDocResult = await fullDocResponse.json();
            const galleryDoc = fullDocResult.data;

            // Try multiple possible field names for the items table
            const itemsArray = galleryDoc.items || galleryDoc.gallery_items || [];

            if (Array.isArray(itemsArray) && itemsArray.length > 0) {
              const itemUrls = itemsArray
                .map((item: any) => {
                  // Try multiple possible field names for the attachment
                  const attachmentPath = item.attach_file || item.attach_photo || item.attachment || item.image;
                  return getFrappeImageUrl(attachmentPath);
                })
                .filter((url) => url !== "");
              imageUrls.push(...itemUrls);
            }
          }
        } catch (e) {
          // Silently handle errors for individual document fetches
        }
      }

      setCache(cacheKey, imageUrls);
      return imageUrls;
    });
  } catch (error) {
    return [];
  }
};

/**
 * Fetch the set of project IDs that have at least one gallery entry.
 * Used to sort projects-with-images first in the list view.
 * Returns a Set<string> of project IDs.
 */
export const fetchProjectIdsWithGallery = async (): Promise<Set<string>> => {
  const cacheKey = 'gallery:project-ids';
  const cached = getCached<string[]>(cacheKey);
  if (cached) return new Set(cached);

  return dedupe(cacheKey, async () => {
    try {
      const all: string[] = [];
      let start = 0;
      const limit = 500;
      while (true) {
        const params = new URLSearchParams({
          fields: JSON.stringify(["project"]),
          limit_start: String(start),
          limit_page_length: String(limit),
        });
        const res = await fetch(`${API_BASE}/resource/ProjectX%20Gallery?${params}`);
        if (!res.ok) break;
        const result = await res.json();
        const rows: { project: string }[] = result.data || [];
        for (const r of rows) {
          if (r.project && !all.includes(r.project)) all.push(r.project);
        }
        if (rows.length < limit) break;
        start += limit;
      }
      setCache(cacheKey, all);
      return new Set(all);
    } catch {
      return new Set<string>();
    }
  });
};

/**
 * Fast version: fetch only the first gallery image URL for a project.
 * Uses a single API call with limit_page_length=1 + full doc fetch.
 * Returns the image path (e.g. /files/photo.jpg) or empty string.
 */
export const fetchFirstGalleryImage = async (projectId: string): Promise<string> => {
  const cacheKey = `gallery-first:${projectId}`;
  const cached = getCached<string>(cacheKey);
  if (cached !== null) return cached;

  return dedupe(cacheKey, async () => {
    try {
      const params = new URLSearchParams({
        filters: JSON.stringify([["project", "=", projectId]]),
        fields: JSON.stringify(["name"]),
        limit_page_length: "1",
      });
      const response = await fetch(
        `${API_BASE}/resource/ProjectX%20Gallery?${params}`,
        {}
      );
      if (!response.ok) { setCache(cacheKey, ""); return ""; }

      const result = await response.json();
      const docs = result.data || [];
      if (docs.length === 0) { setCache(cacheKey, ""); return ""; }

      const fullDoc = await fetch(
        `${API_BASE}/resource/ProjectX%20Gallery/${docs[0].name}`,
        {}
      );
      if (!fullDoc.ok) { setCache(cacheKey, ""); return ""; }

      const data = (await fullDoc.json()).data;
      const items = data.items || data.gallery_items || [];
      if (!Array.isArray(items) || items.length === 0) { setCache(cacheKey, ""); return ""; }

      const path = items[0].attach_file || items[0].attach_photo || items[0].attachment || items[0].image;
      const url = getFrappeImageUrl(path);
      setCache(cacheKey, url);
      return url;
    } catch {
      setCache(cacheKey, "");
      return "";
    }
  });
};

// ─────────────────────────────────────────────
// Feedback
// ─────────────────────────────────────────────

/**
 * Fetch ALL feedback entries across every project, paginated.
 * Rows are ordered by project asc, creation desc — ready for grouping.
 */
export const fetchAllFeedback = async (pageSize = PAGE_SIZE): Promise<FrappeFeedback[]> => {
  try {
    const cacheKey = 'feedback:all';

    // Check cache first
    const cached = getCached<FrappeFeedback[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests
    return await dedupe(cacheKey, async () => {
      const all: FrappeFeedback[] = [];
      let start = 0;

      while (true) {
        const params = new URLSearchParams({
          fields: JSON.stringify(FEEDBACK_FIELDS),
          order_by: "creation desc",
          limit_page_length: String(pageSize),
          limit_start: String(start),
        });

        const response = await fetch(
          `${API_BASE}/resource/ProjectX Feedback?${params}`,
          { method: "GET" }
        );

        if (!response.ok) {
          const errorText = await response.text();
          break;
        }

        const result = await response.json();
        const batch: FrappeFeedback[] = result.data ?? [];
        all.push(...batch);

        if (batch.length < pageSize) break; // last page reached
        start += pageSize;
      }

      setCache(cacheKey, all);
      return all;
    });
  } catch (error) {
    return [];
  }
};

/**
 * Fetch all feedback entries linked to a given ProjectX document ID.
 */
export const fetchFeedbackByProject = async (projectId: string): Promise<FrappeFeedback[]> => {
  try {
    const cacheKey = `feedback:${projectId}`;

    // Check cache first
    const cached = getCached<FrappeFeedback[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests for the same project's feedback
    return await dedupe(cacheKey, async () => {
      const params = new URLSearchParams({
        fields: JSON.stringify(FEEDBACK_FIELDS),
        filters: JSON.stringify([["project", "=", projectId]]),
        order_by: "creation desc",
      });

      const url = `${API_BASE}/resource/ProjectX Feedback?${params}`;

      const response = await fetch(url, { method: "GET" });

      if (!response.ok) {
        const errorText = await response.text();
        return [];
      }

      const result = await response.json();
      const feedback = result.data || [];
      setCache(cacheKey, feedback);
      return feedback;
    });
  } catch (error) {
    return [];
  }
};

/**
 * Submit citizen feedback linked to a ProjectX document.
 */
export const submitFeedbackToFrappe = async (payload: {
  subject: string;
  project: string;
  project_name: string;
  full_name: string;
  phone_number: string;
  email: string;
  category: string;
  rating: number;
  description: string;
}): Promise<boolean> => {
  try {
    const response = await fetch(
      `${API_BASE}/resource/ProjectX Feedback`,
      {
        method: "POST",
        headers: {
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

    // Invalidate feedback caches after successful submission
    invalidateCache(payload.project);

    return true;
  } catch (error) {
    return false;
  }
};

// ─────────────────────────────────────────────
// Project Documents
// ─────────────────────────────────────────────

import { ProjectDocument } from '../types';

/**
 * Fetch documents linked to a project from the ProjectX Document doctype.
 */
export const fetchProjectXDocuments = async (projectId: string): Promise<ProjectDocument[]> => {
  try {
    const cacheKey = `documents:${projectId}`;

    const cached = getCached<ProjectDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return await dedupe(cacheKey, async () => {
      const params = new URLSearchParams({
        filters: JSON.stringify([["project", "=", projectId]]),
        fields: JSON.stringify(["name", "document_type", "details", "attach_file"]),
      });

      const url = `${API_BASE}/resource/ProjectX%20Document?${params}`;
      const response = await fetch(url, { method: "GET" });

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      const docs = (result.data || []).map((doc: any) => ({
        id: doc.name,
        documentType: doc.document_type || '',
        details: doc.details || '',
        attachUrl: doc.attach_file || '',
      }));

      setCache(cacheKey, docs);
      return docs;
    });
  } catch (error) {
    return [];
  }
};

export interface FrappeUser {
  name: string;
  full_name: string;
  email: string;
  mobile_no?: string;
  department?: string;
  enabled: number;
  roles?: { role: string }[];
}

export const fetchFrappeUsers = async (): Promise<FrappeUser[]> => {
  const pageSize = 50;
  let page = 0;
  const all: FrappeUser[] = [];

  const fields = encodeURIComponent(
    JSON.stringify(["name", "full_name", "email", "mobile_no", "department", "enabled"])
  );
  const filters = encodeURIComponent(
    JSON.stringify([["name", "!=", "Guest"], ["name", "!=", "Administrator"]])
  );

  while (true) {
    const url = `${API_BASE}/resource/User?fields=${fields}&filters=${filters}&limit=${pageSize}&limit_start=${page * pageSize}&order_by=full_name asc`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) break;
    const json = await resp.json();
    const data: FrappeUser[] = json.data ?? json.message ?? [];
    if (!data.length) break;

    // Fetch roles for each user
    const withRoles = await Promise.all(
      data.map(async (u) => {
        try {
          const rUrl = `${API_BASE}/resource/User/${encodeURIComponent(u.name)}?fields=${encodeURIComponent(JSON.stringify(["name", "full_name", "email", "mobile_no", "department", "enabled", "roles"]))}`;
          const rResp = await fetch(rUrl, { credentials: "include" });
          if (rResp.ok) {
            const rJson = await rResp.json();
            return { ...u, roles: (rJson.data ?? rJson).roles ?? [] } as FrappeUser;
          }
        } catch { }
        return u;
      })
    );

    all.push(...withRoles);
    if (data.length < pageSize) break;
    page++;
  }

  return all;
};

export default {
  fetchFrappeProjects,
  fetchFrappeProjectById,
  fetchFrappeProjectsByYear,
  fetchFrappeProjectsByStatus,
  fetchProjectXPMC,
  fetchProjectXGallery,
  fetchFirstGalleryImage,
  fetchProjectIdsWithGallery,
  getProxyImageUrl,
  fetchProjectXDocuments,
  fetchAllFeedback,
  fetchFeedbackByProject,
  submitFeedbackToFrappe,
  fetchFrappeUsers,
};