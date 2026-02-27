
import React from 'react';
import { Project, ProjectStatus, User, UserRole } from './types';

export const DEPARTMENTS = [
  "Health Services",
  "Agriculture, Livestock & Fisheries",
  "Public Works, Transport & Energy",
  "Water, Sanitation & Environment",
  "Education, Libraries & VTCs",
  "Lands, Housing & Physical Planning",
  "Trade, Tourism & Cooperative Development"
];

// Using specific, high-reliability Unsplash IDs for departmental context
export const DEPARTMENT_IMAGES: Record<string, string> = {
  "Health Services": "https://images.unsplash.com/photo-1586773860418-d37222d8fce2?auto=format&fit=crop&q=80&w=800", 
  "Agriculture, Livestock & Fisheries": "https://images.unsplash.com/photo-1595113316349-9fa4ee24f884?auto=format&fit=crop&q=80&w=800",
  "Public Works, Transport & Energy": "https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800",
  "Water, Sanitation & Environment": "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=800",
  "Education, Libraries & VTCs": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=800",
  "Lands, Housing & Physical Planning": "https://images.unsplash.com/photo-1503387762-592dea58ef23?auto=format&fit=crop&q=80&w=800",
  "Trade, Tourism & Cooperative Development": "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&q=80&w=800"
};

export const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800";

export const getDepartmentImage = (dept: string) => DEPARTMENT_IMAGES[dept] || FALLBACK_IMAGE;

export const SUB_COUNTIES = ["Voi", "Wundanyi", "Mwatate", "Taveta"];

export const SUB_COUNTY_COORDS = {
  "Voi": { lat: -3.3945, lng: 38.5636 },
  "Wundanyi": { lat: -3.3986, lng: 38.3614 },
  "Mwatate": { lat: -3.5042, lng: 38.3783 },
  "Taveta": { lat: -3.3961, lng: 37.6781 }
};

export const WARDS = {
  "Voi": ["Voi Central", "Kaloleni", "Ngolia", "Sagalla", "Kasigau", "Marungu"],
  "Wundanyi": ["Wundanyi/Mbale", "Werugha", "Mgange", "Mwanda/Mghange"],
  "Mwatate": ["Mwatate", "Bura", "Chawia", "Wusi/Kaya", "Rong'e"],
  "Taveta": ["Chala", "Mahoo", "Bomani", "Mboghoni", "Mata"]
};

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    payrollNumber: '777001',
    name: 'Hon. Andrew Mwadime',
    email: 'governor@taitataveta.go.ke',
    phone: '0712345678',
    role: UserRole.SUPER_ADMIN,
    permissions: ['view_dashboard', 'view_projects', 'add_project', 'edit_project', 'delete_project', 'import_projects', 'manage_users', 'manage_feedback']
  },
  {
    id: 'u4',
    payrollNumber: '20210348397',
    name: 'Gilbert Kichoi',
    email: 'gilkichoi@gmail.com',
    phone: '0724030687',
    role: UserRole.SUPER_ADMIN,
    permissions: ['view_dashboard', 'view_projects', 'add_project', 'edit_project', 'delete_project', 'import_projects', 'manage_users', 'manage_feedback']
  }
];

const getJitter = () => (Math.random() - 0.5) * 0.04;

