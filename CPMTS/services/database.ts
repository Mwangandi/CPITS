
import { Project, User, Feedback, SystemSettings } from '../types';
import { MOCK_USERS } from '../constants';

const DB_KEYS = {
  PROJECTS: 'tt_pmts_projects',
  USERS: 'tt_pmts_users',
  FEEDBACK: 'tt_pmts_feedback',
  SETTINGS: 'tt_pmts_settings'
};

const DEFAULT_SETTINGS: SystemSettings = {
  countyName: 'Taita Taveta County',
  sduEmail: 'sdu@taitataveta.go.ke'
};

class Database {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) {
        this.set(key, defaultValue);
        return defaultValue;
      }
      const parsed = JSON.parse(data);
      return parsed === null ? defaultValue : parsed;
    } catch (error) {
      return defaultValue;
    }
  }

  private set(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
    }
  }

  // --- Settings ---
  settings = {
    get: (): SystemSettings => this.get<SystemSettings>(DB_KEYS.SETTINGS, DEFAULT_SETTINGS),
    save: (settings: SystemSettings): void => this.set(DB_KEYS.SETTINGS, settings)
  };

  // --- Projects ---
  projects = {
    getAll: (): Project[] => this.get<Project[]>(DB_KEYS.PROJECTS, []),
    getById: (id: string): Project | undefined => {
      const all = this.projects.getAll();
      return Array.isArray(all) ? all.find(p => p.id === id) : undefined;
    },
    save: (project: Project): void => {
      const projects = this.projects.getAll();
      const index = projects.findIndex(p => p.id === project.id);
      if (index > -1) {
        projects[index] = project;
      } else {
        projects.push(project);
      }
      this.set(DB_KEYS.PROJECTS, projects);
    },
    delete: (id: string): void => {
      const projects = this.projects.getAll().filter(p => p.id !== id);
      this.set(DB_KEYS.PROJECTS, projects);
    }
  };

  // --- Users ---
  users = {
    getAll: (): User[] => this.get<User[]>(DB_KEYS.USERS, MOCK_USERS),
    getByPayroll: (payroll: string): User | undefined =>
      this.users.getAll().find(u => u.payrollNumber === payroll),
    save: (user: User): void => {
      const users = this.users.getAll();
      const index = users.findIndex(u => u.id === user.id);
      if (index > -1) {
        users[index] = user;
      } else {
        users.push(user);
      }
      this.set(DB_KEYS.USERS, users);
    },
    delete: (id: string): void => {
      const users = this.users.getAll().filter(u => u.id !== id);
      this.set(DB_KEYS.USERS, users);
    }
  };

  // --- Feedback ---
  feedback = {
    getAll: (): Feedback[] => this.get<Feedback[]>(DB_KEYS.FEEDBACK, []),
    getByProject: (projectId: string): Feedback[] =>
      this.feedback.getAll().filter(f => f.projectId === projectId),
    add: (feedback: Feedback): void => {
      const feedbacks = this.feedback.getAll();
      feedbacks.push(feedback);
      this.set(DB_KEYS.FEEDBACK, feedbacks);
    }
  };
}

export const db = new Database();
