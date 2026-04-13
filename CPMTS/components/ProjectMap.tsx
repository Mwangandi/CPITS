
import React, { useEffect, useRef } from 'react';
import { Project, ProjectStatus } from '../types';
import { SUB_COUNTY_COORDS } from '../constants';
import { useNavigate } from 'react-router-dom';

interface ProjectMapProps {
  projects: Project[];
}

const ProjectMap: React.FC<ProjectMapProps> = ({ projects }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const navigate = useNavigate();

  // Color mapping based on status
  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED: return '#00843D'; // Green
      case ProjectStatus.ONGOING: return '#003399'; // Navy
      case ProjectStatus.STALLED: return '#F37021'; // Orange
      case ProjectStatus.NOT_STARTED: return '#64748b'; // Slate
      default: return '#1e293b';
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize Leaflet Map centered on Taita Taveta County
    const center = { lat: -3.4, lng: 38.3 };
    
    // @ts-ignore - Leaflet is loaded via script tag in index.html
    const L = window.L;
    if (!L) return;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: 9,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(leafletMap.current);
    }

    // Clear existing markers
    leafletMap.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        leafletMap.current.removeLayer(layer);
      }
    });

    // Add markers for projects
    projects.forEach((project) => {
      // Use project coordinates or fallback to sub-county centers with small random jitter
      let lat = project.latitude;
      let lng = project.longitude;

      if (!lat || !lng) {
        const subCountyCenter = SUB_COUNTY_COORDS[project.subCounty as keyof typeof SUB_COUNTY_COORDS] || center;
        lat = subCountyCenter.lat + (Math.random() - 0.5) * 0.05;
        lng = subCountyCenter.lng + (Math.random() - 0.5) * 0.05;
      }

      const color = getStatusColor(project.status);

      const marker = L.circleMarker([lat, lng], {
        radius: 12,
        fillColor: color,
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(leafletMap.current);

      const popupContent = `
        <div class="p-4 font-sans min-w-[200px]">
          <h3 class="font-black text-slate-800 text-lg leading-tight mb-2">${project.title}</h3>
          <div class="flex items-center gap-2 mb-3">
             <span style="background-color: ${color}" class="w-3 h-3 rounded-full"></span>
             <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">${project.status}</span>
          </div>
          <p class="text-xs text-slate-600 mb-4 line-clamp-2">${project.description}</p>
          <div class="flex justify-between items-center pt-3 border-t border-slate-100">
             <div>
               <p class="text-[9px] font-black text-slate-400 uppercase">Budget</p>
               <p class="font-black text-slate-800">KES ${(project.budget / 1000000).toFixed(1)}M</p>
             </div>
             <button id="view-btn-${project.id}" class="px-3 py-1.5 tt-bg-green text-white text-[10px] font-black rounded-lg uppercase tracking-widest hover:opacity-90 transition-opacity">View Detail</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'project-popup'
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-btn-${project.id}`);
        if (btn) {
          btn.onclick = (e) => {
            e.preventDefault();
            navigate(`/projects/${project.id}`);
          };
        }
      });
    });

    // Auto-fit bounds if we have projects
    if (projects.length > 0) {
      const group = new L.featureGroup(projects.map(p => {
        let lat = p.latitude;
        let lng = p.longitude;
        if (!lat || !lng) {
          const subCountyCenter = SUB_COUNTY_COORDS[p.subCounty as keyof typeof SUB_COUNTY_COORDS] || center;
          lat = subCountyCenter.lat;
          lng = subCountyCenter.lng;
        }
        return L.marker([lat, lng]);
      }));
      leafletMap.current.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      // No explicit destroy needed for leaflet markers as we clear them, but good practice
    };
  }, [projects, navigate]);

  return (
    <div className="project-map-container bg-slate-200 animate-fade-in relative">
      <div ref={mapRef} className="h-full w-full" />
      <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white space-y-2 text-xs font-black uppercase tracking-widest text-slate-600">
         <p className="mb-2 pb-2 border-b border-slate-200">Map Legend</p>
         <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full tt-bg-green"></div> Complete</div>
         <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full tt-bg-navy"></div> Ongoing</div>
         <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full tt-bg-orange"></div> Stalled</div>
         <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-slate-500"></div> Not Started</div>
      </div>
    </div>
  );
};

export default ProjectMap;
