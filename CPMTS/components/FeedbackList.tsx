import React, { useState, useEffect, useMemo } from 'react';
import { FrappeFeedback, fetchAllFeedback, saveFeedbackReplyToFrappe, deleteFeedbackReplyFromFrappe } from '../services/frappeAPI';
import { analyzeFeedback } from '../services/geminiService';
import {
  MessageSquare, Search, BrainCircuit, Loader2,
  ArrowRight, Quote, CheckCircle2, AlertCircle,
  Building2, ChevronDown, ChevronUp, FolderOpen,
  Reply, Send, CheckCheck, Clock, Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from './Layout';

// ─── types ───────────────────────────────────────────────────────────────────
interface ProjectGroup {
  projectId: string;
  projectName: string;
  items: FrappeFeedback[];
}

// ─── Reply helpers (shared with ProjectDetail) ────────────────────────────────
export interface FeedbackReply {
  reply: string;
  repliedAt: string;
  repliedBy: string;
}

// Build a replies map from fetched feedback items (Frappe-stored replies)
export function buildRepliesFromFeedback(feedbacks: FrappeFeedback[]): Record<string, FeedbackReply> {
  const map: Record<string, FeedbackReply> = {};
  for (const f of feedbacks) {
    if (f.staff_reply) {
      map[f.name] = { reply: f.staff_reply, repliedAt: f.replied_at ?? '', repliedBy: f.replied_by ?? '' };
    }
  }
  return map;
}

// Kept for backward compat — no longer reads localStorage
export function loadFeedbackReplies(): Record<string, FeedbackReply> { return {}; }

export function deleteFeedbackReply(_feedbackName: string) { /* no-op — use deleteFeedbackReplyFromFrappe */ }

// ─── helpers ─────────────────────────────────────────────────────────────────

// Deduplicate items: collapse identical (full_name + description) into one,
// keeping the one with a reply if any, otherwise the most recent.
function deduplicateItems(
  items: FrappeFeedback[],
  replies: Record<string, FeedbackReply> = {}
): Array<FrappeFeedback & { dupeCount: number }> {
  const seen = new Map<string, FrappeFeedback & { dupeCount: number }>();
  for (const f of items) {
    const key = `${(f.full_name ?? '').trim().toLowerCase()}||${(f.description ?? '').trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, { ...f, dupeCount: 1 });
    } else {
      const existing = seen.get(key)!;
      existing.dupeCount += 1;
      // Prefer the one with a reply
      if (!replies[existing.name] && replies[f.name]) {
        seen.set(key, { ...f, dupeCount: existing.dupeCount });
      }
    }
  }
  return Array.from(seen.values());
}

function groupByProject(feedbacks: FrappeFeedback[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const f of feedbacks) {
    const key = f.project ?? '__unknown__';
    if (!map.has(key)) {
      map.set(key, { projectId: key, projectName: f.project_name ?? key, items: [] });
    }
    map.get(key)!.items.push(f);
  }
  // Sort groups so the project with the most recent feedback appears first (LIFO)
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    const aDate = a.items[0]?.creation ?? '';
    const bDate = b.items[0]?.creation ?? '';
    return bDate.localeCompare(aDate);
  });
  return groups;
}

// Sort for admin: unreplied first (newest first), then replied (newest first)
function sortForAdmin(items: FrappeFeedback[], replies: Record<string, FeedbackReply>): FrappeFeedback[] {
  const unreplied = items
    .filter(f => !replies[f.name])
    .sort((a, b) => (b.creation ?? '').localeCompare(a.creation ?? ''));
  const replied = items
    .filter(f => !!replies[f.name])
    .sort((a, b) => (b.creation ?? '').localeCompare(a.creation ?? ''));
  return [...unreplied, ...replied];
}

function groupAndSortAdmin(items: FrappeFeedback[], replies: Record<string, FeedbackReply>): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const f of items) {
    const key = f.project ?? '__unknown__';
    if (!map.has(key)) {
      map.set(key, { projectId: key, projectName: f.project_name ?? key, items: [] });
    }
    map.get(key)!.items.push(f);
  }
  const groups = Array.from(map.values());
  // Sort within each group
  for (const g of groups) g.items = sortForAdmin(g.items, replies);
  // Sort groups: groups with unreplied first, by most recent unreplied
  groups.sort((a, b) => {
    const aHasUnreplied = a.items.some(f => !replies[f.name]);
    const bHasUnreplied = b.items.some(f => !replies[f.name]);
    if (aHasUnreplied && !bHasUnreplied) return -1;
    if (!aHasUnreplied && bHasUnreplied) return 1;
    const aDate = a.items[0]?.creation ?? '';
    const bDate = b.items[0]?.creation ?? '';
    return bDate.localeCompare(aDate);
  });
  return groups;
}

// ─── sub-components ──────────────────────────────────────────────────────────

const FeedbackCard: React.FC<{ f: FrappeFeedback; reply?: FeedbackReply; dupeCount?: number }> = ({ f, reply, dupeCount }) => (
  <div className="bg-white rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 overflow-hidden shadow-md hover:shadow-xl transition-all group">
    <div className="p-4 sm:p-5 md:p-7 space-y-3 sm:space-y-4 md:space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl tt-bg-navy text-white flex items-center justify-center font-black text-lg flex-shrink-0">
          {f.full_name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="font-black text-slate-800">{f.full_name}</p>
          {f.creation && (
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              {new Date(f.creation).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
          {dupeCount && dupeCount > 1 && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{dupeCount} similar submissions</p>
          )}
        </div>
      </div>

      <div className="relative p-3 sm:p-4 md:p-5 bg-slate-50 rounded-xl sm:rounded-2xl italic text-slate-600 font-medium border-l-4 border-tt-green">
        <Quote className="absolute -top-2 -left-2 text-slate-100" size={36} />
        <p className="relative z-10 leading-relaxed">"{f.description}"</p>
      </div>

      {f.attachment && (
        <a href={f.attachment} target="_blank" rel="noopener noreferrer">
          <img
            src={f.attachment}
            alt="Attached evidence"
            className="w-full max-h-56 object-cover rounded-xl sm:rounded-2xl border border-slate-100 hover:opacity-90 transition-opacity cursor-pointer"
          />
        </a>
      )}

      {reply && (
        <div className="p-3 sm:p-4 bg-green-50 rounded-xl sm:rounded-2xl border border-green-100">
          <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Reply size={11} /> Official Response
          </p>
          <p className="text-sm text-slate-700 font-medium leading-relaxed">{reply.reply}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-1.5">{reply.repliedAt}</p>
        </div>
      )}

      <div className="pt-3 border-t border-slate-50 flex justify-end">
        <Link
          to={`/projects/${f.project}`}
          className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-tt-green transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Visit Project Page
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  </div>
);

interface ProjectGroupCardProps {
  group: ProjectGroup;
  searchTerm: string;
  defaultOpen: boolean;
  replies: Record<string, FeedbackReply>;
}

const ProjectGroupCard: React.FC<ProjectGroupCardProps> = ({ group, searchTerm, defaultOpen, replies }) => {
  const [open, setOpen] = useState(defaultOpen);

  const dedupedItems = useMemo(() => deduplicateItems(group.items, replies), [group.items, replies]);

  const visibleItems = useMemo(() => {
    if (!searchTerm) return dedupedItems;
    const q = searchTerm.toLowerCase();
    return dedupedItems.filter(
      (f) =>
        f.description?.toLowerCase().includes(q) ||
        f.full_name?.toLowerCase().includes(q),
    );
  }, [dedupedItems, searchTerm]);

  const totalRaw = group.items.length;
  const totalDeduped = dedupedItems.length;
  const collapsed = totalRaw - totalDeduped;

  if (visibleItems.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 sm:gap-4 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl tt-bg-navy flex items-center justify-center flex-shrink-0">
            <FolderOpen size={20} className="text-tt-green" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-slate-800 text-base truncate">{group.projectName}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              {totalDeduped} submission{totalDeduped !== 1 ? 's' : ''}{collapsed > 0 ? ` (${collapsed} duplicate${collapsed !== 1 ? 's' : ''} hidden)` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            to={`/projects/${group.projectId}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-tt-green transition-colors"
          >
            <Building2 size={13} />
            View Project
          </Link>
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-8 md:pb-8 space-y-3 sm:space-y-4 md:space-y-5 border-t border-slate-50 pt-4 sm:pt-5 md:pt-6">
          {visibleItems.map((f) => (
            <FeedbackCard key={f.name} f={f} reply={replies[f.name]} dupeCount={f.dupeCount} />
          ))}
        </div>
      )}
    </div>
  );
};

