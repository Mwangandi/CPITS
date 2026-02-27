
import { Project, ProjectStatus } from '../types';
import { DEPARTMENTS, SUB_COUNTIES, WARDS, getDepartmentImage } from '../constants';

const REMOTE_API_URL = 'http://45.90.123.75:8002/dashboard/project/search';

export const fetchRemoteProjectsByFY = async (financialYear: string): Promise<Project[]> => {
  try {
    const response = await fetch(REMOTE_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    // Our data is here
    const rawData = await response.json();
    
    // Get an array of the data - it might be directly an array or nested in 'data' or 'results'
    const projectsList = Array.isArray(rawData) ? rawData : (rawData.data || rawData.results || []);

    return projectsList
      .filter((p: any) => {
        const fy = p.financial_year || p.fy || p.year;
        return fy === financialYear;
      })
      .map((p: any): Project => {
        const localDept = mapToLocalDepartment(p.department || p.sector);
        return {
          id: p.id?.toString() || `rem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: p.project_name || p.title || "Untitled Remote Project",
          description: p.project_description || p.description || "No description provided from remote server.",
          department: localDept,
          subCounty: mapToLocalSubCounty(p.sub_county || p.region),
          ward: p.ward || "General",
          financialYear: financialYear,
          budget: parseFloat(p.approved_budget || p.amount || 0),
          expenditure: parseFloat(p.expenditure || p.disbursement || 0),
          status: mapToLocalStatus(p.status || p.project_status),
          progress: parseInt(p.completion_percentage || p.progress || 0),
          contractor: p.contractor_name || p.contractor || "TBD",
          startDate: p.start_date || new Date().toISOString().split('T')[0],
          endDate: p.end_date || new Date(Date.now() + 31536000000).toISOString().split('T')[0],
          pmcMembers: [],
          images: [getDepartmentImage(localDept)]
        };
      });
  } catch (error) {
    console.error("API Fetch Error:", error);
    throw error;
  }
};

const mapToLocalDepartment = (dept: string): string => {
  if (!dept) return DEPARTMENTS[0];
  const found = DEPARTMENTS.find(d => d.toLowerCase().includes(dept.toLowerCase()));
  return found || DEPARTMENTS[0];
};

const mapToLocalSubCounty = (sc: string): string => {
  if (!sc) return SUB_COUNTIES[0];
  const found = SUB_COUNTIES.find(s => s.toLowerCase().includes(sc.toLowerCase()));
  return found || SUB_COUNTIES[0];
};

const mapToLocalStatus = (status: string): ProjectStatus => {
  if (!status) return ProjectStatus.PLANNING;
  const s = status.toLowerCase();
  if (s.includes('complete')) return ProjectStatus.COMPLETED;
  if (s.includes('ongoing') || s.includes('active')) return ProjectStatus.ONGOING;
  if (s.includes('stall')) return ProjectStatus.STALLED;
  if (s.includes('plan')) return ProjectStatus.PLANNING;
  return ProjectStatus.NOT_STARTED;
};
