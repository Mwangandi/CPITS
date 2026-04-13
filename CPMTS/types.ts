
export enum ProjectStatus {
  NOT_STARTED = 'Not Started',
  ONGOING = 'Ongoing',
  COMPLETED = 'Complete',
  STALLED = 'Stalled'
}

export enum UserRole {
  CITIZEN = 'Citizen',
  STAFF = 'Staff',
  ADMIN = 'Admin',
  SUPER_ADMIN = 'Super Admin'
}

export type Permission = 
  | 'view_dashboard' 
  | 'view_projects' 
  | 'add_project' 
  | 'edit_project' 
  | 'delete_project'
  | 'import_projects' 
  | 'manage_users' 
  | 'manage_feedback'
  | 'manage_settings';

export interface User {
  id: string;
  payrollNumber: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  department?: string;
  permissions: Permission[];
}

export interface SystemSettings {
  logoUrl?: string;
  countyName: string;
  sduEmail: string;
}

export interface PMCMember {
  id: string;
  name: string;
  role: string;
  contact?: string;
}

export interface ProjectDocument {
  id: string;
  documentType: string;
  details: string;
  attachUrl: string;
}

export interface Feedback {
  id: string;
  projectId: string;
  userName: string;
  email: string;
  comment: string;
  timestamp: string;
  rating: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  department: string;
  ward: string;
  subCounty: string;
  financialYear: string;
  budget: number;
  expenditure: number;
  status: ProjectStatus;
  progress: number; // 0-100
  contractor: string;
  startDate: string;
  endDate: string;
  pmcMembers: PMCMember[];
  images: string[];
  latitude?: number;
  longitude?: number;
}

export interface DashboardStats {
  totalProjects: number;
  totalBudget: number;
  totalExpenditure: number;
  completedProjects: number;
  ongoingProjects: number;
}