const StandardItem: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
    {icon}
    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{text}</span>
  </div>
);

// ─── Admin feedback card (with reply mechanism) ───────────────────────────────

interface AdminFeedbackCardProps {
  f: FrappeFeedback;
  replies: Record<string, FeedbackReply>;
  onReply: (feedbackName: string, replyText: string) => void;
  onDeleteReply: (feedbackName: string) => void;
  replyingTo: string | null;
  setReplyingTo: (name: string | null) => void;
}

const AdminFeedbackCard: React.FC<AdminFeedbackCardProps> = ({ f, replies, onReply, onDeleteReply, replyingTo, setReplyingTo }) => {
  const [replyText, setReplyText] = useState('');
  const existingReply = replies[f.name];
  const isReplying = replyingTo === f.name;

  // Pre-fill with existing reply when opening edit
  useEffect(() => {
    if (isReplying && existingReply) {
      setReplyText(existingReply.reply);
    } else if (!isReplying) {
      setReplyText('');
    }
  }, [isReplying]);

  const handleSubmit = () => {
    if (!replyText.trim()) return;
    onReply(f.name, replyText.trim());
    setReplyText('');
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${existingReply ? 'bg-white border-slate-100' : 'bg-amber-50/40 border-amber-100'
      }`}>
      <div className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl tt-bg-navy text-white flex items-center justify-center font-black text-base flex-shrink-0">
              {f.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="font-black text-slate-800 text-sm">{f.full_name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {f.creation ? new Date(f.creation).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {f.category && (
              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{f.category}</span>
            )}
            {existingReply ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-green-100 text-green-700">
                <CheckCheck size={10} /> Replied
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                <Clock size={10} /> Pending
              </span>
            )}
          </div>
        </div>

        {/* Feedback text */}
        <div className="relative p-3 sm:p-4 bg-slate-50 rounded-xl italic text-slate-600 font-medium border-l-4 border-tt-green text-sm">
          <Quote className="absolute -top-2 -left-2 text-slate-100" size={32} />
          <p className="relative z-10 leading-relaxed">"{f.description}"</p>
        </div>

        {/* Attached image */}
        {f.attachment && (
          <a href={f.attachment} target="_blank" rel="noopener noreferrer">
            <img
              src={f.attachment}
              alt="Attached evidence"
              className="w-full max-h-52 object-cover rounded-xl border border-slate-100 hover:opacity-90 transition-opacity cursor-pointer"
            />
          </a>
        )}

        {/* Existing reply */}
        {existingReply && (
          <div className="p-3 bg-green-50 rounded-xl border border-green-100">
            <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Reply size={11} /> Staff Response
            </p>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">{existingReply.reply}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1.5">
              {existingReply.repliedAt} · {existingReply.repliedBy}
            </p>
          </div>
        )}

        {/* Reply form */}
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
                onClick={handleSubmit}
                disabled={!replyText.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl tt-bg-green text-white text-[11px] font-black uppercase tracking-widest shadow-md shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
              >
                <Send size={13} /> Send Reply
              </button>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between pt-1">
          <Link
            to={`/projects/${f.project}`}
            className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-tt-green transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Building2 size={12} /> View Project
          </Link>
          {!isReplying && (
            <div className="flex items-center gap-1.5">
              {existingReply && (
                <button
                  onClick={() => {
                    if (window.confirm('Delete this reply?')) onDeleteReply(f.name);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
              <button
                onClick={() => setReplyingTo(f.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${existingReply
                  ? 'text-slate-400 hover:text-tt-green hover:bg-slate-50'
                  : 'tt-bg-navy text-white shadow-md hover:scale-[1.02]'
                  }`}
              >
                <Reply size={12} /> {existingReply ? 'Edit' : 'Reply'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Admin project group card ─────────────────────────────────────────────────

interface AdminGroupCardProps {
  group: ProjectGroup;
  replies: Record<string, FeedbackReply>;
  onReply: (feedbackName: string, replyText: string) => void;
  onDeleteReply: (feedbackName: string) => void;
  replyingTo: string | null;
  setReplyingTo: (name: string | null) => void;
  searchTerm: string;
  defaultOpen: boolean;
}

const AdminGroupCard: React.FC<AdminGroupCardProps> = ({ group, replies, onReply, onDeleteReply, replyingTo, setReplyingTo, searchTerm, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);

  const dedupedItems = useMemo(() => deduplicateItems(group.items, replies), [group.items, replies]);
  const unrepliedCount = dedupedItems.filter(f => !replies[f.name]).length;
  const collapsed = group.items.length - dedupedItems.length;

  const visibleItems = useMemo(() => {
    if (!searchTerm) return dedupedItems;
    const q = searchTerm.toLowerCase();
    return dedupedItems.filter(f =>
      f.description?.toLowerCase().includes(q) ||
      f.full_name?.toLowerCase().includes(q)
    );
  }, [dedupedItems, searchTerm]);

  if (visibleItems.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-md">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl tt-bg-navy flex items-center justify-center flex-shrink-0">
            <FolderOpen size={16} className="text-tt-green" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-slate-800 text-sm truncate">{group.projectName}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              {dedupedItems.length} submission{dedupedItems.length !== 1 ? 's' : ''}{collapsed > 0 ? ` · ${collapsed} duplicate${collapsed !== 1 ? 's' : ''} hidden` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {unrepliedCount > 0 && (
            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
              {unrepliedCount} pending
            </span>
          )}
          {unrepliedCount === 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-green-100 text-green-700">
              <CheckCheck size={10} /> All replied
            </span>
          )}
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3 border-t border-slate-50 pt-4">
          {visibleItems.map(f => (
            <AdminFeedbackCard
              key={f.name}
              f={f}
              replies={replies}
              onReply={onReply}
              onDeleteReply={onDeleteReply}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Admin feedback view ──────────────────────────────────────────────────────

const AdminFeedbackView: React.FC = () => {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FrappeFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'replied'>('all');

  // Derive replies from Frappe data (globally visible to all users)
  const replies = useMemo(() => buildRepliesFromFeedback(feedbacks), [feedbacks]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try { setFeedbacks(await fetchAllFeedback()); }
      catch (_) { }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const allGroups = useMemo(() => groupAndSortAdmin(feedbacks, replies), [feedbacks, replies]);

  const visibleGroups = useMemo(() => {
    let groups = allGroups;
    // Apply status filter
    if (filter === 'pending') {
      groups = groups
        .map(g => ({ ...g, items: g.items.filter(f => !replies[f.name]) }))
        .filter(g => g.items.length > 0);
    } else if (filter === 'replied') {
      groups = groups
        .map(g => ({ ...g, items: g.items.filter(f => !!replies[f.name]) }))
        .filter(g => g.items.length > 0);
    }
    // Apply search
    if (!searchTerm) return groups;
    const q = searchTerm.toLowerCase();
    return groups.filter(g =>
      g.projectName.toLowerCase().includes(q) ||
      g.items.some(f => f.description?.toLowerCase().includes(q) || f.full_name?.toLowerCase().includes(q))
    );
  }, [allGroups, searchTerm, filter, replies]);

  // Deduplicate across all feedback for the summary counters
  const allDeduped = useMemo(() => deduplicateItems(feedbacks, replies), [feedbacks, replies]);
  const totalUnreplied = useMemo(() => allDeduped.filter(f => !replies[f.name]).length, [allDeduped, replies]);

  const handleReply = async (feedbackName: string, replyText: string) => {
    const data: FeedbackReply = {
      reply: replyText,
      repliedAt: new Date().toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      repliedBy: user?.name ?? 'Staff',
    };
    const saved = await saveFeedbackReplyToFrappe(feedbackName, data);
    if (saved) setFeedbacks(await fetchAllFeedback());
    setReplyingTo(null);
  };

  const handleDeleteReply = async (feedbackName: string) => {
    const cleared = await deleteFeedbackReplyFromFrappe(feedbackName);
    if (cleared) setFeedbacks(await fetchAllFeedback());
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Feedback Manager</h2>
          <p className="text-slate-500 font-bold text-sm mt-1">Review and respond to citizen feedback by project.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm divide-x divide-slate-100">
          <div className="text-right px-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique</p>
            <p className="text-xl font-black tt-green">{allDeduped.length}</p>
          </div>
          <div className="text-right px-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending Reply</p>
            <p className={`text-xl font-black ${totalUnreplied > 0 ? 'text-amber-600' : 'tt-green'}`}>{totalUnreplied}</p>
          </div>
          <div className="text-right px-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Projects</p>
            <p className="text-xl font-black tt-navy">{allGroups.length}</p>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by citizen name, keyword, or project..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-tt-green outline-none font-bold text-slate-700 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'replied'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${filter === f
                ? f === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : f === 'replied'
                    ? 'bg-green-100 text-green-700'
                    : 'tt-bg-navy text-white'
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
            >
              {f === 'all' ? `All (${allDeduped.length})` : f === 'pending' ? `Pending (${totalUnreplied})` : `Replied (${allDeduped.length - totalUnreplied})`}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback groups */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-6 h-6 bg-tt-green rounded-full animate-ping mx-auto mb-4" />
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading feedback…</p>
        </div>
      ) : visibleGroups.length > 0 ? (
        <div className="space-y-4">
          {visibleGroups.map((group, idx) => (
            <AdminGroupCard
              key={group.projectId}
              group={group}
              replies={replies}
              onReply={handleReply}
              onDeleteReply={handleDeleteReply}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              searchTerm={searchTerm}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare size={28} className="text-slate-200" />
          </div>
          <h3 className="text-lg font-black text-slate-800">No Feedback Found</h3>
          <p className="text-slate-400 font-bold text-sm">No submissions match your search.</p>
        </div>
      )}
    </div>
  );
};

// ─── Public feedback view ─────────────────────────────────────────────────────

const PublicFeedbackView: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FrappeFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Derive replies from Frappe data so they are globally visible
  const replies = useMemo(() => buildRepliesFromFeedback(feedbacks), [feedbacks]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchAllFeedback();
        setFeedbacks(data);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const allGroups = useMemo(() => groupByProject(feedbacks), [feedbacks]);

  const visibleGroups = useMemo(() => {
    if (!searchTerm) return allGroups;
    const q = searchTerm.toLowerCase();
    return allGroups.filter(
      (g) =>
        g.projectName.toLowerCase().includes(q) ||
        g.items.some(
          (f) =>
            f.description?.toLowerCase().includes(q) ||
            f.full_name?.toLowerCase().includes(q),
        ),
    );
  }, [allGroups, searchTerm]);

  const visibleFeedbacks = useMemo(
    () => visibleGroups.flatMap((g) => g.items),
    [visibleGroups],
  );

  const handleAnalyze = async () => {
    if (visibleFeedbacks.length === 0) return;
    setIsAnalyzing(true);
    try {
      const summary = await analyzeFeedback(visibleFeedbacks as any);
      setAiAnalysis(summary);
    } catch (err) {
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 md:space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4 sm:gap-6 mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tight">Citizen Feedback Hub</h2>
          <p className="text-slate-500 font-bold text-sm sm:text-base md:text-lg">Direct voices from the Taita Taveta community.</p>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 bg-white p-3 sm:p-4 rounded-xl sm:rounded-[2rem] border border-slate-100 shadow-sm divide-x divide-slate-100">
          <div className="text-right px-2 sm:px-4">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Projects Covered</p>
            <p className="text-lg sm:text-xl md:text-2xl font-black tt-green">{allGroups.length}</p>
          </div>
          <div className="text-right px-2 sm:px-4">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Submissions</p>
            <p className="text-lg sm:text-xl md:text-2xl font-black tt-green">{feedbacks.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Filter by keyword, citizen name, or project..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50/50 focus:bg-white focus:border-tt-green outline-none font-bold text-slate-700 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="w-6 h-6 bg-tt-green rounded-full animate-ping mx-auto mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading feedback…</p>
            </div>
          ) : visibleGroups.length > 0 ? (
            <div className="space-y-6">
              {visibleGroups.map((group, idx) => (
                <ProjectGroupCard
                  key={group.projectId}
                  group={group}
                  searchTerm={searchTerm}
                  defaultOpen={idx === 0}
                  replies={replies}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] border border-slate-100 p-10 sm:p-14 md:p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <MessageSquare size={32} className="text-slate-200" />
              </div>
              <h3 className="text-xl font-black text-slate-800">No Citizen Voices Recorded</h3>
              <p className="text-slate-400 font-bold max-w-xs mx-auto">
                Submitted project feedback will appear here for public monitoring.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] shadow-2xl border-b-8 border-tt-green relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
              <BrainCircuit size={100} className="text-tt-yellow" />
            </div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tt-green/20 text-tt-green border border-tt-green/30 text-[10px] font-black uppercase tracking-widest mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-tt-green animate-pulse" />
                AI Governance Insights
              </div>

              <h3 className="text-2xl font-black text-white mb-4">Sentiment Intelligence</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                Use Gemini to process collective feedback and generate executive summaries for faster government response.
              </p>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || visibleFeedbacks.length === 0}
                className="w-full py-5 tt-bg-green text-white rounded-2xl font-black shadow-xl shadow-green-900/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isAnalyzing
                  ? <Loader2 className="animate-spin" size={20} />
                  : <><BrainCircuit size={20} /> Generate Analysis</>}
              </button>

              {aiAnalysis && (
                <div className="mt-8 space-y-6 animate-in fade-in duration-700">
                  <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 font-mono text-[11px] leading-relaxed text-blue-100/80">
                    <p className="mb-4 flex items-center gap-2 text-tt-yellow font-black uppercase tracking-tighter">
                      <CheckCircle2 size={14} /> Execution Summary:
                    </p>
                    {aiAnalysis}
                  </div>
                  <button
                    onClick={() => setAiAnalysis('')}
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Clear Analysis
                  </button>
                </div>
              )}

              {!aiAnalysis && !isAnalyzing && (
                <div className="mt-10 pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Trends</p>
                    <CheckCircle2 size={16} className="mx-auto text-tt-green" />
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Actions</p>
                    <AlertCircle size={16} className="mx-auto text-tt-yellow" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-lg">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">M&E Standards</h4>
            <div className="space-y-4">
              <StandardItem icon={<CheckCircle2 size={16} className="text-tt-green" />} text="Verified Public Submissions" />
              <StandardItem icon={<CheckCircle2 size={16} className="text-tt-green" />} text="Direct Linkage to Project IDs" />
              <StandardItem icon={<CheckCircle2 size={16} className="text-tt-green" />} text="Real-time SDU Oversight" />
              <StandardItem icon={<CheckCircle2 size={16} className="text-tt-green" />} text="Transparency Compliance" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── main component ──────────────────────────────────────────────────────────

const FeedbackList: React.FC = () => {
  const { user } = useAuth();
  if (user) return <AdminFeedbackView />;
  return <PublicFeedbackView />;
};

export default FeedbackList;
