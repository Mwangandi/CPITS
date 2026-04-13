
import React from 'react';
import { Project, ProjectStatus, User, UserRole } from './types';
import logoImage from './images/logo.png';

export const DEPARTMENTS = [
  "Agriculture, Livestock, Irrigation, Cooperatives and Blue Economy",
  "County Public Service Board",
  "Education, Libraries and VTCs",
  "Health Services",
  "Lands, Physical Planning, Mining and Urban Development",
  "Public Works, Housing, Roads, Transport, Energy and Infrastructure",
  "Trade, Tourism, Culture and Industrialization",
  "Water, Sanitation, Environment, Climate Change and Natural Resources",
  "Youth, Sports, Gender and Social Services"
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

export const SUB_COUNTY_WARDS: Record<string, string[]> = {
  "Voi": ["Kaloleni", "Kasigau", "Mbololo", "Ngolia", "Sagala"],
  "Wundanyi": ["Mwanda/Mgange", "Wumingu/Kishushe", "Wundanyi/Mbale"],
  "Mwatate": ["Bura", "Chawia", "Mwatate", "Ronge", "Wusi/Kishamba"],
  "Taveta": ["Bomeni", "Chala", "Mahoo", "Mata", "Mboghoni"],
};

export const SUB_COUNTY_COORDS = {
  "Voi": { lat: -3.3945, lng: 38.5636 },
  "Wundanyi": { lat: -3.3986, lng: 38.3614 },
  "Mwatate": { lat: -3.5042, lng: 38.3783 },
  "Taveta": { lat: -3.3961, lng: 37.6781 }
};

export const WARDS = {
  "Voi": ["Kaloleni", "Kasigau", "Marungu", "Ngolia", "Sagalla", "Voi Central"],
  "Wundanyi": ["Mgange", "Mwanda/Mghange", "Werugha", "Wundanyi/Mbale"],
  "Mwatate": ["Bura", "Chawia", "Mwatate", "Rong'e", "Wusi/Kaya"],
  "Taveta": ["Bomani", "Chala", "Mahoo", "Mata", "Mboghoni"]
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
  },
  {
    id: 'u2',
    payrollNumber: '11223344',
    name: 'Patterson Roge',
    email: 'pattersonroge12@gmail.com',
    phone: '0795752053',
    role: UserRole.SUPER_ADMIN,
    permissions: ['view_dashboard', 'view_projects', 'add_project', 'edit_project', 'delete_project', 'import_projects', 'manage_users', 'manage_feedback']
  }
];

const getJitter = () => (Math.random() - 0.5) * 0.04;

export const TAITA_TAVETA_LOGO_SVG = (
  <img
    src={logoImage}
    alt="Taita Taveta County Official Logo"
    className="w-full h-full object-contain drop-shadow-lg"
    loading="eager"
  />
);
