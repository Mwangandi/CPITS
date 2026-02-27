import { Project, ProjectStatus } from "../types";
import { DEPARTMENTS, SUB_COUNTIES, WARDS, getDepartmentImage } from "../constants";

// TODO: Replace all URL with REMOTE_URL
// const REMOTE_URL = "http://203.161.56.134:12001"
// const REMOTE_URL = "http://203.161.56.134:12001"
//TODO: Move API_KEY and API_SECRET to .env file and load using Vite's import.meta.env
// const API_KEY = "0a7e8376ab54c74"
// const API_SECRET = "861e2ca6562e160"

const REMOTE_URL = import.meta.env.VITE_API_URL
const API_KEY = import.meta.env.VITE_API_KEY
const API_SECRET = import.meta.env.VITE_API_SECRET


// Frappe Response Types
interface FrappeProject {
  name: string;
  reference_number: string;
  project_name: string;
  scope_of_work: string;
  financial_year: string;
  amount: number;
  progress?: number;
  status: string;
  department: string;
  directorate: string;
  sub_county: string;
  ward: string;
  contractor: string;
  image?: string;
}

interface FrappeFilters {
  status?: string;
  financial_year?: string;
  sub_county?: string;
  department?: string;
  ward?: string;
}

const getFrappeImageUrl = (imagePath: string | null | undefined): string => {
  // No image in Frappe - return empty string
  if (!imagePath) {
    return "";  // ← Return empty instead of Unsplash fallback
  }

  // Only accept local Frappe files
  if (!imagePath.startsWith('/files/')) {
    return "";  // Ignore external URLs
  }

  // Build full URL for Frappe files
  const fullUrl = `${REMOTE_URL}${imagePath}`;
  console.log(`Image URL generated: ${fullUrl}`);
  return fullUrl;
};

/**
 * Map Frappe status to local ProjectStatus enum
 */
const mapFrappeStatus = (status: string): ProjectStatus => {
  if (!status) return ProjectStatus.PLANNING;
  
  const s = status.toLowerCase().trim();
  
  if (s === 'completed' || s.includes('complete')) return ProjectStatus.COMPLETED;
  if (s === 'ongoing' || s.includes('ongoing')) return ProjectStatus.ONGOING;
  if (s === 'stalled' || s.includes('stall')) return ProjectStatus.STALLED;
  if (s === 'planning' || s.includes('plan')) return ProjectStatus.PLANNING;
  if (s === 'not started' || s.includes('not')) return ProjectStatus.NOT_STARTED;
  
  return ProjectStatus.PLANNING;
};

/**
 * Transform Frappe project to local Project format
 */
const transformFrappeProject = (fp: FrappeProject): Project => {
  const imageUrl = getFrappeImageUrl(fp.image, fp.department);
  console.log(`Project ${fp.name} image:`, imageUrl); 
  
  return {
    id: fp.name, // Frappe document ID
    title: fp.project_name,
    description: fp.scope_of_work || 'No description provided',
    department: fp.department,
    subCounty: fp.sub_county,
    ward: fp.ward,
    financialYear: fp.financial_year,
    budget: fp.amount || 0,
    progress: fp.progress || 0,
    expenditure: 0, // Add this field to Frappe if needed
    status: mapFrappeStatus(fp.status),
    contractor: fp.contractor || 'TBD',
    startDate: new Date().toISOString().split('T')[0], // Add to Frappe if needed
    endDate: new Date(Date.now() + 31536000000).toISOString().split('T')[0],
    pmcMembers: [],
    // images: [getFrappeImageUrl(fp.image, fp.department)],
    images: imageUrl ? [imageUrl] : [],
  };
};


/**
 * Fetch all projects from Frappe using the built-in Resource API with pagination
 * This ensures ALL projects are fetched, not just the first 400/500
 */
export const fetchFrappeProjects = async (
  filters?: FrappeFilters,
  pageSize: number = 500 // Frappe's typical max per page
): Promise<Project[]> => {
  try {
    let allProjects: FrappeProject[] = [];
    let start = 0;
    let hasMore = true;

    // Build filters once
    const frappeFilters: any[] = [];
    if (filters) {
      if (filters.status) frappeFilters.push(["status", "=", filters.status]);
      if (filters.financial_year) frappeFilters.push(["financial_year", "=", filters.financial_year]);
      if (filters.sub_county) frappeFilters.push(["sub_county", "=", filters.sub_county]);
      if (filters.department) frappeFilters.push(["department", "=", filters.department]);
      if (filters.ward) frappeFilters.push(["ward", "=", filters.ward]);
    }

    // Keep fetching until we get all records
    while (hasMore) {
      const params = new URLSearchParams({
        fields: JSON.stringify(["*"]),
        limit_start: String(start),
        limit_page_length: String(pageSize),
        order_by: "creation desc"
      });

      if (frappeFilters.length > 0) {
        params.append('filters', JSON.stringify(frappeFilters));
      }

      const response = await fetch(
        `${REMOTE_URL}/api/resource/Project Investments?${params}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `token ${API_KEY}:${API_SECRET}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Frappe API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const batch = result.data || [];
      
      allProjects = allProjects.concat(batch);
      
      // If we got fewer results than page size, we've reached the end
      hasMore = batch.length === pageSize;
      start += pageSize;

      console.log(`Fetched ${batch.length} projects (total so far: ${allProjects.length})`);
    }

    return allProjects.map(transformFrappeProject);
    
  } catch (error) {
    console.error('Frappe API Error:', error);
    throw error;
  }
};

/**
 * Fetch single project by ID from Frappe using the built-in Resource API 
 */
export const fetchFrappeProjectById = async (id: string): Promise<Project | null> => {
  try {
    const response = await fetch(
      `${REMOTE_URL}/api/resource/Project Investments/${id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `token ${API_KEY}:${API_SECRET}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const result = await response.json();
    return transformFrappeProject(result.data); // single record is in result.data
  } catch (error) {
    console.error('Frappe fetch by ID error:', error);
    return null;
  }
};


/**
 * Fetch projects by financial year
 */
export const fetchFrappeProjectsByYear = async (
  financialYear: string
): Promise<Project[]> => {
  return fetchFrappeProjects({ financial_year: financialYear });
};

/**
 * Fetch projects by sub-county
 */
export const fetchFrappeProjectsBySubCounty = async (
  subCounty: string
): Promise<Project[]> => {
  return fetchFrappeProjects({ sub_county: subCounty });
};

/**
 * Fetch projects by status
 */
export const fetchFrappeProjectsByStatus = async (
  status: string
): Promise<Project[]> => {
  return fetchFrappeProjects({ status });
};

/**
 * Fetch and put user feedback from frappe to reactAPP
 */

export const submitFeedbackToFrappe = async (payload: {
  full_name: string;
  phone:string;
  email: string;
  comment: string;
  rating: number;
  project: string; // This is the frappe document ID
}): Promise<boolean> => {
  try {
    const response = await fetch(
      `${REMOTE_URL}/api/resource/Project Feedback`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${API_KEY}:${API_SECRET}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Feedback submission error:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('Feedback submission result:', result);
    return true;
  } catch (error) {
    console.error('Error submitting feedback to Frappe:', error);
    return false;
  }
};

  
export default {
  fetchFrappeProjects,
  fetchFrappeProjectById,
  fetchFrappeProjectsByYear,
  fetchFrappeProjectsBySubCounty,
  fetchFrappeProjectsByStatus,
  submitFeedbackToFrappe,
};