export const MOCK_PROJECTS: Project[] = [
  {
    id: "TTC-HLTH-2024-001",
    title: "Mwatate Sub-County Hospital Maternity Wing",
    description: "Construction and equipping of a modern 50-bed maternity wing to improve maternal healthcare services in Mwatate and surrounding wards.",
    department: "Health Services",
    subCounty: "Mwatate", ward: "Mwatate", financialYear: "2024/2025",
    budget: 45000000, expenditure: 12500000, status: ProjectStatus.ONGOING, progress: 28,
    contractor: "Coastal Builders Ltd", startDate: "2024-01-15", endDate: "2025-06-30",
    pmcMembers: [{ id: "pm1", name: "Dr. Catherine Mwamburi", role: "Medical Superintendent" }],
    images: [DEPARTMENT_IMAGES["Health Services"]],
    latitude: SUB_COUNTY_COORDS.Mwatate.lat + getJitter(), longitude: SUB_COUNTY_COORDS.Mwatate.lng + getJitter()
  },
  {
    id: "TTC-AGRI-2024-042",
    title: "Taveta Banana Processing Plant",
    description: "Installation of value-addition equipment including ripening chambers and processing lines to support farmers in the Taveta cluster.",
    department: "Agriculture, Livestock & Fisheries",
    subCounty: "Taveta", ward: "Mata", financialYear: "2024/2025",
    budget: 32000000, expenditure: 32000000, status: ProjectStatus.COMPLETED, progress: 100,
    contractor: "Agro-Industries KE", startDate: "2023-06-10", endDate: "2024-05-20",
    pmcMembers: [], images: [DEPARTMENT_IMAGES["Agriculture, Livestock & Fisheries"]],
    latitude: SUB_COUNTY_COORDS.Taveta.lat + getJitter(), longitude: SUB_COUNTY_COORDS.Taveta.lng + getJitter()
  },
  {
    id: "TTC-PWKS-2024-009",
    title: "Wundanyi Street Lighting Project Phase II",
    description: "Phase II of the integrated solar street lighting project for Wundanyi Town and primary market corridors for enhanced night security.",
    department: "Public Works, Transport & Energy",
    subCounty: "Wundanyi", ward: "Wundanyi/Mbale", financialYear: "2024/2025",
    budget: 15000000, expenditure: 4500000, status: ProjectStatus.ONGOING, progress: 30,
    contractor: "SunPower Solutions", startDate: "2024-03-01", endDate: "2024-09-30",
    pmcMembers: [], images: [DEPARTMENT_IMAGES["Public Works, Transport & Energy"]],
    latitude: SUB_COUNTY_COORDS.Wundanyi.lat + getJitter(), longitude: SUB_COUNTY_COORDS.Wundanyi.lng + getJitter()
  },
  {
    id: "TTC-WATR-2024-015",
    title: "Voi Water Supply Pipeline Extension",
    description: "Extension of the main distribution pipeline from Voi town to the burgeoning residential areas of Kaloleni and Ngolia wards.",
    department: "Water, Sanitation & Environment",
    subCounty: "Voi", ward: "Voi Central", financialYear: "2024/2025",
    budget: 85000000, expenditure: 52000000, status: ProjectStatus.STALLED, progress: 61,
    contractor: "Tavevo Water", startDate: "2022-11-20", endDate: "2024-12-31",
    pmcMembers: [], images: [DEPARTMENT_IMAGES["Water, Sanitation & Environment"]],
    latitude: SUB_COUNTY_COORDS.Voi.lat + getJitter(), longitude: SUB_COUNTY_COORDS.Voi.lng + getJitter()
  },
  {
    id: "TTC-EDUC-2024-002",
    title: "Renovation of Werugha Vocational Training Center",
    description: "Comprehensive modernization of training workshops for automotive and electrical courses, including installation of new training rigs.",
    department: "Education, Libraries & VTCs",
    subCounty: "Wundanyi", ward: "Werugha", financialYear: "2024/2025",
    budget: 18000000, expenditure: 0, status: ProjectStatus.NOT_STARTED, progress: 0,
    contractor: "Local Artisans Group", startDate: "2025-01-10", endDate: "2025-07-15",
    pmcMembers: [], images: [DEPARTMENT_IMAGES["Education, Libraries & VTCs"]],
    latitude: SUB_COUNTY_COORDS.Wundanyi.lat + getJitter(), longitude: SUB_COUNTY_COORDS.Wundanyi.lng + getJitter()
  },
  {
    id: "TTC-LAND-2024-011",
    title: "Mwatate Township GIS Mapping and Titling",
    description: "Digital geospatial mapping and verification of all parcels within the Mwatate township area to facilitate secure land ownership.",
    department: "Lands, Housing & Physical Planning",
    subCounty: "Mwatate", ward: "Bura", financialYear: "2024/2025",
    budget: 12500000, expenditure: 9000000, status: ProjectStatus.ONGOING, progress: 75,
    contractor: "Survey & Geomatics Ltd", startDate: "2023-09-15", endDate: "2024-08-30",
    pmcMembers: [], images: [DEPARTMENT_IMAGES["Lands, Housing & Physical Planning"]],
    latitude: SUB_COUNTY_COORDS.Mwatate.lat + getJitter(), longitude: SUB_COUNTY_COORDS.Mwatate.lng + getJitter()
  },
  {
    id: "TTC-TRAD-2024-007",
    title: "Taveta Modern Cross-Border Market",
    description: "Construction of a state-of-the-art trade facility with integrated sanitation, cold storage, and logistics bays for cross-border traders.",
    department: "Trade, Tourism & Cooperative Development",
    subCounty: "Taveta", ward: "Bomani", financialYear: "2024/2025",
    budget: 120000000, expenditure: 12000000, status: ProjectStatus.ONGOING, progress: 10,
    contractor: "East African Projects", startDate: "2024-05-01", endDate: "2026-05-01",
    pmcMembers: [], images: [DEPARTMENT_IMAGES["Trade, Tourism & Cooperative Development"]],
    latitude: SUB_COUNTY_COORDS.Taveta.lat + getJitter(), longitude: SUB_COUNTY_COORDS.Taveta.lng + getJitter()
  }
];

export const TAITA_TAVETA_LOGO_SVG = (
  <div className="w-full h-full flex items-center justify-center p-1">
    <img 
      src="https://upload.wikimedia.org/wikipedia/en/3/30/Seal_of_Taita-Taveta_County.png" 
      alt="Taita Taveta County Official Logo" 
      className="w-full h-full object-contain drop-shadow-lg"
      style={{ minWidth: '40px' }}
      loading="eager"
      onError={(e) => {
          e.currentTarget.style.display = 'none';
          const parent = e.currentTarget.parentElement;
          if (parent) {
            const svgStr = `
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="48" fill="#00843D"/>
                <circle cx="50" cy="50" r="40" fill="#FFCD00" stroke="white" stroke-width="1"/>
                <path d="M25 75 L50 25 L75 75 Z" fill="#F37021"/>
                <text x="50" y="92" font-size="5" font-family="Arial" font-weight="bold" text-anchor="middle" fill="white">TAITA TAVETA</text>
              </svg>`;
            parent.innerHTML = svgStr;
          }
      }}
    />
  </div>
);
