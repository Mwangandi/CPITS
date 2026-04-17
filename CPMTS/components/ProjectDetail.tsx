import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Project, ProjectStatus, Feedback, PMCMember, ProjectDocument } from '../types';
import { getProjectSummary } from '../services/geminiService';
import { getDepartmentImage, FALLBACK_IMAGE } from '../constants';
import { MapPin, Calendar, Building2, Users, FileText, ArrowLeft, Send, Star, Share2, Edit3, ShieldCheck, Mail, MessageCircle, Image as ImageIcon, Reply, CheckCheck, Trash2, Paperclip, X } from 'lucide-react';
import { useAuth } from './Layout';
import { fetchFrappeProjectById, submitFeedbackToFrappe, uploadFeedbackFile, fetchFeedbackByProject, fetchProjectXPMC, fetchProjectXGallery, fetchProjectXDocuments, fetchAuthenticatedImageUrl, saveFeedbackReplyToFrappe, deleteFeedbackReplyFromFrappe } from '../services/frappeAPI';
import { FrappeFeedback } from '../services/frappeAPI';
import { FeedbackReply } from './FeedbackList';

const ProjectDetail: React.FC = () => {
  // useParams()["*"] captures the full wildcard segment including slashes,
  // which is needed for Frappe IDs like "006/133/404/13-14"
  const { "*": id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [project, setProject] = useState<Project | undefined>(undefined);

  const [aiSummary, setAiSummary] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  // ↓ field names now match the ProjectX Feedback doctype exactly
  const [feedback, setFeedback] = useState({ fullName: '', phone_number: '', email: '', category: '', rating: 0, description: '' });
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeImage, setActiveImage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Fetch feedback using React Query
  const { data: projectFeedback = [], isLoading: loadingFeedback } = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => id ? fetchFeedbackByProject(id) : Promise.resolve([]),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Derive replies from Frappe data so they are globally visible
  const replies = useMemo(() => {
    const map: Record<string, FeedbackReply> = {};
    for (const f of projectFeedback) {
      if (f.staff_reply) {
        map[f.name] = { reply: f.staff_reply, repliedAt: f.replied_at ?? '', repliedBy: f.replied_by ?? '' };
      }
    }
    return map;
  }, [projectFeedback]);

  // Fetch PMC members using React Query
  const { data: pmcMembers = [], isLoading: loadingPMC, refetch: refetchPMC } = useQuery({
    queryKey: ['pmc', id],
    queryFn: () => {
      return id ? fetchProjectXPMC(id) : Promise.resolve([]);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch project documents using React Query
  const { data: projectDocuments = [], isLoading: loadingDocuments } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => {
      return id ? fetchProjectXDocuments(id) : Promise.resolve([]);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch gallery images using React Query
  const { data: galleryImages = [], isLoading: loadingGallery } = useQuery({
    queryKey: ['gallery', id],
    queryFn: () => {
      return id ? fetchProjectXGallery(id) : Promise.resolve([]);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    retryDelay: 1000,
  });

  // State for authenticated blob URLs resolved from gallery images
  const [resolvedGalleryUrls, setResolvedGalleryUrls] = useState<string[]>([]);

  // Convert private file URLs to authenticated blob URLs
  useEffect(() => {
    console.log('[ProjectDetail] galleryImages changed:', galleryImages);
    if (galleryImages.length === 0) {
      setResolvedGalleryUrls([]);
      return;
    }
    let cancelled = false;
    Promise.all(galleryImages.map(url => fetchAuthenticatedImageUrl(url, { w: 1024, q: 75 })))
      .then(urls => {
        console.log('[ProjectDetail] resolved gallery URLs:', urls);
        if (!cancelled) {
          const filtered = urls.filter(u => u !== "");
          console.log('[ProjectDetail] filtered resolved URLs:', filtered);
          setResolvedGalleryUrls(filtered);
        }
      });
    return () => { cancelled = true; };
  }, [galleryImages]);

  // Force refetch when component mounts with new project ID
  useEffect(() => {
    if (id) {
      refetchPMC();
    }
  }, [id, refetchPMC]);

  // Monitor PMC members whenever they change
  useEffect(() => {
  }, [pmcMembers]);

  // Fetch project data (independent of gallery images)
  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchFrappeProjectById(id).then(p => {
        if (p) {
          setProject(p);
        }
        setLoading(false);
      });
    }
  }, [id]);

  // Separate effect to handle image merging and active image selection
  // This runs after both project and gallery images are available
  useEffect(() => {
    if (project) {
      // Combine images: gallery images first, then project images
      const allImages: string[] = [];

      if (resolvedGalleryUrls.length > 0) {
        allImages.push(...resolvedGalleryUrls);
      }

      if (project.images && project.images.length > 0) {
        project.images.forEach(img => {
          if (!allImages.includes(img)) {
            allImages.push(img);
          }
        });
      }

      // Update project with combined images
      const updatedProject = { ...project, images: allImages };
      setProject(updatedProject);

      // Set active image: gallery images have priority, no fallback
      if (resolvedGalleryUrls.length > 0) {
        console.log('[ProjectDetail] setting activeImage to resolved gallery URL:', resolvedGalleryUrls[0]);
        setActiveImage(resolvedGalleryUrls[0]);
      } else if (project.images && project.images.length > 0) {
        console.log('[ProjectDetail] setting activeImage to project image:', project.images[0]);
        setActiveImage(project.images[0]);
      } else {
        console.log('[ProjectDetail] no images available, leaving empty');
        setActiveImage('');
      }
    }
  }, [project?.id, resolvedGalleryUrls]);

  // Handle reply text pre-filling and clearing — must be before early returns
  useEffect(() => {
    if (!replyingTo) {
      setReplyText('');
    } else {
      const existingReply = replies[replyingTo];
      setReplyText(existingReply ? existingReply.reply : '');
    }
  }, [replyingTo, replies]);

  if (loading) return (
    <div className="text-center py-20 animate-fade-in">
      <div className="w-6 h-6 bg-tt-green rounded-full animate-ping mx-auto mb-4"></div>
      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading project...</p>
    </div>
  );

  if (!project) return (
    <div className="text-center py-20 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-700">Project not found</h2>
      <button onClick={() => navigate('/projects')} className="mt-4 tt-bg-green text-white px-6 py-2 rounded-lg">Back to Projects</button>
    </div>
  );

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('[ProjectDetail] image failed to load:', e.currentTarget.src);
    // No fallback - leave the broken image visible for debugging
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitted(false);
    setIsSubmitting(true);

    const docName = await submitFeedbackToFrappe({
      subject: `Feedback on ${project!.title}`,
      project: project!.id,
      project_name: project!.title,
      full_name: feedback.fullName,
      phone_number: feedback.phone_number,
      email: feedback.email,
      category: feedback.category,
      rating: feedback.rating,
      description: feedback.description,
    });

    if (docName) {
      if (attachFile) {
        await uploadFeedbackFile(docName, attachFile);
      }
      queryClient.refetchQueries({ queryKey: ['feedback', id] });
      setFeedback({ fullName: '', phone_number: '', email: '', category: '', rating: 0, description: '' });
      setAttachFile(null);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    } else {
      setSubmitError('Submission failed. Please try again.');
    }

    setIsSubmitting(false);
  };

  const handleSubmitReply = async (feedbackName: string) => {
    if (!replyText.trim()) return;
    if (!user) return;

    const replyData: FeedbackReply = {
      reply: replyText.trim(),
      repliedAt: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
      repliedBy: user.name || user.email,
    };

    const saved = await saveFeedbackReplyToFrappe(feedbackName, replyData);
    if (saved) queryClient.refetchQueries({ queryKey: ['feedback', id] });
    setReplyingTo(null);
    setReplyText('');
  };

  const handleDeleteReply = async (feedbackName: string) => {
    if (!window.confirm('Delete this reply?')) return;
    const cleared = await deleteFeedbackReplyFromFrappe(feedbackName);
    if (cleared) queryClient.refetchQueries({ queryKey: ['feedback', id] });
  };

  const getStatusStyles = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED: return 'tt-bg-green text-white';
      case ProjectStatus.ONGOING: return 'bg-tt-navy text-white';
      case ProjectStatus.STALLED: return 'tt-bg-orange text-white';
      case ProjectStatus.NOT_STARTED: return 'bg-slate-500 text-white';
      default: return 'bg-slate-700 text-white';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 md:space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-3 text-slate-400 hover:text-green-600 font-black text-xs uppercase tracking-widest transition-all group">
          <div className="p-2 bg-white border border-slate-100 rounded-xl group-hover:tt-bg-green group-hover:text-white transition-all shadow-sm"><ArrowLeft size={18} /></div>
          Back to Project Inventory
        </button>
        <div className="flex items-center gap-4">
          {hasPermission('edit_project') && (
            <button onClick={() => navigate(`/projects/${id}/edit`)} className="flex items-center gap-2 tt-bg-navy text-white px-6 py-3 rounded-2xl font-black hover:scale-[1.02] shadow-xl shadow-blue-100 transition-all active:scale-95"><Edit3 size={18} /> Modify Profile</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8 md:gap-10">
        <div className="lg:col-span-3 space-y-6 sm:space-y-8 md:space-y-10">
          {/* Gallery Section */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="relative h-[200px] sm:h-[300px] md:h-[400px] w-full rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] overflow-hidden group">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={handleImageError}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                  <p className="text-sm font-bold">No image available</p>
                </div>
              )}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
                <span className="bg-white/90 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-800 shadow-lg border border-white">
                  Site Visual Capture
                </span>
              </div>
            </div>
            {project.images && project.images.length > 1 && (
              <div className="flex gap-2 sm:gap-4 mt-4 sm:mt-6 px-2 sm:px-4 pb-2 sm:pb-4 overflow-x-auto scrollbar-hide">
                {project.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(img)}
                    className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl overflow-hidden border-4 transition-all ${activeImage === img ? 'tt-border-green scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" onError={handleImageError} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-4 sm:p-6 md:p-10 rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-3 h-full ${project.status === ProjectStatus.COMPLETED ? 'tt-bg-green' : project.status === ProjectStatus.ONGOING ? 'bg-tt-navy' : 'tt-bg-orange'}`}></div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <span className="px-4 py-1.5 tt-bg-yellow text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">{project.department}</span>
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${getStatusStyles(project.status)}`}>{project.status}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 mb-4 sm:mb-6 md:mb-8 leading-tight tracking-tight">{project.title}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-10">
              {project.projectNumber && (
                <DetailItem icon={<FileText size={20} />} label="Project Number" value={project.projectNumber} />
              )}
              <DetailItem icon={<MapPin size={20} />} label="Ward" value={project.ward || '—'} />
              <DetailItem icon={<Building2 size={20} />} label="Department" value={project.department || '—'} />
              <DetailItem icon={<Calendar size={20} />} label="Financial Year" value={project.financialYear || '—'} />
              <DetailItem icon={<Building2 size={20} />} label="Contracting Firm" value={project.contractor} />
              {project.startDate && (
                <DetailItem icon={<Calendar size={20} />} label="Start Date" value={new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
              )}
              {project.endDate && (
                <DetailItem icon={<Calendar size={20} />} label="End Date" value={new Date(project.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
              )}
              {project.sourceOfFunds && project.sourceOfFunds.length > 0 && (
                <div className="sm:col-span-2">
                  <DetailItem icon={<FileText size={20} />} label="Source of Funds" value={project.sourceOfFunds.join(' · ')} />
                </div>
              )}
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest text-xs">Project Narrative</h3>
              <p className="text-slate-600 leading-relaxed font-medium text-lg">{project.description}</p>
            </div>
            <div className="mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-8 md:pt-10 border-t border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl tt-bg-green flex items-center justify-center text-white shadow-lg shadow-green-100"><Star size={24} fill="white" /></div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">SDU Intelligence Report</h3>
              </div>
              <div className="bg-green-50/50 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2rem] border-2 border-green-100/50 italic text-green-900 text-sm sm:text-base leading-relaxed font-bold">
                {loadingAi ? <div className="flex items-center gap-3"><div className="w-4 h-4 bg-tt-green rounded-full animate-ping"></div> Generating status analysis...</div> : aiSummary}
              </div>
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6 md:p-10 rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 mb-4 sm:mb-6 md:mb-8 flex items-center gap-3 sm:gap-4"><div className="p-2.5 sm:p-3 tt-bg-navy text-white rounded-xl sm:rounded-2xl"><FileText size={20} /></div> Project Documents ({projectDocuments.length})</h3>
            {loadingDocuments ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 bg-tt-green rounded-full animate-ping mx-auto mb-4"></div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading documents...</p>
              </div>
            ) : projectDocuments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No documents available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projectDocuments.map((doc) => (
                  <div key={doc.id} className="p-4 sm:p-6 rounded-xl sm:rounded-[2rem] bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-lg transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center flex-shrink-0">
                        <FileText size={20} className="text-tt-navy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 text-base leading-tight">{doc.documentType || 'Document'}</p>
                        {doc.details && (
                          <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">{doc.details}</p>
                        )}
                        {doc.attachUrl && (
                          doc.attachUrl.startsWith('/private/') ? (
                            <button
                              onClick={async () => {
                                try {
                                  const blobUrl = await fetchAuthenticatedImageUrl(doc.attachUrl);
                                  if (blobUrl) {
                                    window.open(blobUrl, '_blank');
                                  } else {
                                    alert('Unable to load document. Please try again.');
                                  }
                                } catch {
                                  alert('Unable to load document. Please try again.');
                                }
                              }}
                              className="inline-flex items-center gap-2 mt-3 text-xs font-black uppercase tracking-widest tt-green hover:underline cursor-pointer bg-transparent border-none"
                            >
                              <FileText size={14} /> View / Download
                            </button>
                          ) : (
                            <a
                              href={doc.attachUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 mt-3 text-xs font-black uppercase tracking-widest tt-green hover:underline"
                            >
                              <FileText size={14} /> View / Download
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback Display Section */}
          <div className="bg-white p-4 sm:p-6 md:p-10 rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 mb-4 sm:mb-6 md:mb-8 flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 tt-bg-navy text-white rounded-xl sm:rounded-2xl"><MessageCircle size={20} /></div>
              Citizen Feedback ({projectFeedback.length})
            </h3>
            {loadingFeedback ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 bg-tt-green rounded-full animate-ping mx-auto mb-4"></div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading feedback...</p>
              </div>
            ) : projectFeedback.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No feedback yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projectFeedback.map((item) => {
                  const reply = replies[item.name];
                  const isReplying = replyingTo === item.name;
                  return (
                    <div key={item.name} className={`rounded-xl border overflow-hidden transition-all ${reply ? 'bg-white border-slate-100' : 'bg-amber-50/40 border-amber-100'}`}>
                      <div className="p-4 sm:p-5 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl tt-bg-navy text-white flex items-center justify-center font-black text-base flex-shrink-0">
                              {item.full_name?.charAt(0).toUpperCase() ?? '?'}
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-sm">{item.full_name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {item.creation ? new Date(item.creation).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {item.category && (
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{item.category}</span>
                            )}
                            {reply ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-green-100 text-green-700">
                                <CheckCheck size={10} /> Replied
                              </span>
                            ) : user ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                                Pending
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Feedback text */}
                        <div className="relative p-3 sm:p-4 bg-slate-50 rounded-xl italic text-slate-600 font-medium border-l-4 border-tt-green text-sm">
                          <p className="leading-relaxed">"{item.description}"</p>
                        </div>

                        {/* Attached image */}
                        {item.attachment && (
                          <a href={item.attachment} target="_blank" rel="noopener noreferrer">
                            <img
                              src={item.attachment}
                              alt="Attached evidence"
                              className="w-full max-h-56 object-cover rounded-xl border border-slate-100 hover:opacity-90 transition-opacity cursor-pointer"
                            />
                          </a>
                        )}

                        {/* Existing reply */}
                        {reply && (
                          <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                            <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                              <Reply size={11} /> Official Response
                            </p>
                            <p className="text-sm text-slate-700 font-medium leading-relaxed">{reply.reply}</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-1.5">{reply.repliedAt} · {reply.repliedBy}</p>
                          </div>
                        )}

                        {/* Inline reply form */}
                        {isReplying && (
                          <div className="space-y-2">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Type your official response..."
                              rows={3}
                              className="w-full px-4 py-3 rounded-xl border-2 border-tt-green bg-white text-sm font-medium text-slate-700 outline-none resize-none focus:shadow-sm transition-all"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSubmitReply(item.name)}
                                disabled={!replyText.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl tt-bg-green text-white text-[11px] font-black uppercase tracking-widest shadow-md shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
                              >
                                <Send size={13} /> Send Reply
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action bar */}
                        {user && !isReplying && (
                          <div className="flex justify-end gap-1.5 pt-1">
                            {reply && (
                              <button
                                onClick={() => handleDeleteReply(item.name)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            )}
                            <button
                              onClick={() => setReplyingTo(item.name)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reply
                                ? 'text-slate-400 hover:text-tt-green hover:bg-slate-50'
                                : 'tt-bg-navy text-white shadow-md hover:scale-[1.02]'
                                }`}
                            >
                              <Reply size={12} /> {reply ? 'Edit' : 'Reply'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          <div className="bg-white p-4 sm:p-6 md:p-10 rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 lg:sticky lg:top-32">
            <div className="space-y-6 sm:space-y-8 md:space-y-10">
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Project Budget</p><p className="font-black text-slate-800 text-xl tracking-tight">KES {(project.budget / 1000000).toFixed(1)}M</p></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Certified Exp.</p><p className="font-black tt-navy text-xl tracking-tight">KES {(project.expenditure / 1000000).toFixed(1)}M</p></div>
              </div>
              <div className="pt-4 sm:pt-6 md:pt-8 border-t border-slate-100">
                <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><MessageCircle className="tt-green" size={20} /> Public Feedback</h4>
                {/* Feedback Submission Form */}
                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all"
                    value={feedback.fullName}
                    onChange={e => setFeedback({ ...feedback, fullName: e.target.value })}
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone Number"
                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all"
                    value={feedback.phone_number}
                    onChange={e => setFeedback({ ...feedback, phone_number: e.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Email Address (optional)"
                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all"
                    value={feedback.email}
                    onChange={e => setFeedback({ ...feedback, email: e.target.value })}
                  />
                  <select
                    required
                    className={`w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all appearance-none cursor-pointer ${!feedback.category ? 'text-slate-400' : ''}`}
                    value={feedback.category}
                    onChange={e => setFeedback({ ...feedback, category: e.target.value })}
                  >
                    <option value="" disabled>Choose feedback category..</option>
                    <option value="General Feedback">General Feedback</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Stalled">Stalled</option>
                    <option value="Suspected Misuse">Suspected Misuse</option>
                    <option value="Community Request">Community Request</option>
                  </select>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rate this project</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setFeedback({ ...feedback, rating: star })}
                          className="p-1 transition-transform hover:scale-125"
                        >
                          <Star
                            size={28}
                            className={`transition-colors ${star <= (hoverRating || feedback.rating)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-slate-200'
                              }`}
                          />
                        </button>
                      ))}
                      {feedback.rating > 0 && (
                        <span className="ml-2 text-xs font-bold text-slate-400 self-center">{feedback.rating}/5</span>
                      )}
                    </div>
                  </div>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter your observations..."
                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none resize-none transition-all"
                    value={feedback.description}
                    onChange={e => setFeedback({ ...feedback, description: e.target.value })}
                  />

                  {/* Image attachment */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 flex items-center gap-1.5">
                      <Paperclip size={11} /> Attach Image (optional)
                    </label>
                    {attachFile ? (
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-green-50 border-2 border-green-200 text-sm">
                        <span className="font-bold text-slate-700 truncate max-w-[200px]">{attachFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachFile(null)}
                          className="ml-2 text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-tt-green cursor-pointer transition-all">
                        <ImageIcon size={18} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-400">Choose photo…</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => setAttachFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    )}
                  </div>

                  {submitError && (
                    <p className="text-xs font-bold text-rose-500">{submitError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submitted || isSubmitting}
                    className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl ${submitted
                      ? 'bg-green-50 text-tt-green border border-green-200'
                      : 'tt-bg-green text-white shadow-green-100 hover:scale-[1.02] active:scale-95'
                      }`}
                  >
                    {submitted ? (
                      <><ShieldCheck size={20} /> Feedback Sent!</>
                    ) : isSubmitting ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
                    ) : (
                      <><Send size={18} /> Submit Report</>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-4 p-5 rounded-[2rem] bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
    <div className="text-slate-300 mt-1 transition-colors group-hover:tt-green">{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-base font-black text-slate-800 tracking-tight">{value}</p>
    </div>
  </div>
);

export default ProjectDetail;